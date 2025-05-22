
// src/app/config/_components/api-keys-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { ApiKeysFormData } from "@/lib/schemas";
import { ApiKeysSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { saveApiKeys, getApiKeys } from "@/lib/actions";
import type { Team } from "./types";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ApiKeysFormProps {
  teams: Team[];
}

export function ApiKeysForm({ teams }: ApiKeysFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  const form = useForm<ApiKeysFormData>({
    resolver: zodResolver(ApiKeysSchema),
    defaultValues: {
      teamId: "",
      geminiApiKey: "",
      openAiApiKey: "",
      claudeAiApiKey: "",
    },
  });

  const watchTeamId = form.watch("teamId");

  useEffect(() => {
    async function fetchConfig() {
      if (watchTeamId) {
        setIsLoadingConfig(true);
        try {
          const config = await getApiKeys(watchTeamId);
          if (config) {
            form.reset({
              teamId: watchTeamId,
              geminiApiKey: config.geminiApiKey || "",
              openAiApiKey: config.openAiApiKey || "",
              claudeAiApiKey: config.claudeAiApiKey || "",
            });
          } else {
            form.reset({
              teamId: watchTeamId,
              geminiApiKey: "",
              openAiApiKey: "",
              claudeAiApiKey: "",
            });
          }
        } catch (error) {
          toast({ title: "Error", description: "Could not load API keys configuration.", variant: "destructive" });
           form.reset({ // Reset to clear stale data on error
              teamId: watchTeamId,
              geminiApiKey: "",
              openAiApiKey: "",
              claudeAiApiKey: "",
            });
        } finally {
          setIsLoadingConfig(false);
        }
      } else {
         form.reset({ // Clear form if no team is selected
            teamId: "",
            geminiApiKey: "",
            openAiApiKey: "",
            claudeAiApiKey: "",
          });
      }
    }
    fetchConfig();
  }, [watchTeamId, form, toast]);

  async function onSubmit(data: ApiKeysFormData) {
    setIsSubmitting(true);
    const result = await saveApiKeys(data);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      router.refresh(); // To ensure data consistency if other components depend on this
    } else {
      toast({ title: "Error", description: result.message || "Failed to save API keys.", variant: "destructive" });
    }
    setIsSubmitting(false);
  }

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
                onValueChange={(value) => {
                  field.onChange(value);
                }} 
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

        <FormField
          control={form.control}
          name="geminiApiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gemini API Key</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter Gemini API Key" {...field} disabled={isLoadingConfig || !watchTeamId} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="openAiApiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>OpenAI API Key</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter OpenAI API Key" {...field} disabled={isLoadingConfig || !watchTeamId} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="claudeAiApiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ClaudeAI API Key</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter ClaudeAI API Key" {...field} disabled={isLoadingConfig || !watchTeamId} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={isSubmitting || isLoadingConfig || !watchTeamId}>
          {isSubmitting ? "Saving..." : "Save API Keys"}
        </Button>
      </form>
    </Form>
  );
}
