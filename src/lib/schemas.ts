
import { z } from 'zod';
import { TECHNOLOGIES, BANDS, DB_TYPES } from './constants';

export const TeamSchema = z.object({
  name: z.string().min(1, "Team name is required."),
});
export type TeamFormData = z.infer<typeof TeamSchema>;

export const GithubRepoSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url().optional(),
  fullName: z.string().optional(), // e.g., "owner/repo-name"
});
export type GithubRepoData = z.infer<typeof GithubRepoSchema>;

export const GithubConfigSchema = z.object({
  teamId: z.string().min(1, "Team selection is required."),
  rootUrl: z.string().url("Invalid URL format.").default("https://github.com/"),
  accessToken: z.string().optional(),
  selectedRepos: z.array(GithubRepoSchema).optional().default([]),
});
export type GithubConfigFormData = z.infer<typeof GithubConfigSchema>;

export const TeamMemberSchema = z.object({
  teamId: z.string().min(1, "Team selection is required."),
  technology: z.enum(TECHNOLOGIES as [string, ...string[]], {
    errorMap: () => ({ message: "Please select a valid technology." }),
  }),
  band: z.enum(BANDS as [string, ...string[]], {
    errorMap: () => ({ message: "Please select a valid band." }),
  }),
  rate: z.preprocess(
    (val) => parseFloat(String(val)),
    z.number().positive("Rate must be a positive number.")
  ),
  numResources: z.preprocess(
    (val) => parseInt(String(val), 10),
    z.number().int().positive("Number of resources must be a positive integer.")
  ),
});
export type TeamMemberFormData = z.infer<typeof TeamMemberSchema>;

export const JiraConfigSchema = z.object({
  teamId: z.string().min(1, "Team selection is required."),
  projectName: z.string().min(1, "Project name or key is required."),
  accessKey: z.string().min(1, "Jira API Token (Access Key) is required."),
});
export type JiraConfigFormData = z.infer<typeof JiraConfigSchema>;

export const SonarQubeConfigSchema = z.object({
  teamId: z.string().min(1, "Team selection is required."),
  url: z.string().url("Invalid URL format."),
  accessKey: z.string().min(1, "Access key is required."),
});
export type SonarQubeConfigFormData = z.infer<typeof SonarQubeConfigSchema>;

export const BoomerangConfigSchema = z.object({
  teamId: z.string().min(1, "Team selection is required."),
  url: z.string().url("Invalid URL format."),
  accessKey: z.string().min(1, "Access key is required."),
});
export type BoomerangConfigFormData = z.infer<typeof BoomerangConfigSchema>;

export const ApiKeysSchema = z.object({
  teamId: z.string().min(1, "Team selection is required."),
  geminiApiKey: z.string().optional(),
  openAiApiKey: z.string().optional(),
  claudeAiApiKey: z.string().optional(),
});
export type ApiKeysFormData = z.infer<typeof ApiKeysSchema>;

export const DbConfigSchema = z.object({
  dbType: z.enum(DB_TYPES as [string, ...string[]]).default("sqlite"),
  dbPath: z.string().min(1, "DB Path is required.").default("./data/mydatabase.sqlite3"),
  dbName: z.string().min(1, "DB Name is required.").default("mydatabase"),
});
export type DbConfigFormData = z.infer<typeof DbConfigSchema>;

export const AiInsightRequestSchema = z.object({
  teamId: z.string().min(1, { message: "Team must be selected." }),
  llmProvider: z.enum(["gemini", "openai", "claudeai"], { message: "LLM Provider must be selected." }),
  userPrompt: z.string().optional(),
});
export type AiInsightRequestFormData = z.infer<typeof AiInsightRequestSchema>;

export const PushToRepoSchema = z.object({
  repoUrl: z.string().url({ message: "Invalid repository URL."}).min(1, "Repository URL is required."),
  accessToken: z.string().min(1, "Access token is required."),
});
export type PushToRepoFormData = z.infer<typeof PushToRepoSchema>;
