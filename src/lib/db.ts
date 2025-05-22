
// src/lib/db.ts
"use server";

import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import type { Team } from '@/app/config/_components/types';
import type { ApiKeysFormData, GithubConfigFormData, JiraConfigFormData, SonarQubeConfigFormData, BoomerangConfigFormData, TeamMemberFormData, GithubRepoData, DbConfigFormData } from './schemas';
import { v4 as uuidv4 } from 'uuid';

const DB_FILE_PATH = path.resolve(process.cwd(), './data/mydatabase.sqlite3');
const DB_DIR = path.dirname(DB_FILE_PATH);

let dbInstance: Database | null = null;

export interface GithubMetricsPeriodData {
  apiTotalBytes_current?: number;
  apiBytesByLanguage_current?: Record<string, number>; 
  apiEstimatedTotalLines_current?: number;
  apiEstimatedLinesByLanguage_current?: Record<string, number>;
  apiProcessedRepoFullNames?: string[];
  apiLastRefreshed?: string;

  clonedActualTotalLines?: number;
  clonedActualLinesByLanguage?: Record<string, number>; 
  clonedProcessedRepoFullNames?: string[];
  clonedLoCLastRefreshed?: string;

  latestTags?: { name: string; date: string }[];

  linesAdded_period?: number;
  uniqueCommitters_period?: number;
  uniqueCommitterNames_period?: string[];
  periodStartDate?: string; 
  periodEndDate?: string; 
  periodLastRefreshed?: string; 
  info?: { message: string };
}


export interface JiraTeamMetricsData {
  totalIssues: number;
  issuesByType: Record<string, number>;
  issuesByAssignee: Record<string, number>;
  issuesByStatus: Record<string, number>;
  issuesByLabel: Record<string, number>;
  issuesByCategory: Record<string, number>; 
  averageIssueAgeDays: number;
  lastRefreshed: string; 
  info?: { message: string };
}

export interface SonarQubeMetrics {
  projectKey?: string;
  coverage?: number;
  bugs?: number;
  vulnerabilities?: number;
  codeSmells?: number;
  technicalDebtHours?: number; 
  qualityGateStatus?: string; 
  securityRating?: string; 
  reliabilityRating?: string; 
  maintainabilityRating?: string; 
}

export interface SonarQubeTeamMetricsData extends SonarQubeMetrics {
  lastRefreshed: string; 
  info?: { message: string };
}


async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    dbInstance = await open({
      filename: DB_FILE_PATH,
      driver: sqlite3.Database,
    });

    await dbInstance.exec(`PRAGMA foreign_keys = ON;`);

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        teamId TEXT PRIMARY KEY,
        geminiApiKey TEXT,
        openAiApiKey TEXT,
        claudeAiApiKey TEXT,
        FOREIGN KEY(teamId) REFERENCES teams(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS github_configs (
        teamId TEXT PRIMARY KEY,
        rootUrl TEXT,
        accessToken TEXT,
        selectedRepos TEXT, 
        FOREIGN KEY(teamId) REFERENCES teams(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS jira_configs (
        teamId TEXT PRIMARY KEY,
        projectName TEXT,
        url TEXT,
        username TEXT,
        accessKey TEXT,
        FOREIGN KEY(teamId) REFERENCES teams(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sonarqube_configs (
        teamId TEXT PRIMARY KEY,
        url TEXT,
        accessKey TEXT,
        FOREIGN KEY(teamId) REFERENCES teams(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS boomerang_configs (
        teamId TEXT PRIMARY KEY,
        url TEXT,
        accessKey TEXT,
        FOREIGN KEY(teamId) REFERENCES teams(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        teamId TEXT NOT NULL,
        technology TEXT,
        band TEXT,
        rate REAL,
        numResources INTEGER,
        FOREIGN KEY(teamId) REFERENCES teams(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS github_team_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teamId TEXT NOT NULL,
        periodKey TEXT NOT NULL, 
        data TEXT NOT NULL, 
        lastRefreshed TEXT NOT NULL, 
        FOREIGN KEY(teamId) REFERENCES teams(id) ON DELETE CASCADE,
        UNIQUE(teamId, periodKey)
      );
      
      CREATE TABLE IF NOT EXISTS jira_team_metrics (
        teamId TEXT PRIMARY KEY,
        totalIssues INTEGER DEFAULT 0,
        issuesByType TEXT, 
        issuesByAssignee TEXT, 
        issuesByStatus TEXT, 
        issuesByLabel TEXT, 
        issuesByCategory TEXT, 
        averageIssueAgeDays REAL DEFAULT 0,
        lastRefreshed TEXT, 
        info TEXT, 
        FOREIGN KEY(teamId) REFERENCES teams(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sonarqube_team_metrics (
        teamId TEXT PRIMARY KEY,
        projectKey TEXT,
        metricsData TEXT, 
        lastRefreshed TEXT, 
        info TEXT, 
        FOREIGN KEY(teamId) REFERENCES teams(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS application_db_config (
        config_id TEXT PRIMARY KEY DEFAULT 'main_config',
        dbType TEXT,
        dbPath TEXT,
        dbName TEXT,
        lastUpdated TEXT
      );
    `);

    // Schema migrations
    const githubConfigCols = await dbInstance.all(`PRAGMA table_info(github_configs);`);
    if (!githubConfigCols.some(col => (col as any).name === 'accessToken')) {
      await dbInstance.exec('ALTER TABLE github_configs ADD COLUMN accessToken TEXT;');
      console.log("Added accessToken column to github_configs table.");
    }
    if (!githubConfigCols.some(col => (col as any).name === 'selectedRepos')) {
      await dbInstance.exec('ALTER TABLE github_configs ADD COLUMN selectedRepos TEXT;');
      console.log("Added selectedRepos column to github_configs table.");
    }
    
    const githubMetricsCacheCols = await dbInstance.all(`PRAGMA table_info(github_team_metrics);`);
     if (!githubMetricsCacheCols.some(col => (col as any).name === 'periodKey')) {
        // This is more complex as it's part of a unique key. Simpler to recreate if missing in dev.
        console.warn("github_team_metrics table might be missing periodKey or have an old schema. Consider recreating if issues persist.");
    }
    
    const jiraConfigCols = await dbInstance.all(`PRAGMA table_info(jira_configs);`);
    const requiredJiraCols = ['url', 'username', 'accessKey']; // Re-added these
    const missingJiraCols = requiredJiraCols.filter(colName => !jiraConfigCols.some(col => (col as any).name === colName));

    if (missingJiraCols.length > 0) {
      console.warn(`Jira_configs table is missing columns: ${missingJiraCols.join(', ')}. Attempting to add them.`);
      for (const colName of missingJiraCols) {
        try {
          await dbInstance.exec(`ALTER TABLE jira_configs ADD COLUMN ${colName} TEXT;`);
          console.log(`Added ${colName} column to jira_configs table.`);
        } catch (alterError) {
          console.error(`Failed to add column ${colName} to jira_configs. It might require manual migration or table recreation. Error:`, alterError);
        }
      }
    }

    const sonarqubeMetricsCols = await dbInstance.all(`PRAGMA table_info(sonarqube_team_metrics);`);
    if (!sonarqubeMetricsCols.some(col => (col as any).name === 'info')) {
      await dbInstance.exec('ALTER TABLE sonarqube_team_metrics ADD COLUMN info TEXT;');
      console.log("Added info column to sonarqube_team_metrics table.");
    }
    if (!sonarqubeMetricsCols.some(col => (col as any).name === 'projectKey')) {
      await dbInstance.exec('ALTER TABLE sonarqube_team_metrics ADD COLUMN projectKey TEXT;');
      console.log("Added projectKey column to sonarqube_team_metrics table.");
    }
     if (!sonarqubeMetricsCols.some(col => (col as any).name === 'metricsData')) {
      await dbInstance.exec('ALTER TABLE sonarqube_team_metrics ADD COLUMN metricsData TEXT;');
      console.log("Added metricsData column to sonarqube_team_metrics table.");
    }


    const jiraMetricsCols = await dbInstance.all(`PRAGMA table_info(jira_team_metrics);`);
    if (!jiraMetricsCols.some(col => (col as any).name === 'info')) {
      await dbInstance.exec('ALTER TABLE jira_team_metrics ADD COLUMN info TEXT;');
      console.log("Added info column to jira_team_metrics table.");
    }
    
  } catch (error) {
    console.error("Failed to initialize or migrate database:", error);
    dbInstance = null; 
    throw error; 
  }

  return dbInstance;
}

// Team
export async function addTeamToDb(id: string, name: string): Promise<Team> {
  const db = await getDb();
  try {
    await db.run('INSERT INTO teams (id, name) VALUES (?, ?)', id, name);
    return { id, name };
  } catch (error) {
    console.error('Failed to add team to DB:', error);
    throw new Error('Failed to add team to database. Team name might already exist.');
  }
}

export async function getTeamsFromDb(): Promise<Team[]> {
  const db = await getDb();
  try {
    const teams = await db.all<Team[]>('SELECT id, name FROM teams ORDER BY name ASC');
    return teams;
  } catch (error) {
    console.error('Failed to get teams from DB:', error);
    throw new Error('Failed to retrieve teams from database.');
  }
}

// API Keys
export async function saveApiKeysToDb(data: ApiKeysFormData): Promise<ApiKeysFormData> {
  const db = await getDb();
  await db.run(
    'INSERT OR REPLACE INTO api_keys (teamId, geminiApiKey, openAiApiKey, claudeAiApiKey) VALUES (?, ?, ?, ?)',
    data.teamId, data.geminiApiKey || null, data.openAiApiKey || null, data.claudeAiApiKey || null
  );
  return data;
}

export async function getApiKeysFromDb(teamId: string): Promise<ApiKeysFormData | null> {
  const db = await getDb();
  const row = await db.get<ApiKeysFormData>('SELECT teamId, geminiApiKey, openAiApiKey, claudeAiApiKey FROM api_keys WHERE teamId = ?', teamId);
  return row || null;
}

// GitHub Config
export async function saveGithubConfigToDb(data: GithubConfigFormData): Promise<GithubConfigFormData> {
  const db = await getDb();
  await db.run(
    'INSERT OR REPLACE INTO github_configs (teamId, rootUrl, accessToken, selectedRepos) VALUES (?, ?, ?, ?)',
    data.teamId, data.rootUrl, data.accessToken || null, JSON.stringify(data.selectedRepos || [])
  );
  return data;
}

export async function getGithubConfigFromDb(teamId: string): Promise<GithubConfigFormData | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT teamId, rootUrl, accessToken, selectedRepos FROM github_configs WHERE teamId = ?', teamId);
  if (row) {
    return {
      teamId: row.teamId,
      rootUrl: row.rootUrl,
      accessToken: row.accessToken || "",
      selectedRepos: row.selectedRepos ? JSON.parse(row.selectedRepos) : [],
    };
  }
  return null;
}

// Jira Config
export async function saveJiraConfigToDb(data: JiraConfigFormData): Promise<JiraConfigFormData> {
  const db = await getDb();
  await db.run(
    'INSERT OR REPLACE INTO jira_configs (teamId, projectName, url, username, accessKey) VALUES (?, ?, ?, ?, ?)',
    data.teamId, data.projectName, data.url, data.username, data.accessKey
  );
  return data;
}

export async function getJiraConfigFromDb(teamId: string): Promise<JiraConfigFormData | null> {
  const db = await getDb();
  const row = await db.get<JiraConfigFormData>('SELECT teamId, projectName, url, username, accessKey FROM jira_configs WHERE teamId = ?', teamId);
  return row || null;
}

// SonarQube Config
export async function saveSonarQubeConfigToDb(data: SonarQubeConfigFormData): Promise<SonarQubeConfigFormData> {
  const db = await getDb();
  await db.run(
    'INSERT OR REPLACE INTO sonarqube_configs (teamId, url, accessKey) VALUES (?, ?, ?)',
    data.teamId, data.url, data.accessKey
  );
  return data;
}

export async function getSonarQubeConfigFromDb(teamId: string): Promise<SonarQubeConfigFormData | null> {
  const db = await getDb();
  const row = await db.get<SonarQubeConfigFormData>('SELECT teamId, url, accessKey FROM sonarqube_configs WHERE teamId = ?', teamId);
  return row || null;
}

// Boomerang Config
export async function saveBoomerangConfigToDb(data: BoomerangConfigFormData): Promise<BoomerangConfigFormData> {
  const db = await getDb();
  await db.run(
    'INSERT OR REPLACE INTO boomerang_configs (teamId, url, accessKey) VALUES (?, ?, ?)',
    data.teamId, data.url, data.accessKey
  );
  return data;
}

export async function getBoomerangConfigFromDb(teamId: string): Promise<BoomerangConfigFormData | null> {
  const db = await getDb();
  const row = await db.get<BoomerangConfigFormData>('SELECT teamId, url, accessKey FROM boomerang_configs WHERE teamId = ?', teamId);
  return row || null;
}

// Team Members
export async function saveTeamMemberToDb(data: TeamMemberFormData): Promise<TeamMemberFormData & { id: string }> {
  const db = await getDb();
  const memberId = uuidv4();
  await db.run(
    'INSERT INTO team_members (id, teamId, technology, band, rate, numResources) VALUES (?, ?, ?, ?, ?, ?)',
    memberId, data.teamId, data.technology, data.band, data.rate, data.numResources
  );
  return { ...data, id: memberId };
}

export async function getTeamMembersFromDb(teamId: string): Promise<(TeamMemberFormData & { id: string })[]> {
  const db = await getDb();
  const rows = await db.all<(TeamMemberFormData & { id: string })[]>('SELECT * FROM team_members WHERE teamId = ? ORDER BY technology, band', teamId);
  return rows || [];
}

// GitHub Team Metrics
export async function saveGithubTeamMetric(
  teamId: string,
  periodKey: string,
  data: GithubMetricsPeriodData
): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT OR REPLACE INTO github_team_metrics (teamId, periodKey, data, lastRefreshed) VALUES (?, ?, ?, ?)',
    teamId,
    periodKey,
    JSON.stringify(data),
    new Date().toISOString() 
  );
}

export async function getGithubTeamMetricsFromDb(teamId: string): Promise<Record<string, GithubMetricsPeriodData>> {
  const db = await getDb();
  const rows = await db.all<any[]>('SELECT periodKey, data, lastRefreshed FROM github_team_metrics WHERE teamId = ?', teamId);
  const metrics: Record<string, GithubMetricsPeriodData> = {};
  if (rows) {
    for (const row of rows) {
      try {
        const parsedData = JSON.parse(row.data);
        metrics[row.periodKey] = parsedData; 
      } catch (e) {
        console.error(`Error parsing GitHub metrics data for team ${teamId}, period ${row.periodKey}:`, e);
        metrics[row.periodKey] = {
            info: { message: `Error loading data for period ${row.periodKey}. Last DB update: ${row.lastRefreshed}` },
        };
      }
    }
  }
  return metrics;
}

export async function clearGithubTeamMetrics(teamId: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM github_team_metrics WHERE teamId = ?', teamId);
}


// Jira Team Metrics
export async function saveJiraTeamMetricsToDb(teamId: string, metrics: JiraTeamMetricsData): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT OR REPLACE INTO jira_team_metrics
     (teamId, totalIssues, issuesByType, issuesByAssignee, issuesByStatus, issuesByLabel, issuesByCategory, averageIssueAgeDays, lastRefreshed, info)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    teamId,
    metrics.totalIssues,
    JSON.stringify(metrics.issuesByType || {}),
    JSON.stringify(metrics.issuesByAssignee || {}),
    JSON.stringify(metrics.issuesByStatus || {}),
    JSON.stringify(metrics.issuesByLabel || {}),
    JSON.stringify(metrics.issuesByCategory || {}),
    metrics.averageIssueAgeDays,
    metrics.lastRefreshed,
    metrics.info ? JSON.stringify(metrics.info) : null
  );
}

export async function getJiraTeamMetricsFromDb(teamId: string): Promise<JiraTeamMetricsData | null> {
  const db = await getDb();
  const row = await db.get<any>(`SELECT * FROM jira_team_metrics WHERE teamId = ?`, teamId);
  if (row) {
    return {
      totalIssues: row.totalIssues,
      issuesByType: row.issuesByType ? JSON.parse(row.issuesByType) : {},
      issuesByAssignee: row.issuesByAssignee ? JSON.parse(row.issuesByAssignee) : {},
      issuesByStatus: row.issuesByStatus ? JSON.parse(row.issuesByStatus) : {},
      issuesByLabel: row.issuesByLabel ? JSON.parse(row.issuesByLabel) : {},
      issuesByCategory: row.issuesByCategory ? JSON.parse(row.issuesByCategory) : {},
      averageIssueAgeDays: row.averageIssueAgeDays,
      lastRefreshed: row.lastRefreshed,
      info: row.info ? JSON.parse(row.info) : undefined,
    };
  }
  return null;
}

// SonarQube Team Metrics
export async function saveSonarQubeTeamMetricsToDb(teamId: string, data: SonarQubeTeamMetricsData): Promise<void> {
  const db = await getDb();
  const { info, lastRefreshed, projectKey, ...metricsOnly } = data;
  await db.run(
    'INSERT OR REPLACE INTO sonarqube_team_metrics (teamId, projectKey, metricsData, lastRefreshed, info) VALUES (?, ?, ?, ?, ?)',
    teamId,
    projectKey || null,
    JSON.stringify(metricsOnly), 
    lastRefreshed,
    info ? JSON.stringify(info) : null
  );
}

export async function getSonarQubeTeamMetricsFromDb(teamId: string): Promise<SonarQubeTeamMetricsData | null> {
  const db = await getDb();
  const row = await db.get<{ teamId: string; projectKey: string | null; metricsData: string; lastRefreshed: string; info: string | null }>(
    'SELECT teamId, projectKey, metricsData, lastRefreshed, info FROM sonarqube_team_metrics WHERE teamId = ?',
    teamId
  );
  if (row) {
    try {
      const parsedMetrics: SonarQubeMetrics = row.metricsData ? JSON.parse(row.metricsData) : {};
      const parsedInfo = row.info ? JSON.parse(row.info) : undefined;
      return {
        ...parsedMetrics,
        projectKey: row.projectKey || undefined,
        lastRefreshed: row.lastRefreshed,
        info: parsedInfo,
      };
    } catch (e) {
      console.error(`Error parsing SonarQube metrics data for team ${teamId}:`, e);
      return {
        info: { message: `Error loading SonarQube metrics data. Last DB update: ${row.lastRefreshed}` },
        lastRefreshed: row.lastRefreshed,
      };
    }
  }
  return null;
}

// Application DB Config
const MAIN_CONFIG_ID = 'main_app_db_config';

export async function saveDbConfigToDb(data: DbConfigFormData): Promise<DbConfigFormData> {
  const db = await getDb();
  await db.run(
    `INSERT OR REPLACE INTO application_db_config (config_id, dbType, dbPath, dbName, lastUpdated) 
     VALUES (?, ?, ?, ?, ?)`,
    MAIN_CONFIG_ID,
    data.dbType,
    data.dbPath,
    data.dbName,
    new Date().toISOString()
  );
  console.log("Application DB config saved to primary database:", data);
  return data;
}

export async function getDbConfigFromDb(): Promise<DbConfigFormData | null> {
  const db = await getDb();
  const row = await db.get<DbConfigFormData & { config_id: string, lastUpdated: string }>(
    'SELECT dbType, dbPath, dbName FROM application_db_config WHERE config_id = ?',
    MAIN_CONFIG_ID
  );
  if (row) {
    return {
      dbType: row.dbType,
      dbPath: row.dbPath,
      dbName: row.dbName,
    };
  }
  return null; // Or return default values if preferred
}
