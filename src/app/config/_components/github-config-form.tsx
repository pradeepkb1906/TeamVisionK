
// src/app/config/_components/github-config-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { GithubConfigFormData, GithubRepoData } from "@/lib/schemas";
import { GithubConfigSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { saveGithubConfig, scanGithubRepos, refreshGithubMetrics, getGithubConfig } from "@/lib/actions";
import type { Team } from "./types";
import { useState, useEffect } from "react";
import { RefreshCw, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";


interface GithubConfigFormProps {
  teams: Team[];
}

export function GithubConfigForm({ teams }: GithubConfigFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [scannedRepos, setScannedRepos] = useState<GithubRepoData[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  const form = useForm<GithubConfigFormData>({
    resolver: zodResolver(GithubConfigSchema),
    defaultValues: {
      teamId: "",
      rootUrl: "https://github.com/",
      accessToken: "",
      selectedRepos: [],
    },
  });

  const watchTeamId = form.watch("teamId");
  const watchedSelectedRepos = form.watch("selectedRepos") || [];

  useEffect(() => {
    async function fetchConfig() {
      if (watchTeamId) {
        setIsLoadingConfig(true);
        setScannedRepos([]);
        try {
          const config = await getGithubConfig(watchTeamId);
          if (config) {
            form.reset({
              teamId: watchTeamId,
              rootUrl: config.rootUrl || "https://github.com/",
              accessToken: config.accessToken || "",
              selectedRepos: config.selectedRepos || [],
            });
            if (config.selectedRepos && config.selectedRepos.length > 0 && scannedRepos.length === 0) {
                 setScannedRepos(config.selectedRepos.map(repo => ({
                    id: repo.id,
                    name: repo.name || `Repo ID: ${repo.id}`,
                    url: repo.url,
                    fullName: repo.fullName
                })).filter(Boolean) as GithubRepoData[]);
            }
          } else {
            form.reset({
              teamId: watchTeamId,
              rootUrl: "https://github.com/",
              accessToken: "",
              selectedRepos: [],
            });
          }
        } catch (error) {
          toast({ title: "Error", description: "Could not load GitHub configuration.", variant: "destructive" });
          form.reset({ teamId: watchTeamId, rootUrl: "https://github.com/", accessToken: "", selectedRepos: [] });
        } finally {
          setIsLoadingConfig(false);
        }
      } else {
         form.reset({ teamId: "", rootUrl: "https://github.com/", accessToken: "", selectedRepos: [] });
         setScannedRepos([]);
      }
    }
    fetchConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchTeamId, form.reset, toast]);

  async function handleScanRepos() {
    const currentFormData = form.getValues();
    if (!currentFormData.teamId) {
      toast({ title: "Error", description: "Please select a team first.", variant: "destructive" });
      return;
    }
    if (!currentFormData.rootUrl) {
      toast({ title: "Error", description: "Please enter a GitHub Root URL.", variant: "destructive" });
      return;
    }
     if (!currentFormData.accessToken) {
      toast({ title: "Error", description: "Please enter a GitHub Access Token for scanning.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const saveResult = await saveGithubConfig({
        teamId: currentFormData.teamId,
        rootUrl: currentFormData.rootUrl,
        accessToken: currentFormData.accessToken,
        selectedRepos: currentFormData.selectedRepos || [] // Ensure selectedRepos is an array
    });
    if (!saveResult.success) {
      toast({ title: "Error Saving Config", description: `Could not save GitHub config before scanning: ${saveResult.message}`, variant: "destructive" });
      setIsSaving(false);
      return;
    }
    toast({ title: "Config Saved", description: "GitHub configuration saved before scanning." });
    setIsSaving(false);

    setIsScanning(true);
    setScannedRepos([]);
    const result = await scanGithubRepos(currentFormData.teamId);
    if (result.success && result.repos) {
      setScannedRepos(result.repos);
      toast({ title: "Scan Complete", description: result.message || `${result.repos.length} repositories found.` });

       const currentSelectedRepoObjects = form.getValues("selectedRepos") || [];
       const validSelected = currentSelectedRepoObjects.filter(selectedRepo =>
            result.repos.some(scannedRepo => scannedRepo.id === selectedRepo.id)
       );
       form.setValue("selectedRepos", validSelected, { shouldDirty: true, shouldValidate: true });

    } else {
      toast({ title: "Scan Failed", description: result.message || "Could not scan repositories.", variant: "destructive" });
    }
    setIsScanning(false);
  }

  async function onSubmit(data: GithubConfigFormData) {
    setIsSaving(true);
    const result = await saveGithubConfig({...data, selectedRepos: data.selectedRepos || []});
    if (result.success) {
      toast({ title: "Success", description: result.message });
      router.refresh();
    } else {
      toast({ title: "Error", description: result.message || "Failed to save configuration.", variant: "destructive" });
    }
    setIsSaving(false);
  }

  async function handleRefreshMetrics(teamIdToRefresh: string, reposToRefresh: GithubRepoData[]) {
     if (!teamIdToRefresh || reposToRefresh.length === 0) {
      toast({ title: "Error", description: "Please select a team and ensure repos are selected for refresh.", variant: "destructive" });
      return;
    }
    setIsRefreshing(true);
    const result = await refreshGithubMetrics(teamIdToRefresh, reposToRefresh);
     if (result.success) {
      toast({ title: "Success", description: result.message });
    } else {
      toast({ title: "Error", description: result.message || "Failed to refresh metrics.", variant: "destructive" });
    }
    setIsRefreshing(false);
  }
  
  const listToRenderInScrollArea = (scannedRepos.length > 0 ? scannedRepos : watchedSelectedRepos)
                                    .filter(repo => repo && typeof repo.id === 'string' && repo.id.trim() !== '');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="teamId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Team</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || undefined}
                disabled={isLoadingConfig}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team to configure" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rootUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GitHub Root URL (Organization, User, or API endpoint)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., https://github.com/YourOrgOrUser or https://api.github.com/user/repos" {...field} disabled={isLoadingConfig || !watchTeamId} />
              </FormControl>
              <FormDescription>
                Enter the base URL for a GitHub organization/user (e.g., https://github.com/octocat) or a direct API endpoint for repositories (e.g., https://api.github.com/user/repos).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="accessToken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GitHub Access Token</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter GitHub Personal Access Token" {...field} disabled={isLoadingConfig || !watchTeamId} />
              </FormControl>
              <FormDescription>
                A personal access token with 'repo' scope is required to list repositories and fetch metrics.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="button" onClick={handleScanRepos} disabled={isScanning || isLoadingConfig || !watchTeamId || isSaving}>
          <Search className="mr-2 h-4 w-4" />
          {isSaving ? "Saving before scan..." : isScanning ? "Scanning..." : "Scan Repos"}
        </Button>

        {(listToRenderInScrollArea.length > 0 ) && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Select Repositories to Include</h3>
             <FormDescription>
                {scannedRepos.length === 0 && watchedSelectedRepos.length > 0 && !isScanning && !isLoadingConfig
                ? `Previously selected ${watchedSelectedRepos.length} repo(s) from configuration. Re-scan to discover new ones or if URL/token changed.`
                : scannedRepos.length > 0 ? `Select from ${scannedRepos.length} scanned repositories.` : "No repositories to display. Try scanning." }
            </FormDescription>
            <ScrollArea className="h-64 rounded-md border p-4">
              {listToRenderInScrollArea.map((repo) => (
                <div key={repo.id}> {/* Key is on the wrapping div */}
                  <FormField
                    control={form.control}
                    name="selectedRepos" // This name is shared for the array field
                    render={({ field }) => {
                      return (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 mb-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.some(selectedRepo => selectedRepo.id === repo.id)}
                              onCheckedChange={(checked) => {
                                const currentSelected = field.value || [];
                                let newSelected: GithubRepoData[];
                                if (checked) {
                                  if (!currentSelected.some(r => r.id === repo.id)) {
                                    newSelected = [...currentSelected, repo];
                                  } else {
                                    newSelected = currentSelected; 
                                  }
                                } else {
                                  newSelected = currentSelected.filter((selectedRepo) => selectedRepo.id !== repo.id);
                                }
                                field.onChange(newSelected);
                              }}
                              id={`repo-checkbox-${repo.id}`} 
                              disabled={isLoadingConfig}
                            />
                          </FormControl>
                          <FormLabel htmlFor={`repo-checkbox-${repo.id}`} className="font-normal cursor-pointer">
                            {repo.name} {repo.url ? `(${repo.url})` : ''} {repo.fullName ? `[${repo.fullName}]` : ''}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                </div>
              ))}
            </ScrollArea>
            <FormDescription>
              Selected repos: {watchedSelectedRepos.length}.
            </FormDescription>
          </div>
        )}
        
        <div className="flex gap-4">
          <Button type="submit" disabled={isSaving || isLoadingConfig || !watchTeamId || isScanning}>
            {isSaving ? "Saving..." : "Save GitHub Configuration"}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
                const teamIdValue = form.getValues("teamId");
                const selectedReposValue = form.getValues("selectedRepos");
                if (teamIdValue && selectedReposValue && selectedReposValue.length > 0) {
                    handleRefreshMetrics(teamIdValue, selectedReposValue);
                } else {
                    toast({ title: "Error", description: "Team or repos not properly selected for refresh.", variant: "destructive" });
                }
            }} 
            disabled={isRefreshing || isLoadingConfig || !watchTeamId || watchedSelectedRepos.length === 0 || isScanning}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {isRefreshing ? "Refreshing..." : "Refresh Metrics for Selected Repos"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
