
// src/app/ai-insights/page.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { AiInsightRequestFormData } from "@/lib/schemas";
import { AiInsightRequestSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { generateTeamInsights } from "@/lib/actions";
import type { Team } from "../config/_components/types";
import type { AnalyzeTeamDataOutput } from "@/ai/flows/team-insights";
import { AI_LLM_OPTIONS } from "@/lib/constants";
import { useState, useEffect } from "react";
import { Brain, Wand2, AlertCircle, HelpCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useGetTeams } from '@/hooks/use-team-queries';

export default function AiInsightsPage() {
  const { toast } = useToast();
  const { data: teamsData, isLoading: isLoadingTeams, error: teamsError } = useGetTeams();
  const teams: Team[] = teamsData || [];
  
  const [insights, setInsights] = useState<AnalyzeTeamDataOutput | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const form = useForm<AiInsightRequestFormData>({
    resolver: zodResolver(AiInsightRequestSchema),
    defaultValues: {
      teamId: "",
      llmProvider: undefined,
      userPrompt: "",
    },
  });

  async function onSubmit(data: AiInsightRequestFormData) {
    setIsGeneratingInsights(true);
    setInsights(null); 
    try {
      const result = await generateTeamInsights(
        data.teamId,
        data.llmProvider as "gemini" | "openai" | "claudeai",
        data.userPrompt
      );
      if (result.success && result.data) {
        setInsights(result.data);
        toast({ title: "Insights Generated", description: "Successfully analyzed team data." });
      } else {
        toast({ title: "Error Generating Insights", description: result.error || "An unknown error occurred.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to generate insights.", variant: "destructive" });
    } finally {
      setIsGeneratingInsights(false);
    }
  }

  if (teamsError) {
    return <div className="container mx-auto py-10 text-center text-destructive">Error loading teams: {teamsError.message}</div>;
  }

  return (
    <div className="container mx-auto py-10 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            AI-Powered Team Insights
          </CardTitle>
          <CardDescription>
            Select a team, an AI provider, and optionally provide a specific prompt to generate insights on efficiency, bottlenecks, and optimal team structure (including team size recommendations).
            Ensure API keys for the selected provider are configured for the team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="teamId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Team</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || undefined} disabled={isLoadingTeams}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingTeams ? "Loading teams..." : "Select a team"} />
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
                  name="llmProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select AI Provider</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an AI provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AI_LLM_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="userPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      Your Specific Question or Focus (Optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 'Focus on improving our release cadence.' or 'Are there specific skill gaps affecting project delivery? What team size would be optimal for our current workload?'"
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isGeneratingInsights || isLoadingTeams} className="w-full md:w-auto">
                <Wand2 className="mr-2 h-4 w-4" />
                {isGeneratingInsights ? "Generating Insights..." : "Generate Insights"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isGeneratingInsights && (
        <div className="text-center py-8">
          <Brain className="h-12 w-12 text-primary animate-pulse mx-auto" />
          <p className="mt-4 text-lg text-muted-foreground">Generating insights, please wait...</p>
        </div>
      )}

      {insights && (
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>Generated by the selected AI provider, considering your prompt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2 text-primary">Team Efficiency</h3>
              <Textarea value={insights.teamEfficiency} readOnly rows={6} className="bg-secondary/30 border-secondary" />
            </div>
            <Separator />
            <div>
              <h3 className="text-xl font-semibold mb-2 text-primary">Identified Bottlenecks</h3>
              <Textarea value={insights.bottlenecks} readOnly rows={6} className="bg-secondary/30 border-secondary" />
            </div>
            <Separator />
            <div>
              <h3 className="text-xl font-semibold mb-2 text-primary">Optimal Team Recommendation (including Size)</h3>
              <Textarea value={insights.optimalTeamRecommendation} readOnly rows={8} className="bg-secondary/30 border-secondary" />
            </div>
          </CardContent>
        </Card>
      )}
      
      {!isGeneratingInsights && !insights && form.formState.isSubmitted && (
         <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle />
              No Insights Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">
              Could not generate insights. This might be due to missing data, incorrect API key configuration for the selected team and provider, or an issue with the AI service. Please check your configurations and try again.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
