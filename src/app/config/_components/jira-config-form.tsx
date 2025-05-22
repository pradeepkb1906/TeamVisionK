
// src/app/config/_components/jira-config-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { JiraConfigFormData } from "@/lib/schemas";
import { JiraConfigSchema } from "@/lib/schemas";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { saveJiraConfig, getJiraConfig } from "@/lib/actions";
import type { Team } from "./types";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";

interface JiraConfigFormProps {
  teams: Team[];
}

const JIRA_SSO_URL = "https://jsw.ibm.com/plugins/servlet/samlsso?redirectTo=%2F";

export function JiraConfigForm({ teams }: JiraConfigFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  const form = useForm<JiraConfigFormData>({
    resolver: zodResolver(JiraConfigSchema),
    defaultValues: {
      teamId: "",
      projectName: "",
      accessKey: "", 
    },
  });

  const watchTeamId = form.watch("teamId");
  const { reset } = form; 

  useEffect(() => {
    async function fetchConfig() {
      if (watchTeamId) {
        setIsLoadingConfig(true);
        try {
          const config = await getJiraConfig(watchTeamId);
          if (config) {
            reset({ 
              teamId: watchTeamId,
              projectName: config.projectName || "",
              accessKey: config.accessKey || "",
            });
          } else {
            reset({ 
              teamId: watchTeamId,
              projectName: "",
              accessKey: "",
            });
          }
        } catch (error: any) {
          toast({ title: "Error", description: error.message || "Could not load Jira configuration.", variant: "destructive" });
          reset({ 
            teamId: watchTeamId,
            projectName: "",
            accessKey: "",
          });
        } finally {
          setIsLoadingConfig(false);
        }
      } else {
         reset({ 
            teamId: "",
            projectName: "",
            accessKey: "",
          });
      }
    }
    fetchConfig();
  }, [watchTeamId, reset, toast]);

  async function onSubmit(data: JiraConfigFormData) {
    setIsSubmitting(true);
    const result = await saveJiraConfig(data); 
    if (result.success) {
      toast({ title: "Success", description: result.message });
      router.refresh(); 
    } else {
      toast({ title: "Error", description: result.message || "Failed to save Jira configuration or refresh metrics.", variant: "destructive" });
    }
    setIsSubmitting(false);
  }

  const handleOpenJiraLogin = () => {
    window.open(JIRA_SSO_URL, '_blank', 'noopener,noreferrer');
  };

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
                    <SelectValue placeholder="Select a team" />
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
        
        <FormDescription>
          The Jira Server URL (<code>https://jsw.ibm.com</code>) and Username for API calls (<code>pradeep.basavarajappa2</code>) are pre-configured.
          Please provide the Project Name and your API Token below.
        </FormDescription>

        <FormField
          control={form.control}
          name="projectName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name or Key</FormLabel>
              <FormControl>
                <Input placeholder="Enter Jira project name or key (e.g., ICAPML)" {...field} disabled={isLoadingConfig || !watchTeamId} />
              </FormControl>
              <FormDescription>The exact name or key of the Jira project (e.g., "My Project" or "MP").</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="accessKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Jira API Token (Access Key)</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter Jira API Token" {...field} disabled={isLoadingConfig || !watchTeamId} />
              </FormControl>
              <FormDescription>
                Generate an API Token from your Atlassian account settings. 
                You can use the button below to log into Jira first.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="button" variant="outline" onClick={handleOpenJiraLogin} className="mt-2">
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Jira Login (to get API Token)
        </Button>

        <div className="pt-4">
            <Button type="submit" disabled={isSubmitting || isLoadingConfig || !watchTeamId}>
            {isSubmitting ? "Saving & Refreshing..." : "Save Jira Configuration & Refresh Metrics"}
            </Button>
        </div>
      </form>
    </Form>
  );
}
