
// src/app/config/_components/db-config-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { DbConfigFormData, PushToRepoFormData } from "@/lib/schemas";
import { DbConfigSchema, PushToRepoSchema } from "@/lib/schemas";
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
import { saveDbConfig, getDbConfig, generateRepoSetupScripts } from "@/lib/actions";
import { DB_TYPES } from "@/lib/constants";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { UploadCloud, Copy } from "lucide-react";

export function DbConfigForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isPushToRepoDialogOpen, setIsPushToRepoDialogOpen] = useState(false);
  const [isGeneratingScripts, setIsGeneratingScripts] = useState(false);
  const [setupShScript, setSetupShScript] = useState<string | null>(null);
  const [setupBatScript, setSetupBatScript] = useState<string | null>(null);


  const dbConfigForm = useForm<DbConfigFormData>({
    resolver: zodResolver(DbConfigSchema),
    defaultValues: {
      dbType: "sqlite",
      dbPath: "./data/mydatabase.sqlite3",
      dbName: "mydatabase",
    },
  });

  const pushToRepoForm = useForm<PushToRepoFormData>({
    resolver: zodResolver(PushToRepoSchema),
    defaultValues: {
      repoUrl: "",
      accessToken: "",
    },
  });

  useEffect(() => {
    async function fetchDbConfig() {
      setIsLoadingConfig(true);
      try {
        const savedConfig = await getDbConfig();
        if (savedConfig) {
          dbConfigForm.reset(savedConfig);
        } else {
          dbConfigForm.reset({
            dbType: "sqlite",
            dbPath: "./data/mydatabase.sqlite3",
            dbName: "mydatabase",
          });
        }
      } catch (error) {
        console.error("Failed to load DB config:", error);
        toast({
          title: "Error Loading Config",
          description: "Could not load saved database configuration.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingConfig(false);
      }
    }
    fetchDbConfig();
  }, [dbConfigForm, toast]);


  async function onDbConfigSubmit(data: DbConfigFormData) {
    setIsSubmitting(true);
    const result = await saveDbConfig(data);
    if (result.success) {
      toast({ title: "Success", description: "Database configuration preferences saved." });
    } else {
      toast({ title: "Error", description: result.message || "Failed to save database configuration.", variant: "destructive" });
    }
    setIsSubmitting(false);
  }

  async function onPushToRepoSubmit(data: PushToRepoFormData) {
    setIsGeneratingScripts(true);
    setSetupShScript(null);
    setSetupBatScript(null);
    try {
      const result = await generateRepoSetupScripts(data);
      if (result.success) {
        toast({ title: "Scripts Generated (Simulated Push)", description: result.message });
        setSetupShScript(result.setupShScript || null);
        setSetupBatScript(result.setupBatScript || null);
        // Keep dialog open to show scripts, or setIsPushToRepoDialogOpen(false) to close
      } else {
        toast({ title: "Error", description: result.message || "Failed to process request.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsGeneratingScripts(false);
    }
  }

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied!", description: `${type} script copied to clipboard.` });
    }).catch(err => {
      toast({ title: "Copy Failed", description: `Could not copy ${type} script.`, variant: "destructive" });
      console.error('Failed to copy text: ', err);
    });
  };


  return (
    <div className="space-y-8">
      <Form {...dbConfigForm}>
        <form onSubmit={dbConfigForm.handleSubmit(onDbConfigSubmit)} className="space-y-6">
          <FormDescription>
            Note: These settings are for demonstration and informational purposes. The application's primary database connection path is fixed. Changes here are saved to the primary database but do not alter the active connection for this running application instance.
          </FormDescription>
          <FormField
            control={dbConfigForm.control}
            name="dbType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Database Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  defaultValue={field.value}
                  disabled={isLoadingConfig || isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select DB Type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DB_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={dbConfigForm.control}
            name="dbPath"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Database Path (Informational)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., ./data/mydatabase.sqlite3"
                    {...field}
                    disabled={isLoadingConfig || isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={dbConfigForm.control}
            name="dbName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Database Name (Informational)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., mydatabase"
                    {...field}
                    disabled={isLoadingConfig || isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting || isLoadingConfig}>
            {isSubmitting ? "Saving..." : isLoadingConfig ? "Loading Config..." : "Save Database Configuration"}
          </Button>
        </form>
      </Form>

      <div className="mt-8 pt-6 border-t">
        <h3 className="text-lg font-medium mb-2">Repository Sync (Simulated)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This feature simulates generating setup scripts for your project. It does NOT perform an actual Git push.
          You can copy the generated scripts and add them to your repository manually.
        </p>
        <Dialog open={isPushToRepoDialogOpen} onOpenChange={setIsPushToRepoDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={() => { setSetupShScript(null); setSetupBatScript(null); pushToRepoForm.reset(); setIsPushToRepoDialogOpen(true);}}>
              <UploadCloud className="mr-2 h-4 w-4" />
              Push Code to Repo / Generate Setup Scripts
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Push to Repository (Simulated) / Generate Setup Scripts</DialogTitle>
              <DialogDescription>
                Enter your repository details. Submitting will generate setup scripts.
                The application will NOT perform an actual Git push.
              </DialogDescription>
            </DialogHeader>
            <Form {...pushToRepoForm}>
              <form onSubmit={pushToRepoForm.handleSubmit(onPushToRepoSubmit)} className="space-y-4 py-4">
                <FormField
                  control={pushToRepoForm.control}
                  name="repoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repository URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://github.com/your-org/your-repo.git" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={pushToRepoForm.control}
                  name="accessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Git Access Token (for reference, not used for push)</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your Git personal access token" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="mt-6">
                  <DialogClose asChild>
                     <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isGeneratingScripts}>
                    {isGeneratingScripts ? "Generating Scripts..." : "Generate Setup Scripts"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
            { (setupShScript || setupBatScript) && (
              <div className="mt-4 space-y-4 pt-4 border-t">
                <h4 className="font-medium">Generated Setup Scripts:</h4>
                {setupShScript && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="shScript" className="text-sm font-medium">setup.sh (for Linux/macOS)</label>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(setupShScript, "setup.sh")}><Copy className="mr-2 h-3 w-3" />Copy</Button>
                    </div>
                    <Textarea id="shScript" readOnly value={setupShScript} rows={8} className="text-xs font-mono"/>
                  </div>
                )}
                {setupBatScript && (
                  <div>
                     <div className="flex justify-between items-center mb-1">
                      <label htmlFor="batScript" className="text-sm font-medium">setup.bat (for Windows)</label>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(setupBatScript, "setup.bat")}><Copy className="mr-2 h-3 w-3" />Copy</Button>
                    </div>
                    <Textarea id="batScript" readOnly value={setupBatScript} rows={8} className="text-xs font-mono"/>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
