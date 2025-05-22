// src/app/config/_components/sonarqube-config-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { SonarQubeConfigFormData } from "@/lib/schemas";
import { SonarQubeConfigSchema } from "@/lib/schemas";
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
import { saveSonarQubeConfig, getSonarQubeConfig } from "@/lib/actions";
import type { Team } from "./types";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SonarQubeConfigFormProps {
  teams: Team[];
}

export function SonarQubeConfigForm({ teams }: SonarQubeConfigFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  const form = useForm<SonarQubeConfigFormData>({
    resolver: zodResolver(SonarQubeConfigSchema),
    defaultValues: {
      teamId: "",
      url: "",
      accessKey: "",
    },
  });

  const watchTeamId = form.watch("teamId");

  useEffect(() => {
    async function fetchConfig() {
      if (watchTeamId) {
        setIsLoadingConfig(true);
        try {
          const config = await getSonarQubeConfig(watchTeamId);
          if (config) {
            form.reset(config);
          } else {
            form.reset({
              teamId: watchTeamId,
              url: "",
              accessKey: "",
            });
          }
        } catch (error) {
          toast({ title: "Error", description: "Could not load SonarQube configuration.", variant: "destructive" });
          form.reset({ teamId: watchTeamId, url: "", accessKey: "" });
        } finally {
          setIsLoadingConfig(false);
        }
      } else {
        form.reset({ teamId: "", url: "", accessKey: "" });
      }
    }
    fetchConfig();
  }, [watchTeamId, form, toast]);

  async function onSubmit(data: SonarQubeConfigFormData) {
    setIsSubmitting(true);
    const result = await saveSonarQubeConfig(data);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      router.refresh();
    } else {
      toast({ title: "Error", description: result.message || "Failed to save SonarQube configuration.", variant: "destructive" });
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

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SonarQube URL (including project key if applicable)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., https://sonarcloud.io/project/key?id=project_key" {...field} disabled={isLoadingConfig || !watchTeamId} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="accessKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Access Key</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter SonarQube access key" {...field} disabled={isLoadingConfig || !watchTeamId} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={isSubmitting || isLoadingConfig || !watchTeamId}>
          {isSubmitting ? "Saving..." : "Save SonarQube Configuration"}
        </Button>
      </form>
    </Form>
  );
}
