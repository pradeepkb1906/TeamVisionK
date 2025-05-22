
// src/ai/flows/team-insights.ts
'use server';

/**
 * @fileOverview AI-powered team data analysis for generating insights on team efficiency,
 * identifying bottlenecks, and recommending optimal team structures, considering user prompts.
 *
 * - analyzeTeamDataForInsights - Analyzes team data and provides insights.
 * - AnalyzeTeamDataInput - The input type for the analyzeTeamDataForInsights function.
 * - AnalyzeTeamDataOutput - The return type for the analyzeTeamDataForInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeTeamDataInputSchema = z.object({
  githubMetrics: z.string().describe('GitHub metrics data in JSON format.'),
  jiraMetrics: z.string().describe('Jira metrics data in JSON format.'),
  sonarqubeMetrics: z.string().describe('SonarQube metrics data in JSON format.'),
  teamComposition: z.string().describe('Team composition data in JSON format, including tech stack, band and rates.'),
  geminiApiKey: z.string().describe('Gemini API Key for AI analysis.'),
  openAiApiKey: z.string().describe('OpenAI API Key for AI analysis.'),
  claudeAiApiKey: z.string().describe('ClaudeAI API Key for AI analysis.'),
  teamName: z.string().describe('Team Name'),
  userPrompt: z.string().optional().describe('User-provided prompt for specific analysis focus or questions.'),
});
export type AnalyzeTeamDataInput = z.infer<typeof AnalyzeTeamDataInputSchema>;

const AnalyzeTeamDataOutputSchema = z.object({
  teamEfficiency: z.string().describe('Insights on team efficiency based on the provided data and user prompt.'),
  bottlenecks: z.string().describe('Identified bottlenecks within the team and its processes, considering user prompt.'),
  optimalTeamRecommendation: z.string().describe('Recommendations for an optimal team structure, including team size adjustments (increase/decrease with justification) based on the analysis and user prompt.'),
});
export type AnalyzeTeamDataOutput = z.infer<typeof AnalyzeTeamDataOutputSchema>;

export async function analyzeTeamDataForInsights(input: AnalyzeTeamDataInput): Promise<AnalyzeTeamDataOutput> {
  return analyzeTeamDataForInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeTeamDataForInsightsPrompt',
  input: {schema: AnalyzeTeamDataInputSchema},
  output: {schema: AnalyzeTeamDataOutputSchema},
  prompt: `You are an AI assistant tasked with analyzing team data to provide insights on efficiency, bottlenecks, and optimal structure.

  Analyze the provided data from GitHub, Jira, and SonarQube, along with the team composition.
  {{#if userPrompt}}
  Pay close attention to the following user-provided question or focus area:
  {{{userPrompt}}}
  {{/if}}

  Team Name: {{{teamName}}}

  GitHub Metrics:
  {{{githubMetrics}}}

  Jira Metrics:
  {{{jiraMetrics}}}

  SonarQube Metrics:
  {{{sonarqubeMetrics}}}

  Team Composition (Tech Stack, Band, Rates):
  {{{teamComposition}}}

  Based on all this data, and explicitly considering the user's prompt if provided, provide a detailed analysis.
  Your analysis should cover:
  1. Team Efficiency: Detailed insights on the team's overall efficiency.
  2. Bottlenecks: Specific bottlenecks identified in the team's processes.
  3. Optimal Team Recommendation: Recommendations for restructuring the team for optimal performance. This MUST include specific recommendations on whether the team size should be increased or decreased, along with a clear justification based on the data and user prompt.

  Ensure that your response is clear, concise, and provides specific, actionable recommendations for improvement.
  Output should be formatted as per the defined schema.
  `,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const analyzeTeamDataForInsightsFlow = ai.defineFlow(
  {
    name: 'analyzeTeamDataForInsightsFlow',
    inputSchema: AnalyzeTeamDataInputSchema,
    outputSchema: AnalyzeTeamDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
