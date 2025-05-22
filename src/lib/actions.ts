
// src/lib/actions.ts
"use server";

import { z } from "zod";
import { analyzeTeamDataForInsights, type AnalyzeTeamDataInput, type AnalyzeTeamDataOutput } from "@/ai/flows/team-insights";
import type {
  TeamFormData,
  GithubConfigFormData,
  TeamMemberFormData,
  JiraConfigFormData,
  SonarQubeConfigFormData,
  BoomerangConfigFormData,
  ApiKeysFormData,
  DbConfigFormData,
  GithubRepoData,
  PushToRepoFormData,
} from "./schemas";
import {
  addTeamToDb,
  getTeamsFromDb,
  saveApiKeysToDb,
  getApiKeysFromDb,
  saveGithubConfigToDb,
  getGithubConfigFromDb,
  saveJiraConfigToDb,
  getJiraConfigFromDb,
  saveSonarQubeConfigToDb,
  getSonarQubeConfigFromDb,
  saveBoomerangConfigToDb,
  getBoomerangConfigFromDb,
  saveTeamMemberToDb,
  getTeamMembersFromDb,
  saveGithubTeamMetric,
  getGithubTeamMetricsFromDb,
  clearGithubTeamMetrics,
  saveJiraTeamMetricsToDb,
  getJiraTeamMetricsFromDb,
  saveSonarQubeTeamMetricsToDb,
  getSonarQubeTeamMetricsFromDb,
  saveDbConfigToDb,
  getDbConfigFromDb,
  type GithubMetricsPeriodData,
  type JiraTeamMetricsData,
  type SonarQubeMetrics,
  type SonarQubeTeamMetricsData,
} from "./db";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import tmp from 'tmp';

const execPromise = promisify(exec);
tmp.setGracefulCleanup();

const JIRA_FIXED_SERVER_URL = "https://jsw.ibm.com";
const JIRA_FIXED_USERNAME = "Pradeep.basavarajappa2@ibm.com";


const ESTIMATED_BYTES_PER_LINE = 50;
const CODE_EXTENSIONS_FOR_LOC_COUNT = ['.py', '.java', '.js', '.ts', '.cpp', '.c', '.h', '.html', '.css', '.go', '.rb', '.php', '.tsx', '.jsx', '.vue', '.svelte', '.mjs', '.cjs', '.cs', '.swift', '.kt', '.kts', '.rs', '.scala', '.pl', '.pm', '.lua', '.dart'];
const IGNORED_DIRS_FOR_LOC_COUNT = ['.git', 'node_modules', 'dist', 'build', 'target', 'out', 'vendor', 'coverage', '.next', '.nuxt', '.svelte-kit', 'venv', '.venv', 'Pods', 'Carthage', 'obj', 'bin', '.settings', '.vscode', '__pycache__', '.DS_Store'];


// Team Actions
export async function addTeam(formData: TeamFormData) {
  try {
    const teamId = uuidv4();
    const newTeam = await addTeamToDb(teamId, formData.name);
    return { success: true, data: newTeam, message: "Team added successfully." };
  } catch (error: any) {
    console.error("addTeam action failed:", error);
    return { success: false, message: error.message || "Failed to add team." };
  }
}

export async function getTeams() {
  try {
    const teams = await getTeamsFromDb();
    return teams;
  } catch (error: any) {
    console.error("getTeams action failed:", error);
    return [];
  }
}

// API Keys Actions
export async function saveApiKeys(formData: ApiKeysFormData) {
  try {
    await saveApiKeysToDb(formData);
    return { success: true, message: "API keys saved successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to save API keys." };
  }
}
export async function getApiKeys(teamId: string) {
  return getApiKeysFromDb(teamId);
}

// GitHub Config Actions
export async function saveGithubConfig(formData: GithubConfigFormData) {
  try {
    await saveGithubConfigToDb(formData);
    return { success: true, message: "GitHub configuration saved." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to save GitHub configuration." };
  }
}
export async function getGithubConfig(teamId: string): Promise<GithubConfigFormData | null> {
  const config = await getGithubConfigFromDb(teamId);
  if (config) {
    return {
      ...config,
      selectedRepos: config.selectedRepos || [],
    };
  }
  return null;
}


async function fetchGithubReposFromApi(apiUrl: string, token: string): Promise<GithubApiRepo[]> {
  if (!token) {
    throw new Error("GitHub Access Token is required to fetch repositories.");
  }
  let allRepos: GithubApiRepo[] = [];
  let nextPageUrl: string | null = apiUrl;
  console.log(`Fetching GitHub repos from initial URL: ${apiUrl}`);

  while (nextPageUrl) {
    console.log(`Fetching page: ${nextPageUrl}`);
    const response = await fetch(nextPageUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`GitHub API Error (${response.status}) for URL ${nextPageUrl}: ${errorBody}`);
      throw new Error(`Failed to fetch repositories from ${nextPageUrl}. Status: ${response.status}. Message: ${errorBody}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
        console.error(`GitHub API response for ${nextPageUrl} was not an array:`, data);
        throw new Error(`Unexpected response format from GitHub API for URL ${nextPageUrl}. Expected an array of repositories.`);
    }
    allRepos = allRepos.concat(data);

    const linkHeader = response.headers.get('Link');
    nextPageUrl = null;
    if (linkHeader) {
      const links = linkHeader.split(',');
      const nextLink = links.find(link => link.includes('rel="next"'));
      if (nextLink) {
        const match = nextLink.match(/<([^>]+)>/);
        if (match) {
          nextPageUrl = match[1];
        }
      }
    }
    console.log(`Fetched ${data.length} repos from this page. Total fetched so far: ${allRepos.length}. Next page: ${nextPageUrl || 'none'}`);
  }
  return allRepos;
}


export async function scanGithubRepos(teamId: string) {
  try {
    const config = await getGithubConfigFromDb(teamId);
    if (!config || !config.rootUrl || !config.accessToken) {
      return { success: false, message: "GitHub configuration (Root URL or Access Token) not found for this team. Please configure it first.", repos: [] };
    }

    const { rootUrl, accessToken } = config;
    const GITHUB_API_BASE = rootUrl.includes("api.github.com")
        ? rootUrl.split("/").slice(0,3).join("/")
        : (rootUrl.startsWith('https://github.com')
            ? 'https://api.github.com'
            : `${new URL(rootUrl).origin}/api/v3`); // For GHE

    const urlPathParts = new URL(rootUrl).pathname.split('/').filter(Boolean);

    let apiEndpointForRepoListing = "";
    const perPageQuery = "type=all&per_page=100"; // Fetch up to 100 repos per page

    if (rootUrl.includes("api.github.com/") && (rootUrl.includes("/repos") || rootUrl.includes("/user") || rootUrl.includes("/orgs"))) {
        apiEndpointForRepoListing = rootUrl.includes("?") ? `${rootUrl}&${perPageQuery}` : `${rootUrl}?${perPageQuery}`;
    }
    else if (urlPathParts.length > 0) {
        const orgOrUser = urlPathParts[urlPathParts.length - 1]; 
        let potentialOrgUrl = `${GITHUB_API_BASE}/orgs/${orgOrUser}/repos?${perPageQuery}`;
        try {
            const orgResponse = await fetch(potentialOrgUrl, { headers: { Authorization: `token ${accessToken}`}});
            if (orgResponse.ok) {
                apiEndpointForRepoListing = potentialOrgUrl;
            } else if (orgResponse.status === 404 || orgResponse.status === 403) { 
                 apiEndpointForRepoListing = `${GITHUB_API_BASE}/users/${orgOrUser}/repos?${perPageQuery}`;
            } else { 
                 throw new Error(`GitHub API error for orgs endpoint ${potentialOrgUrl}: ${orgResponse.status} - ${await orgResponse.text()}`);
            }
        } catch(e: any) {
            console.warn(`Org check failed for ${orgOrUser}, trying user endpoint. Error: ${e.message}`);
            apiEndpointForRepoListing = `${GITHUB_API_BASE}/users/${orgOrUser}/repos?${perPageQuery}`;
        }
    }
    else { 
         apiEndpointForRepoListing = `${GITHUB_API_BASE}/user/repos?${perPageQuery}`;
    }

    console.log(`Scanning GitHub repos from: ${apiEndpointForRepoListing}`);
    const reposFromApi = await fetchGithubReposFromApi(apiEndpointForRepoListing, accessToken);

    if (reposFromApi.length === 0) {
        return { success: true, message: `No repositories found for the configured URL: ${apiEndpointForRepoListing}. This could be due to permissions, an incorrect URL, or no repositories present.`, repos: [] };
    }

    const formattedRepos: GithubRepoData[] = reposFromApi.map(repo => ({
      id: String(repo.id),
      name: repo.name,
      url: repo.html_url,
      fullName: repo.full_name,
    }));

    return { success: true, repos: formattedRepos, message: `Found ${formattedRepos.length} repositories.` };

  } catch (error: any) {
    console.error("Error in scanGithubRepos action:", error);
    return { success: false, message: error.message || "An unexpected error occurred while scanning repositories.", repos: [] };
  }
}


async function fetchCommitDetails(repoFullName: string, commitSha: string, token: string, githubApiBase: string): Promise<GithubApiCommit | null> {
  const response = await fetch(`${githubApiBase}/repos/${repoFullName}/commits/${commitSha}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (!response.ok) {
    console.warn(`Failed to fetch commit details for ${repoFullName}#${commitSha}: ${response.status} ${await response.text()}`);
    return null;
  }
  return response.json();
}

async function countLinesInFile(filePath: string): Promise<number> {
    try {
        const content = await fs.readFile(filePath, { encoding: 'utf-8' });
        return content.split('\n').filter(line => line.trim() !== '').length; 
    } catch (e: any) {
        console.warn(`Could not read file ${filePath} for LOC count: ${e.message}`);
        return 0;
    }
}

async function calculateLocInDirectory(directory: string): Promise<{ totalLines: number; linesByLanguage: Record<string, number> }> {
    let totalLines = 0;
    const linesByLanguage: Record<string, number> = {}; 

    async function walk(currentPath: string) {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                const entryNameLower = entry.name.toLowerCase();

                if (entryNameLower.startsWith('.') || IGNORED_DIRS_FOR_LOC_COUNT.includes(entryNameLower)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await walk(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (CODE_EXTENSIONS_FOR_LOC_COUNT.includes(ext)) {
                        const lineCount = await countLinesInFile(fullPath);
                        totalLines += lineCount;
                        linesByLanguage[ext] = (linesByLanguage[ext] || 0) + lineCount;
                    }
                }
            }
        } catch (e: any) {
            console.warn(`Could not read directory ${currentPath} for LOC count: ${e.message}`);
        }
    }
    await walk(directory);
    return { totalLines, linesByLanguage };
}


export async function refreshGithubMetrics(teamId: string, repoIdentifiersToRefreshArg?: GithubRepoData[]) {
  let existingMetrics: Record<string, GithubMetricsPeriodData> = {};
  try {
    console.log(`refreshGithubMetrics called for team ${teamId}. Repos to refresh arg:`, repoIdentifiersToRefreshArg?.map(r => r.fullName));
    existingMetrics = await getGithubTeamMetricsFromDb(teamId);
    const githubConfig = await getGithubConfigFromDb(teamId);

    if (!githubConfig || !githubConfig.accessToken || !githubConfig.rootUrl) {
      const message = "GitHub configuration (Root URL or Access Token) not fully configured for this team.";
      console.warn(message);
      await saveGithubTeamMetric(teamId, "overall_snapshot", { ...existingMetrics["overall_snapshot"], info: { message }, apiLastRefreshed: new Date().toISOString() });
      return { success: false, message, data: { ...existingMetrics, "overall_snapshot": { ...existingMetrics["overall_snapshot"], info: { message } } } };
    }
    const { rootUrl, accessToken, selectedRepos: savedSelectedReposConfig } = githubConfig;
    const headers = { Authorization: `token ${accessToken}`, Accept: 'application/vnd.github.v3+json' };

    const GITHUB_API_BASE = rootUrl.includes("api.github.com")
        ? rootUrl.split("/").slice(0,3).join("/")
        : (rootUrl.startsWith('https://github.com')
            ? 'https://api.github.com'
            : `${new URL(rootUrl).origin}/api/v3`);

    let reposToProcessForMetrics: GithubRepoData[];
    if (repoIdentifiersToRefreshArg && repoIdentifiersToRefreshArg.length > 0) {
        reposToProcessForMetrics = repoIdentifiersToRefreshArg;
    } else if (savedSelectedReposConfig && savedSelectedReposConfig.length > 0) {
        reposToProcessForMetrics = savedSelectedReposConfig;
    } else {
      await clearGithubTeamMetrics(teamId);
      const message = "No repositories selected or configured for this team. GitHub metrics cleared.";
      console.info(message);
      await saveGithubTeamMetric(teamId, "overall_snapshot", { info: { message }, apiLastRefreshed: new Date().toISOString() });
      return { success: true, message, data: { "overall_snapshot": { info: { message } } } };
    }

    if (reposToProcessForMetrics.length === 0) {
        await clearGithubTeamMetrics(teamId);
        const message = "No repositories to process after selection logic. GitHub metrics cleared.";
        console.info(message);
        await saveGithubTeamMetric(teamId, "overall_snapshot", { info: { message }, apiLastRefreshed: new Date().toISOString() });
        return { success: true, message, data: { "overall_snapshot": { info: { message } } } };
    }
    console.log(`Refreshing GitHub metrics for ${reposToProcessForMetrics.length} repos. Team: ${teamId}. API Base: ${GITHUB_API_BASE}`);
    console.log("Repos to process:", reposToProcessForMetrics.map(r => r.fullName || r.name));


    const overallApiTimestamp = new Date().toISOString();
    let overallApiTotalBytes = 0;
    const overallApiBytesByLanguage: Record<string, number> = {};
    const overallLatestTags: { name: string; date: string }[] = [];
    const overallApiProcessedRepoFullNames: string[] = [];

    for (const repoData of reposToProcessForMetrics) {
      if (!repoData.fullName) {
        console.warn(`Skipping API metrics for repo due to missing fullName: ${JSON.stringify(repoData)}`);
        continue;
      }
      overallApiProcessedRepoFullNames.push(repoData.fullName);
      try {
        const langResponse = await fetch(`${GITHUB_API_BASE}/repos/${repoData.fullName}/languages`, { headers });
        if (langResponse.ok) {
          const languages = await langResponse.json();
          for (const lang in languages) {
            overallApiBytesByLanguage[lang] = (overallApiBytesByLanguage[lang] || 0) + languages[lang];
            overallApiTotalBytes += languages[lang];
          }
        } else {
          console.warn(`Failed to fetch languages for ${repoData.fullName}: ${langResponse.status} ${await langResponse.text()}`);
        }
      } catch (e: any) {
         console.warn(`Error fetching languages for ${repoData.fullName}: ${e.message}`);
      }

      try {
        const tagsResponse = await fetch(`${GITHUB_API_BASE}/repos/${repoData.fullName}/tags?per_page=5`, { headers });
        if (tagsResponse.ok) {
          const tags: GithubApiTag[] = await tagsResponse.json();
          for (const tag of tags) {
            try {
                const commitDetail = await fetchCommitDetails(repoData.fullName, tag.commit.sha, accessToken, GITHUB_API_BASE);
                overallLatestTags.push({
                name: `${repoData.name}/${tag.name}`,
                date: commitDetail?.commit.committer?.date || new Date().toISOString()
                });
            } catch (commitDetailError: any) {
                console.warn(`Could not fetch commit details for tag ${tag.name} in repo ${repoData.fullName}: ${commitDetailError.message}`);
                overallLatestTags.push({ name: `${repoData.name}/${tag.name}`, date: new Date().toISOString() });
            }
          }
        } else {
           console.warn(`Failed to fetch tags for ${repoData.fullName}: ${tagsResponse.status} ${await tagsResponse.text()}`);
        }
      } catch (e: any) {
        console.warn(`Error fetching tags for ${repoData.fullName}: ${e.message}`);
      }
    }
    overallLatestTags.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const estimatedTotalLinesFromApi = Math.round(overallApiTotalBytes / ESTIMATED_BYTES_PER_LINE);
    const estimatedLinesByLangFromApi: Record<string, number> = {};
    for (const lang in overallApiBytesByLanguage) {
      estimatedLinesByLangFromApi[lang] = Math.round(overallApiBytesByLanguage[lang] / ESTIMATED_BYTES_PER_LINE);
    }

    let overallClonedActualTotalLines = 0;
    const overallClonedActualLinesByLanguage: Record<string, number> = {};
    const overallClonedProcessedRepoFullNames: string[] = [];
    let clonedLoCTimestamp: string | undefined = undefined;

    for (const repo of reposToProcessForMetrics) {
        if (!repo.url || !repo.fullName) {
            console.warn(`Skipping cloned LoC count for repo due to missing URL or fullName: ${JSON.stringify(repo)}`);
            continue;
        }
        const repoCloneUrl = repo.url.startsWith('https://') && accessToken
            ? repo.url.replace('https://', `https://x-access-token:${accessToken}@`)
            : repo.url;

        let tempDirObj: tmp.DirResult | null = null;
        try {
            tempDirObj = tmp.dirSync({ unsafeCleanup: true, prefix: 'gh-loc-' });
            const tempRepoPath = tempDirObj.name;
            console.log(`Cloning ${repo.fullName} (from ${repo.url}) to ${tempRepoPath} for LoC count...`);

            await execPromise(`git clone --depth 1 ${repoCloneUrl} .`, { cwd: tempRepoPath, timeout: 300000 });
            console.log(`Cloned ${repo.fullName}. Counting LoC...`);

            const locData = await calculateLocInDirectory(tempRepoPath);
            overallClonedActualTotalLines += locData.totalLines;
            for (const langExt in locData.linesByLanguage) {
                overallClonedActualLinesByLanguage[langExt] = (overallClonedActualLinesByLanguage[langExt] || 0) + locData.linesByLanguage[langExt];
            }
            overallClonedProcessedRepoFullNames.push(repo.fullName);
            if (!clonedLoCTimestamp) clonedLoCTimestamp = new Date().toISOString();
            console.log(`Finished LoC for ${repo.fullName}: ${locData.totalLines} lines.`);
        } catch (cloneOrCountError: any) {
            console.error(`Error processing ${repo.fullName} for cloned LoC: ${cloneOrCountError.message}. Stdout: ${cloneOrCountError.stdout}. Stderr: ${cloneOrCountError.stderr}.`);
        } finally {
            if (tempDirObj) {
                try {
                  tempDirObj.removeCallback();
                } catch (cleanupError: any) {
                    console.error(`Error cleaning up temp directory ${tempDirObj.name}: ${cleanupError.message}`);
                }
            }
        }
    }

    const overallSnapshotData: GithubMetricsPeriodData = {
      apiTotalBytes_current: overallApiTotalBytes,
      apiBytesByLanguage_current: overallApiBytesByLanguage,
      apiEstimatedTotalLines_current: estimatedTotalLinesFromApi,
      apiEstimatedLinesByLanguage_current: estimatedLinesByLangFromApi,
      apiProcessedRepoFullNames: overallApiProcessedRepoFullNames,
      apiLastRefreshed: overallApiTimestamp,

      clonedActualTotalLines: overallClonedActualTotalLines,
      clonedActualLinesByLanguage: overallClonedActualLinesByLanguage,
      clonedProcessedRepoFullNames: overallClonedProcessedRepoFullNames,
      clonedLoCLastRefreshed: clonedLoCTimestamp,

      latestTags: overallLatestTags.slice(0, 10),
    };
    await saveGithubTeamMetric(teamId, "overall_snapshot", overallSnapshotData);

    const periods = [
      { key: "7days", days: 7 }, { key: "30days", days: 30 }, { key: "60days", days: 60 },
      { key: "90days", days: 90 }, { key: "180days", days: 180 }, { key: "365days", days: 365 },
    ];
    const periodicMetricsTimestamp = new Date().toISOString();

    for (const period of periods) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - period.days);
      let linesAddedInPeriod = 0;
      const uniqueCommittersInPeriod = new Set<string>();
      const periodApiProcessedRepoFullNames: string[] = [];

      for (const repo of reposToProcessForMetrics) {
         if (!repo.fullName) {
            console.warn(`Skipping periodic API metrics for repo due to missing fullName (period: ${period.key}): ${JSON.stringify(repo)}`);
            continue;
        }
        periodApiProcessedRepoFullNames.push(repo.fullName);
        try {
          let commitsUrl = `${GITHUB_API_BASE}/repos/${repo.fullName}/commits?since=${startDate.toISOString()}&until=${endDate.toISOString()}&per_page=100`;
          let pageCommits: GithubApiCommit[] = [];

          do {
            const commitsResponse = await fetch(commitsUrl, { headers });
            if (!commitsResponse.ok) {
               console.warn(`Failed to fetch commits page for ${repo.fullName} (URL: ${commitsUrl}, Period: ${period.key}): ${commitsResponse.status} ${await commitsResponse.text()}`);
               pageCommits = [];
               break;
            }
            const fetchedPageCommitsData: GithubApiCommit[] | { message?: string } = await commitsResponse.json();

            if (!Array.isArray(fetchedPageCommitsData)) {
              if (typeof fetchedPageCommitsData === 'object' && (fetchedPageCommitsData as any).message && ((fetchedPageCommitsData as any).message.includes("empty") || (fetchedPageCommitsData as any).message.includes("Git Repository is empty."))) {
                console.log(`No commits found for ${repo.fullName} in period ${period.key} or repo is empty.`);
              } else if (typeof fetchedPageCommitsData === 'object' && (fetchedPageCommitsData as any).message) {
                console.warn(`API message for ${repo.fullName} commits (Period: ${period.key}): ${(fetchedPageCommitsData as any).message}`);
              } else {
                console.warn(`Commits response for ${repo.fullName} (Period: ${period.key}) was not an array:`, fetchedPageCommitsData);
              }
              pageCommits = [];
              break;
            }
            pageCommits = fetchedPageCommitsData;

            for (const commit of pageCommits) {
              const committerLogin = commit.author?.login || commit.committer?.login || commit.commit?.author?.name || commit.commit?.committer?.name || 'unknown_committer';
              if (committerLogin !== 'unknown_committer') {
                uniqueCommittersInPeriod.add(committerLogin);
              }

              let commitStats = commit.stats;
              if (!commitStats && commit.sha) {
                  try {
                    const detailedCommit = await fetchCommitDetails(repo.fullName, commit.sha, accessToken, GITHUB_API_BASE);
                    commitStats = detailedCommit?.stats;
                  } catch (detailFetchError: any) {
                    console.warn(`Could not fetch commit details for ${repo.fullName}#${commit.sha}: ${detailFetchError.message}`);
                  }
              }
              if (commitStats?.additions) {
                  linesAddedInPeriod += commitStats.additions;
              }
            }

            const linkHeader = commitsResponse.headers.get('Link');
            commitsUrl = "";
            if (linkHeader) {
                const links = linkHeader.split(',');
                const nextLink = links.find(link => link.includes('rel="next"'));
                if (nextLink) {
                    const match = nextLink.match(/<([^>]+)>/);
                    if (match) commitsUrl = match[1];
                }
            }
          } while (commitsUrl && pageCommits.length > 0);

        } catch (e: any) {
          console.warn(`Error fetching commits for ${repo.fullName} for period ${period.key}: ${e.message}`);
        }
      }

      const periodData: GithubMetricsPeriodData = {
        linesAdded_period: linesAddedInPeriod,
        uniqueCommitters_period: uniqueCommittersInPeriod.size,
        uniqueCommitterNames_period: Array.from(uniqueCommittersInPeriod),
        periodStartDate: startDate.toISOString(),
        periodEndDate: endDate.toISOString(),
        periodLastRefreshed: periodicMetricsTimestamp,
        apiProcessedRepoFullNames: periodApiProcessedRepoFullNames,
      };
      await saveGithubTeamMetric(teamId, period.key, periodData);
    }

    const updatedMetrics = await getGithubTeamMetricsFromDb(teamId);
    console.log(`Successfully refreshed GitHub metrics for team ${teamId}.`);
    return { success: true, data: updatedMetrics, message: "GitHub metrics (API & Cloned LoC) refreshed and saved." };

  } catch (error: any)
{
    console.error(`Critical error in refreshGithubMetrics for team ${teamId}:`, error);
    let currentMetricsReturn = existingMetrics;
    if (Object.keys(currentMetricsReturn).length === 0) {
      try {
        currentMetricsReturn = await getGithubTeamMetricsFromDb(teamId);
      } catch (dbError: any) {
        console.error(`Failed to get existing metrics after critical error for team ${teamId}:`, dbError);
        currentMetricsReturn = { "overall_snapshot": { info: { message: `Refresh failed, and could not retrieve previous metrics: ${dbError.message}` }}};
      }
    }
    const errorMessage = error.message || "An unexpected error occurred while refreshing GitHub metrics.";
    try {
        const overall = currentMetricsReturn["overall_snapshot"] || {};
        await saveGithubTeamMetric(teamId, "overall_snapshot", { ...overall, info: { message: `Refresh failed: ${errorMessage}` }, apiLastRefreshed: new Date().toISOString() });
    } catch (saveError: any) {
        console.error(`Failed to save error info to DB for team ${teamId}:`, saveError);
    }
    return {
        success: false,
        message: errorMessage,
        data: { ...currentMetricsReturn, "overall_snapshot": { ...(currentMetricsReturn["overall_snapshot"] || {}), info: { message: `Refresh failed: ${errorMessage}` } } }
    };
  }
}

export async function getGithubMetrics(teamId: string): Promise<Record<string, GithubMetricsPeriodData>> {
    const metrics = await getGithubTeamMetricsFromDb(teamId);
    const defaultOverall: GithubMetricsPeriodData = {
        info: { message: "No GitHub metrics data available. Configure GitHub settings and refresh." },
        apiTotalBytes_current: 0,
        apiBytesByLanguage_current: {},
        apiEstimatedTotalLines_current: 0,
        apiEstimatedLinesByLanguage_current: {},
        apiProcessedRepoFullNames: [],
        apiLastRefreshed: "N/A",
        clonedActualTotalLines: 0,
        clonedActualLinesByLanguage: {},
        clonedProcessedRepoFullNames: [],
        clonedLoCLastRefreshed: "N/A",
        latestTags: [],
        linesAdded_period:0,
        uniqueCommitters_period:0,
        uniqueCommitterNames_period: [],
        periodStartDate: "N/A",
        periodEndDate: "N/A",
        periodLastRefreshed: "N/A",
    };

    const periods = ["7days", "30days", "60days", "90days", "180days", "365days"];

    const resultMetrics: Record<string, GithubMetricsPeriodData> = {
        "overall_snapshot": metrics["overall_snapshot"] || defaultOverall,
    };

    periods.forEach(p => {
      const defaultPeriod: GithubMetricsPeriodData = {
        info: { message: `No data for ${p}. Refresh metrics.`},
        linesAdded_period: 0,
        uniqueCommitters_period: 0,
        uniqueCommitterNames_period: [],
        periodStartDate: "N/A",
        periodEndDate: "N/A",
        periodLastRefreshed: "N/A",
        apiProcessedRepoFullNames: [],
      };
      resultMetrics[p] = metrics[p] || defaultPeriod;
    });

    for (const key in resultMetrics) {
        const data = resultMetrics[key];
        if (data) {
          resultMetrics[key] = {
              info: data.info,
              apiTotalBytes_current: data.apiTotalBytes_current || 0,
              apiBytesByLanguage_current: data.apiBytesByLanguage_current || {},
              apiEstimatedTotalLines_current: data.apiEstimatedTotalLines_current || 0,
              apiEstimatedLinesByLanguage_current: data.apiEstimatedLinesByLanguage_current || {},
              apiProcessedRepoFullNames: data.apiProcessedRepoFullNames || [],
              apiLastRefreshed: data.apiLastRefreshed || "N/A",
              clonedActualTotalLines: data.clonedActualTotalLines || 0,
              clonedActualLinesByLanguage: data.clonedActualLinesByLanguage || {},
              clonedProcessedRepoFullNames: data.clonedProcessedRepoFullNames || [],
              clonedLoCLastRefreshed: data.clonedLoCLastRefreshed || "N/A",
              latestTags: data.latestTags || [],
              linesAdded_period: data.linesAdded_period || 0,
              uniqueCommitters_period: data.uniqueCommitters_period || 0,
              uniqueCommitterNames_period: data.uniqueCommitterNames_period || [],
              periodStartDate: data.periodStartDate || "N/A",
              periodEndDate: data.periodEndDate || "N/A",
              periodLastRefreshed: data.periodLastRefreshed || "N/A",
          };
        }
    }
    return resultMetrics;
}

// Jira Constants
const JIRA_API_PATH = "/rest/api/2/search";

async function _fetchAndSaveJiraMetrics(
  teamId: string,
  projectName: string,
  jiraServerUrl: string,
  jiraUsername: string,
  apiToken: string,
) {
  console.log(`Starting Jira metrics fetch for team ${teamId}, project ${projectName}.`);

  if (!jiraServerUrl || !jiraUsername || !apiToken) {
    const missing = [];
    if (!jiraServerUrl) missing.push("Jira Server URL");
    if (!jiraUsername) missing.push("Jira Username");
    if (!apiToken) missing.push("Jira API Token");
    const errorMessage = `Jira configuration incomplete: ${missing.join(', ')} missing for team ${teamId}. Cannot fetch metrics. Please configure it fully in the Jira tab.`;
    console.error(errorMessage);
    await saveJiraTeamMetricsToDb(teamId, {
      totalIssues: 0, issuesByType: {}, issuesByAssignee: {}, issuesByStatus: {},
      issuesByLabel: {}, issuesByCategory: {}, averageIssueAgeDays: 0,
      lastRefreshed: new Date().toISOString(), info: { message: errorMessage }
    });
    throw new Error(errorMessage);
  }

  console.log(`Using Jira Server: ${jiraServerUrl}, Username: ${jiraUsername}, Token: ${apiToken ? 'Provided' : 'MISSING!'}`);

  const jiraInstanceBaseUrl = new URL(jiraServerUrl).origin;
  const encodedAuth = Buffer.from(`${jiraUsername}:${apiToken}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${encodedAuth}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  const jql = `project = "${projectName.replace(/"/g, '\\"')}" ORDER BY created DESC`;
  const fields = "summary,issuetype,assignee,status,labels,components,created,updated,resolutiondate,priority,reporter,fixVersions,versions";
  const maxResultsPerPage = 100;
  let startAt = 0;
  let isLastPage = false;
  let allIssues: JiraApiIssue[] = [];

  console.log(`Using Jira API Path: ${JIRA_API_PATH}`);

  while (!isLastPage) {
    const searchUrl = `${jiraInstanceBaseUrl}${JIRA_API_PATH}?jql=${encodeURIComponent(jql)}&fields=${fields}&startAt=${startAt}&maxResults=${maxResultsPerPage}`;
    console.log(`Requesting Jira issues from: ${searchUrl} (Using Token: ${apiToken ? 'Present' : 'MISSING!'})`);

    try {
      const response = await fetch(searchUrl, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        let detail = errorText;
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.errorMessages && errorJson.errorMessages.length > 0) {
                detail = errorJson.errorMessages.join('; ');
            } else if (errorJson.message) {
                detail = errorJson.message;
            }
        } catch (parseError) { /* Keep original errorText if not JSON */ }

        const maskedToken = apiToken ? `****${apiToken.slice(-4)}` : "NOT PROVIDED";
        const authUsed = `Username='${jiraUsername}', API Token='${maskedToken}'`;
        const errorMessage = `Jira API request failed for project "${projectName}" (Status: ${response.status}). URL: ${searchUrl}. Auth Used: ${authUsed}. Details: ${detail.substring(0, 500)}. Check credentials, permissions, and project name.`;
        console.error(errorMessage);
         await saveJiraTeamMetricsToDb(teamId, {
            totalIssues: 0, issuesByType: {}, issuesByAssignee: {}, issuesByStatus: {},
            issuesByLabel: {}, issuesByCategory: {}, averageIssueAgeDays: 0,
            lastRefreshed: new Date().toISOString(), info: { message: `Jira API Error (${response.status}): ${detail.substring(0, 500)}` }
        });
        throw new Error(errorMessage);
      }

      const pageData = await response.json();

      if (!pageData.issues || !Array.isArray(pageData.issues)) {
         console.warn(`Jira API response for ${searchUrl} did not contain an 'issues' array. Response:`, pageData);
         if (pageData.total > 0 && pageData.total !== allIssues.length) {
            const msg = `Jira API response for project "${projectName}" was malformed. Expected 'issues' array but not found, though 'total' is ${pageData.total}. Fetched ${allIssues.length}.`;
            await saveJiraTeamMetricsToDb(teamId, {
                 totalIssues: allIssues.length, issuesByType: {}, issuesByAssignee: {}, issuesByStatus: {},
                 issuesByLabel: {}, issuesByCategory: {}, averageIssueAgeDays: 0,
                 lastRefreshed: new Date().toISOString(), info: { message: msg }
            });
            throw new Error(msg);
         } else {
             isLastPage = true;
             break;
         }
      }

      allIssues = allIssues.concat(pageData.issues);
      startAt += pageData.issues.length;
      isLastPage = startAt >= pageData.total || pageData.issues.length === 0;
      console.log(`Fetched ${allIssues.length} / ${pageData.total || 0} Jira issues for ${projectName}...`);
    } catch (error: any) {
      console.error(`Error fetching Jira page for ${projectName}: ${error.message}`);
      throw error;
    }
  }

  console.log(`Total Jira issues fetched for project ${projectName}: ${allIssues.length}`);

  const metrics: JiraTeamMetricsData = {
    totalIssues: allIssues.length,
    issuesByType: {},
    issuesByAssignee: {},
    issuesByStatus: {},
    issuesByLabel: {},
    issuesByCategory: {},
    averageIssueAgeDays: 0,
    lastRefreshed: new Date().toISOString(),
  };

  let totalAgeInMilliseconds = 0;
  const now = Date.now();

  for (const issue of allIssues) {
    const issueTypeName = issue.fields.issuetype?.name || "N/A";
    metrics.issuesByType[issueTypeName] = (metrics.issuesByType[issueTypeName] || 0) + 1;

    const assigneeName = issue.fields.assignee?.displayName || "Unassigned";
    metrics.issuesByAssignee[assigneeName] = (metrics.issuesByAssignee[assigneeName] || 0) + 1;

    const statusName = issue.fields.status?.name || "N/A";
    metrics.issuesByStatus[statusName] = (metrics.issuesByStatus[statusName] || 0) + 1;

    (issue.fields.labels || []).forEach(label => {
      metrics.issuesByLabel[label] = (metrics.issuesByLabel[label] || 0) + 1;
    });

    (issue.fields.components || []).forEach(component => {
      const componentName = component.name || "N/A";
      metrics.issuesByCategory[componentName] = (metrics.issuesByCategory[componentName] || 0) + 1;
    });

    const createdDate = new Date(issue.fields.created).getTime();
    totalAgeInMilliseconds += (now - createdDate);
  }

  if (metrics.totalIssues > 0) {
    metrics.averageIssueAgeDays = totalAgeInMilliseconds / metrics.totalIssues / (1000 * 60 * 60 * 24);
  }

  await saveJiraTeamMetricsToDb(teamId, metrics);
  console.log(`Jira metrics saved for team ${teamId}, project ${projectName}.`);
}

// Jira Config Actions
export async function saveJiraConfig(formData: JiraConfigFormData) {
   try {
    // Use the hardcoded server URL and username, but the accessKey and projectName from the form
    await saveJiraConfigToDb({
        teamId: formData.teamId,
        projectName: formData.projectName,
        url: JIRA_FIXED_SERVER_URL,
        username: JIRA_FIXED_USERNAME,
        accessKey: formData.accessKey,
    });
    await _fetchAndSaveJiraMetrics(
        formData.teamId,
        formData.projectName,
        JIRA_FIXED_SERVER_URL,
        JIRA_FIXED_USERNAME,
        formData.accessKey
    );
    return { success: true, message: "Jira configuration saved and metrics refreshed." };
  } catch (error: any) {
    console.error("Error in saveJiraConfig or _fetchAndSaveJiraMetrics:", error);
    return { success: false, message: error.message || "Failed to save Jira configuration or refresh metrics." };
  }
}

export async function getJiraConfig(teamId: string): Promise<JiraConfigFormData | null> {
  const config = await getJiraConfigFromDb(teamId);
  if (config) {
    return {
      teamId: config.teamId,
      projectName: config.projectName || "",
      // URL and username are fixed, but accessKey is from DB
      url: JIRA_FIXED_SERVER_URL,
      username: JIRA_FIXED_USERNAME,
      accessKey: config.accessKey || "",
    };
  }
  // If no config for team, still return fixed URL/Username so form can display them
  return {
    teamId: teamId,
    projectName: "",
    url: JIRA_FIXED_SERVER_URL,
    username: JIRA_FIXED_USERNAME,
    accessKey: ""
  };
}


async function _fetchAndSaveSonarQubeMetrics(teamId: string, config: SonarQubeConfigFormData): Promise<void> {
  const { url: sonarUrl, accessKey } = config;
  if (!sonarUrl || !accessKey) {
    const errorMsg = `SonarQube URL or Access Key not configured for team ${teamId}. Cannot fetch metrics.`;
    console.error(errorMsg);
    await saveSonarQubeTeamMetricsToDb(teamId, {
      projectKey: "N/A",
      lastRefreshed: new Date().toISOString(),
      info: { message: errorMsg }
    });
    throw new Error(errorMsg);
  }

  const baseUrl = new URL(sonarUrl).origin;
  let projectKey = "";

  try {
    const urlParams = new URL(sonarUrl).searchParams;
    projectKey = urlParams.get('id') || urlParams.get('key') || urlParams.get('project') || "";
  } catch (e) {
    console.warn("Could not parse project key from SonarQube URL, will try to fetch all projects if URL is a base URL.", e);
  }

  if (!projectKey) {
     console.log(`No specific project key found in SonarQube URL for team ${teamId}. Attempting to list projects...`);
     try {
        const projectsListUrl = `${baseUrl}/api/projects/search`;
        const authListHeader = 'Basic ' + Buffer.from(accessKey + ':').toString('base64');
        const projectsResponse = await fetch(projectsListUrl, { headers: { 'Authorization': authListHeader } });
        if (!projectsResponse.ok) {
            const errText = await projectsResponse.text();
            throw new Error(`Failed to list SonarQube projects: ${projectsResponse.status} - ${errText}`);
        }
        const projectsData = await projectsResponse.json();
        if (projectsData.components && projectsData.components.length > 0) {
            projectKey = projectsData.components[0].key;
            console.log(`Using first project found: ${projectKey} for team ${teamId}`);
        } else {
            const errorMsg = `No project key found in SonarQube URL and no projects found via API for team ${teamId}. URL used for listing: ${projectsListUrl}`;
            console.error(errorMsg);
            await saveSonarQubeTeamMetricsToDb(teamId, { projectKey, lastRefreshed: new Date().toISOString(), info: {message: errorMsg}});
            throw new Error(errorMsg);
        }
     } catch (listError: any) {
        const errorMsg = `Failed to determine SonarQube project key for team ${teamId}: ${listError.message}`;
        console.error(errorMsg);
        await saveSonarQubeTeamMetricsToDb(teamId, { projectKey, lastRefreshed: new Date().toISOString(), info: {message: errorMsg}});
        throw listError;
     }
  }

  const metricKeys = [
    'coverage', 'bugs', 'vulnerabilities', 'code_smells', 'sqale_index',
    'alert_status', 'security_rating', 'reliability_rating', 'sqale_rating'
  ].join(',');

  const apiUrl = `${baseUrl}/api/measures/component?component=${projectKey}&metricKeys=${metricKeys}`;
  const authHeader = 'Basic ' + Buffer.from(accessKey + ':').toString('base64');

  console.log(`Fetching SonarQube metrics for project ${projectKey} from ${apiUrl}`);

  try {
    const response = await fetch(apiUrl, { headers: { 'Authorization': authHeader } });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SonarQube API Error (${response.status}) for project ${projectKey}: ${errorText}`);
      const msg = `SonarQube API Error (${response.status}) for project ${projectKey}: ${errorText.substring(0, 200)}`;
      await saveSonarQubeTeamMetricsToDb(teamId, { projectKey, lastRefreshed: new Date().toISOString(), info: { message: msg } });
      throw new Error(msg);
    }

    const data = await response.json();
    const measures = data.component?.measures || [];
    const metricsResult: SonarQubeMetrics = { projectKey };

    measures.forEach((measure: { metric: string; value?: string; period?: { value: string } }) => {
      const val = measure.value ?? measure.period?.value;
      if (val === undefined) return;

      switch (measure.metric) {
        case 'coverage': metricsResult.coverage = parseFloat(val); break;
        case 'bugs': metricsResult.bugs = parseInt(val, 10); break;
        case 'vulnerabilities': metricsResult.vulnerabilities = parseInt(val, 10); break;
        case 'code_smells': metricsResult.codeSmells = parseInt(val, 10); break;
        case 'sqale_index': metricsResult.technicalDebtHours = parseFloat(val) / 60; break;
        case 'alert_status': metricsResult.qualityGateStatus = val; break;
        case 'security_rating': metricsResult.securityRating = val; break;
        case 'reliability_rating': metricsResult.reliabilityRating = val; break;
        case 'sqale_rating': metricsResult.maintainabilityRating = val; break;
      }
    });

    await saveSonarQubeTeamMetricsToDb(teamId, {
      ...metricsResult,
      lastRefreshed: new Date().toISOString()
    });
    console.log(`SonarQube metrics saved for team ${teamId}, project ${projectKey}.`);

  } catch (error: any) {
    console.error(`Error fetching or processing SonarQube metrics for team ${teamId}, project ${projectKey}:`, error);
    const msg = `Error fetching SonarQube metrics: ${error.message.substring(0,200)}`;
    await saveSonarQubeTeamMetricsToDb(teamId, { projectKey, lastRefreshed: new Date().toISOString(), info: { message: msg } });
    throw error;
  }
}


// SonarQube Config Actions
export async function saveSonarQubeConfig(formData: SonarQubeConfigFormData) {
  try {
    await saveSonarQubeConfigToDb(formData);
    await _fetchAndSaveSonarQubeMetrics(formData.teamId, formData);
    return { success: true, message: "SonarQube configuration saved and metrics refreshed." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to save SonarQube configuration or refresh metrics." };
  }
}
export async function getSonarQubeConfig(teamId: string) {
  return getSonarQubeConfigFromDb(teamId);
}

// Boomerang Config Actions
export async function saveBoomerangConfig(formData: BoomerangConfigFormData) {
  try {
    await saveBoomerangConfigToDb(formData);
    console.log(`Boomerang config saved for team ${formData.teamId}. Metrics refresh would happen here.`);
    return { success: true, message: "Boomerang configuration saved." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to save Boomerang configuration." };
  }
}
export async function getBoomerangConfig(teamId: string) {
  return getBoomerangConfigFromDb(teamId);
}

// Team Member Actions
export async function saveTeamMember(formData: TeamMemberFormData) {
  try {
    const newMember = await saveTeamMemberToDb(formData);
    return { success: true, data: newMember, message: "Team member saved." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to save team member." };
  }
}
export async function getTeamMembers(teamId: string) {
  return getTeamMembersFromDb(teamId);
}

// DB Config Action
export async function saveDbConfig(formData: DbConfigFormData) {
  try {
    await saveDbConfigToDb(formData);
    return { success: true, message: "Database configuration saved to primary database." };
  } catch (error: any) {
    console.error("saveDbConfig action failed:", error);
    return { success: false, message: error.message || "Failed to save database configuration." };
  }
}

export async function getDbConfig(): Promise<DbConfigFormData | null> {
  try {
    const config = await getDbConfigFromDb();
    return config;
  } catch (error: any) {
    console.error("getDbConfig action failed:", error);
    return null;
  }
}


// AI Insights Action
export async function generateTeamInsights(
  teamId: string,
  llmProvider: "gemini" | "openai" | "claudeai",
  userPrompt?: string,
): Promise<{ success: boolean; data?: AnalyzeTeamDataOutput; error?: string }> {
  try {
    const teams = await getTeamsFromDb();
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      return { success: false, error: "Team not found." };
    }

    const apiKeysConfig = await getApiKeysFromDb(teamId);
    if (!apiKeysConfig) {
      return { success: false, error: "AI API keys for this team not found." };
    }

    let apiKey = "";
    switch (llmProvider) {
      case "gemini":
        apiKey = apiKeysConfig.geminiApiKey || "";
        break;
      case "openai":
        apiKey = apiKeysConfig.openAiApiKey || "";
        break;
      case "claudeai":
        apiKey = apiKeysConfig.claudeAiApiKey || "";
        break;
      default:
        return { success: false, error: "Invalid LLM provider specified." };
    }

    if (!apiKey) {
      return { success: false, error: `${llmProvider} API key not configured for this team.`};
    }

    const teamMembers = await getTeamMembersFromDb(teamId);
    const teamCompositionData = JSON.stringify(teamMembers.length > 0 ? teamMembers : { info: "No team composition data available." });

    const githubMetricsDataDb = await getGithubTeamMetricsFromDb(teamId);
    const githubOverallSnapshot = githubMetricsDataDb["overall_snapshot"] || { info: { message: "No GitHub overall metrics available." }};
    const githubMetricsForAI = JSON.stringify(githubOverallSnapshot);

    const jiraMetricsDataDb = await getJiraTeamMetricsFromDb(teamId);
    const jiraMetricsForAI = JSON.stringify(jiraMetricsDataDb || { info: { message: "No Jira data available for this team." }});

    const sonarqubeMetricsDataDb = await getSonarQubeTeamMetricsFromDb(teamId);
    const sonarqubeMetricsForAI = JSON.stringify(sonarqubeMetricsDataDb || { info: { message: "No SonarQube data available for this team." } });


    const aiInput: AnalyzeTeamDataInput = {
      teamName: team.name,
      githubMetrics: githubMetricsForAI,
      jiraMetrics: jiraMetricsForAI,
      sonarqubeMetrics: sonarqubeMetricsForAI,
      teamComposition: teamCompositionData,
      geminiApiKey: llmProvider === "gemini" ? apiKey : "not_selected",
      openAiApiKey: llmProvider === "openai" ? apiKey : "not_selected",
      claudeAiApiKey: llmProvider === "claudeai" ? apiKey : "not_selected",
      userPrompt: userPrompt || "",
    };

    const insights = await analyzeTeamDataForInsights(aiInput);
    return { success: true, data: insights };

  } catch (error: any) {
    console.error("Error generating team insights:", error);
    return { success: false, error: error.message || "Failed to generate insights." };
  }
}


// Metrics Refresh Actions

export async function refreshJiraMetrics(teamId: string) {
  try {
    const config = await getJiraConfig(teamId);
    if (!config || !config.projectName || !config.accessKey || !config.url || !config.username) {
      const errorMsg = "Jira configuration (Project Name, URL, Username, or API Token) not fully set for this team. Cannot refresh metrics.";
      console.error(errorMsg);
      await saveJiraTeamMetricsToDb(teamId, {
        totalIssues: 0, issuesByType: {}, issuesByAssignee: {}, issuesByStatus: {},
        issuesByLabel: {}, issuesByCategory: {}, averageIssueAgeDays: 0,
        lastRefreshed: new Date().toISOString(), info: { message: errorMsg }
      });
      return { success: false, message: errorMsg, data: { metrics: await getJiraTeamMetricsFromDb(teamId) } };
    }
    await _fetchAndSaveJiraMetrics(
        teamId,
        config.projectName,
        config.url, // Use the URL from the config
        config.username, // Use the username from the config
        config.accessKey
    );
    const metrics = await getJiraTeamMetricsFromDb(teamId);
    return { success: true, data: { metrics }, message: "Jira metrics refreshed successfully." };
  } catch (error: any) {
    console.error(`Error refreshing Jira metrics for team ${teamId}:`, error);
    const existingMetrics = await getJiraTeamMetricsFromDb(teamId);
    return { success: false, message: error.message || "Failed to refresh Jira metrics.", data: {metrics: existingMetrics} };
  }
}


export async function refreshSonarQubeMetrics(teamId: string) {
  try {
    const config = await getSonarQubeConfigFromDb(teamId);
    if (!config || !config.url || !config.accessKey) {
      const errorMsg = `SonarQube configuration (URL or Access Key) not fully set for team ${teamId}. Cannot refresh.`;
      console.error(errorMsg);
      await saveSonarQubeTeamMetricsToDb(teamId, { projectKey: "N/A", lastRefreshed: new Date().toISOString(), info: { message: errorMsg } });
      return { success: false, message: errorMsg, data: { metrics: await getSonarQubeTeamMetricsFromDb(teamId) } };
    }
    await _fetchAndSaveSonarQubeMetrics(teamId, config);
    const metrics = await getSonarQubeTeamMetricsFromDb(teamId);
    return { success: true, data: { metrics }, message: "SonarQube metrics refreshed successfully." };
  } catch (error: any) {
    console.error(`Error refreshing SonarQube metrics for team ${teamId}:`, error);
    const existingMetrics = await getSonarQubeTeamMetricsFromDb(teamId);
    return { success: false, message: error.message || "Failed to refresh SonarQube metrics.", data: {metrics: existingMetrics} };
  }
}

export async function refreshBoomerangMetrics(teamId: string) {
  console.log(`Refreshing Boomerang metrics for team ${teamId} (simulated)`);
  await new Promise(resolve => setTimeout(resolve, 200));
  const mockMetrics = {
    info: "Boomerang metrics integration is not fully implemented or no data available.",
    buildSuccessRate: 0,
    lastRefreshed: new Date().toISOString()
  };
  return { success: true, data: { metrics: mockMetrics }, message: "Boomerang metrics refresh (simulated - no actual data fetch)." };
}

// Get Metrics Actions

export async function getJiraMetrics(teamId: string): Promise<JiraTeamMetricsData | null> {
    const metrics = await getJiraTeamMetricsFromDb(teamId);
     if (metrics) {
        return metrics;
    }
    return {
        info: { message: "Jira not configured or no metrics fetched yet. Please configure in Team Configuration -> Jira and Save/Refresh." },
        totalIssues: 0, issuesByType: {}, issuesByAssignee: {}, issuesByStatus: {},
        issuesByLabel: {}, issuesByCategory: {}, averageIssueAgeDays: 0, lastRefreshed: "N/A"
    };
}


export async function getSonarQubeMetrics(teamId: string): Promise<SonarQubeTeamMetricsData | null> {
    const metrics = await getSonarQubeTeamMetricsFromDb(teamId);
    if (metrics && (metrics.projectKey || metrics.info)) {
      return metrics;
    }
    const defaultConfigMessage = "SonarQube not configured or no metrics fetched yet. Please configure it under Team Configuration -> SonarQube tab and Save/Refresh.";
    return {
        projectKey: metrics?.projectKey,
        info: metrics?.info || { message: defaultConfigMessage },
        lastRefreshed: metrics?.lastRefreshed || "N/A",
        coverage: metrics?.coverage || 0,
        bugs: metrics?.bugs || 0,
        vulnerabilities: metrics?.vulnerabilities || 0,
        codeSmells: metrics?.codeSmells || 0,
        technicalDebtHours: metrics?.technicalDebtHours || 0,
        qualityGateStatus: metrics?.qualityGateStatus || "N/A",
        securityRating: metrics?.securityRating || "N/A",
        reliabilityRating: metrics?.reliabilityRating || "N/A",
        maintainabilityRating: metrics?.maintainabilityRating || "N/A",
    };
}

export async function getBoomerangMetrics(teamId: string) {
  await new Promise(resolve => setTimeout(resolve, 50));
  const mockMetrics = {
    info: "Boomerang metrics integration is not fully implemented or no data available for this team.",
    buildSuccessRate: 0,
    lastRefreshed: "N/A"
  };
  return mockMetrics;
}

interface GithubApiRepo {
  id: string;
  name: string;
  html_url: string;
  full_name: string;
  private: boolean;
  size: number;
  languages_url: string;
  tags_url: string;
  commits_url: string;
}

interface GithubApiCommit {
  sha: string;
  commit: {
    author: { name?: string; email?: string; date?: string };
    committer: { name?: string; email?: string; date?: string };
    message: string;
  };
  author: { login: string; name?: string; email?: string } | null;
  committer: { login: string; name?: string; email?: string } | null;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

interface GithubApiTag {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  zipball_url: string;
  tarball_url: string;
  node_id: string;
}

interface JiraApiIssue {
  key: string;
  fields: {
    summary: string;
    issuetype: { name: string };
    assignee?: { displayName: string; accountId: string; };
    status: { name: string };
    labels: string[];
    components: Array<{ name: string }>;
    created: string;
  };
}

// New action for generating setup scripts (simulated push)
export async function generateRepoSetupScripts(
  data: PushToRepoFormData
): Promise<{ success: boolean; message: string; setupShScript?: string; setupBatScript?: string }> {
  try {
    console.log("Simulating 'Push Code to Repo' with data:", data);
    // Actual git operations are NOT performed for security and complexity reasons.

    const setupShScriptContent = `#!/bin/bash
echo "Setting up TeamOptiVision project..."

echo "Ensuring Node.js and npm are installed..."
# Add checks for Node/npm if desired, or assume they exist.

echo "Installing project dependencies..."
npm install

echo "Creating data directory for SQLite database (if it doesn't exist)..."
mkdir -p ./data

echo "Setup script complete."
echo "To start the application, run: npm run dev"
`;

    const setupBatScriptContent = `@echo off
echo Setting up TeamOptiVision project...

echo Ensuring Node.js and npm are installed...
REM Add checks for Node/npm if desired, or assume they exist.

echo Installing project dependencies...
call npm install

echo Creating data directory for SQLite database (if it doesn't exist)...
if not exist ".\\data" (
  md ".\\data"
)

echo Setup script complete.
echo To start the application, run: npm run dev
`;

    return {
      success: true,
      message: "Setup scripts generated successfully. The actual code push is simulated. Please copy the scripts below and add them to your repository manually.",
      setupShScript: setupShScriptContent,
      setupBatScript: setupBatScriptContent,
    };
  } catch (error: any) {
    console.error("Error in generateRepoSetupScripts:", error);
    return {
      success: false,
      message: error.message || "Failed to generate setup scripts.",
    };
  }
}
