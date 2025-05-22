
// src/app/metrics/github/page.tsx
"use client"; 

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Users, FileText, CalendarDays, List, GitCommit, TagsIcon, AlertTriangle, Code, UserCheck } from "lucide-react";
import { getGithubMetrics, refreshGithubMetrics } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import type { Team } from "../../config/_components/types"; 
import { useGetTeams } from '@/hooks/use-team-queries'; 
import type { GithubMetricsPeriodData } from '@/lib/db';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from '@/components/ui/separator';

const PERIODS = [
  { key: "overall_snapshot", label: "Overall Snapshot" },
  { key: "7days", label: "7 Days" },
  { key: "30days", label: "30 Days" },
  { key: "60days", label: "60 Days" },
  { key: "90days", label: "90 Days" },
  { key: "180days", label: "180 Days" },
  { key: "365days", label: "1 Year" },
];

const API_ESTIMATED_BYTES_PER_LINE = 50; 

export default function GithubMetricsPage() {
  const { data: teamsData, isLoading: isLoadingTeams, error: teamsError } = useGetTeams();
  const teams: Team[] = teamsData || [];
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [metricsByPeriod, setMetricsByPeriod] = useState<Record<string, GithubMetricsPeriodData>>({});
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchTeamMetrics() {
      if (selectedTeamId) {
        setIsLoadingMetrics(true);
        setMetricsByPeriod({}); 
        const fetchedMetrics = await getGithubMetrics(selectedTeamId);
        setMetricsByPeriod(fetchedMetrics);
        setIsLoadingMetrics(false);
      } else {
        setMetricsByPeriod({});
      }
    }
    fetchTeamMetrics();
  }, [selectedTeamId]);

  const handleRefreshMetrics = async () => {
    if (!selectedTeamId) {
      toast({ title: "Error", description: "Please select a team.", variant: "destructive" });
      return;
    }
    setIsRefreshing(true);
    const result = await refreshGithubMetrics(selectedTeamId); // For this page, refresh uses saved config
    if (result.success && result.data) {
      setMetricsByPeriod(result.data);
      toast({ title: "Success", description: result.message || "GitHub metrics refreshed." });
    } else {
      const existingMetrics = await getGithubMetrics(selectedTeamId); 
      setMetricsByPeriod(existingMetrics);
      toast({ title: "Error", description: result.message || "Failed to refresh metrics.", variant: "destructive" });
    }
    setIsRefreshing(false);
  };

  const overallSnapshot = useMemo(() => metricsByPeriod["overall_snapshot"], [metricsByPeriod]);
  
  const apiEstimatedLinesByLanguageData = useMemo(() => {
    if (!overallSnapshot?.apiEstimatedLinesByLanguage_current) return [];
    return Object.entries(overallSnapshot.apiEstimatedLinesByLanguage_current)
      .map(([language, lines]) => ({ language, lines: Number(lines) }))
      .sort((a, b) => b.lines - a.lines);
  }, [overallSnapshot]);

  const clonedActualLinesByLanguageData = useMemo(() => {
    if (!overallSnapshot?.clonedActualLinesByLanguage) return [];
    return Object.entries(overallSnapshot.clonedActualLinesByLanguage)
      .map(([ext, lines]) => ({ language: ext, lines: Number(lines) }))
      .sort((a, b) => b.lines - a.lines);
  }, [overallSnapshot]);


  if (teamsError) {
    return <div className="container mx-auto py-10 text-center text-destructive">Error loading teams: {teamsError.message}</div>;
  }
  
  const anyMetricsExist = overallSnapshot && !overallSnapshot.info;

  return (
    <div className="container mx-auto py-10 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>GitHub Metrics Dashboard</CardTitle>
            <CardDescription>Aggregated insights for the selected team's repositories.</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <Select onValueChange={setSelectedTeamId} value={selectedTeamId || undefined} disabled={isLoadingTeams}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={isLoadingTeams ? "Loading teams..." : "Select Team"} />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleRefreshMetrics} disabled={isRefreshing || !selectedTeamId || isLoadingMetrics}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh All Metrics
            </Button>
          </div>
        </CardHeader>
      </Card>

      {(isLoadingTeams || (isLoadingMetrics && !anyMetricsExist)) && <p className="text-center py-6">Loading metrics...</p>}
      {!selectedTeamId && !isLoadingTeams && <p className="text-center text-muted-foreground py-6">Please select a team to view metrics.</p>}
      
      {selectedTeamId && overallSnapshot?.info && !anyMetricsExist &&
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle /> No Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{overallSnapshot.info.message}</p>
            <p className="text-xs text-muted-foreground mt-2">
                API Data Last Refreshed: {overallSnapshot.apiLastRefreshed && overallSnapshot.apiLastRefreshed !== "N/A" ? new Date(overallSnapshot.apiLastRefreshed).toLocaleString() : "N/A"} <br/>
                Cloned LoC Data Last Refreshed: {overallSnapshot.clonedLoCLastRefreshed && overallSnapshot.clonedLoCLastRefreshed !== "N/A" ? new Date(overallSnapshot.clonedLoCLastRefreshed).toLocaleString() : "N/A"}
            </p>
          </CardContent>
        </Card>
      }

      {selectedTeamId && anyMetricsExist && (
        <Tabs defaultValue="overall_snapshot" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {PERIODS.map(p => <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>)}
          </TabsList>
          
          <TabsContent value="overall_snapshot">
            <div className="my-4 p-4 border border-amber-500 bg-amber-50 rounded-md">
                <p className="text-sm text-amber-700">
                    <AlertTriangle className="inline h-4 w-4 mr-1" />
                    <strong>Note on "Lines of Code":</strong> 
                    "Estimated LoC (API)" figures are rough estimations based on code byte counts from the GitHub API (using a general heuristic of ~{API_ESTIMATED_BYTES_PER_LINE} bytes per line). 
                    "Actual LoC (Cloned)" figures are calculated by cloning the repo and counting non-empty lines in code files (more accurate but resource-intensive).
                    "Lines of Code Added" in periodic tabs are actual lines from commit data.
                </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Estimated Total LoC (API)</CardTitle>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(overallSnapshot?.apiEstimatedTotalLines_current || 0).toLocaleString()} Lines</div>
                  <p className="text-xs text-muted-foreground">(From ~{(overallSnapshot?.apiTotalBytes_current || 0).toLocaleString()} bytes)</p>
                  <p className="text-xs text-muted-foreground mt-1">API Data Last Refreshed: {overallSnapshot?.apiLastRefreshed && overallSnapshot.apiLastRefreshed !== "N/A" ? new Date(overallSnapshot.apiLastRefreshed).toLocaleString() : "N/A"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Actual Total LoC (Cloned)</CardTitle>
                  <Code className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(overallSnapshot?.clonedActualTotalLines || 0).toLocaleString()} Lines</div>
                   <p className="text-xs text-muted-foreground">(From direct file count)</p>
                   <p className="text-xs text-muted-foreground mt-1">Cloned LoC Data Last Refreshed: {overallSnapshot?.clonedLoCLastRefreshed && overallSnapshot.clonedLoCLastRefreshed !== "N/A" ? new Date(overallSnapshot.clonedLoCLastRefreshed).toLocaleString() : "N/A"}</p>
                </CardContent>
              </Card>
               <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Processed Repositories</CardTitle>
                    <List className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg">API: {overallSnapshot?.apiProcessedRepoFullNames?.length || 0} repos</div>
                    <div className="text-lg mt-1">Cloned for LoC: {overallSnapshot?.clonedProcessedRepoFullNames?.length || 0} repos</div>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {overallSnapshot?.apiProcessedRepoFullNames && overallSnapshot.apiProcessedRepoFullNames.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Repositories Processed (API Metrics)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-32">
                          <ul className="list-disc pl-5 space-y-1 text-sm">
                            {overallSnapshot.apiProcessedRepoFullNames.map(repoName => (
                              <li key={`api-${repoName}`}>{repoName}</li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                )}
                 {overallSnapshot?.clonedProcessedRepoFullNames && overallSnapshot.clonedProcessedRepoFullNames.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Repositories Processed (Cloned LoC)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-32">
                          <ul className="list-disc pl-5 space-y-1 text-sm">
                            {overallSnapshot.clonedProcessedRepoFullNames.map(repoName => (
                              <li key={`cloned-${repoName}`}>{repoName}</li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                )}
            </div>


            {apiEstimatedLinesByLanguageData && apiEstimatedLinesByLanguageData.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Estimated LoC Breakdown by Language (API)</CardTitle>
                  <CardDescription>Estimated LoC by programming language (based on byte counts from GitHub API).</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-72">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Language</TableHead>
                          <TableHead className="text-right">Estimated Lines</TableHead>
                          <TableHead className="text-right">(Raw Bytes)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiEstimatedLinesByLanguageData.map(item => (
                          <TableRow key={`api-lang-${item.language}`}>
                            <TableCell className="font-medium">{item.language}</TableCell>
                            <TableCell className="text-right">{item.lines.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">({(overallSnapshot?.apiBytesByLanguage_current?.[item.language] || 0).toLocaleString()} bytes)</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {clonedActualLinesByLanguageData && clonedActualLinesByLanguageData.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Actual LoC Breakdown by File Extension (Cloned)</CardTitle>
                  <CardDescription>Actual lines of code by file extension (counted from cloned files).</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-72">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File Extension</TableHead>
                          <TableHead className="text-right">Actual Lines</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clonedActualLinesByLanguageData.map(item => (
                          <TableRow key={`cloned-lang-${item.language}`}>
                            <TableCell className="font-medium">{item.language}</TableCell>
                            <TableCell className="text-right">{item.lines.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}


            {overallSnapshot?.latestTags && overallSnapshot.latestTags.length > 0 && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TagsIcon className="h-5 w-5" />
                            Latest Release Tags (from API)
                        </CardTitle>
                        <CardDescription>Latest tags found across the selected repositories.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-48">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tag Name (Repo/Tag)</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {overallSnapshot.latestTags.map(tag => (
                                        <TableRow key={tag.name + tag.date}>
                                            <TableCell className="font-medium">{tag.name}</TableCell>
                                            <TableCell>{new Date(tag.date).toLocaleDateString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
          </TabsContent>
          
          {PERIODS.filter(p => p.key !== "overall_snapshot").map(period => {
            const periodData = metricsByPeriod[period.key];
            const lastRefreshedPeriod = periodData?.periodLastRefreshed && periodData.periodLastRefreshed !== "N/A" ? new Date(periodData.periodLastRefreshed).toLocaleString() : "N/A";
            const startDatePeriod = periodData?.periodStartDate && periodData.periodStartDate !== "N/A" ? new Date(periodData.periodStartDate).toLocaleDateString() : "N/A";
            const endDatePeriod = periodData?.periodEndDate && periodData.periodEndDate !== "N/A" ? new Date(periodData.periodEndDate).toLocaleDateString() : "N/A";

            return (
             <TabsContent key={period.key} value={period.key}>
                {periodData && !periodData.info ? (
                  <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Unique Committers (API)</CardTitle>
                                <Users className="h-5 w-5 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{periodData.uniqueCommitters_period || 0}</div>
                                <p className="text-xs text-muted-foreground">Active: {startDatePeriod} - {endDatePeriod}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Lines of Code Added (API)</CardTitle>
                                <GitCommit className="h-5 w-5 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{(periodData.linesAdded_period || 0).toLocaleString()} Lines</div>
                                <p className="text-xs text-muted-foreground">Sum of additions in commits.</p>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Data Last Refreshed</CardTitle>
                                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold">{lastRefreshedPeriod}</div>
                            </CardContent>
                        </Card>
                    </div>
                    {periodData.apiProcessedRepoFullNames && periodData.apiProcessedRepoFullNames.length > 0 && (
                       <Card>
                          <CardHeader>
                            <CardTitle>Repositories Processed for this Period (API Metrics)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="h-32">
                              <ul className="list-disc pl-5 space-y-1 text-sm">
                                {periodData.apiProcessedRepoFullNames.map(repoName => (
                                  <li key={`period-${period.key}-api-${repoName}`}>{repoName}</li>
                                ))}
                              </ul>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                    )}
                    {periodData.uniqueCommitterNames_period && periodData.uniqueCommitterNames_period.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <UserCheck className="h-5 w-5"/> Unique Committer Names
                                </CardTitle>
                                <CardDescription>List of unique committers active in this period.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-48">
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        {periodData.uniqueCommitterNames_period.map(name => (
                                            <li key={`committer-${period.key}-${name}`}>{name}</li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}
                  </div>
                ) : (
                  <Card className="mt-4">
                     <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-muted-foreground">
                            <AlertTriangle /> No Data for {period.label}
                        </CardTitle>
                      </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground py-4">
                        {periodData?.info?.message || `Data for ${period.label} is not available. Try refreshing all metrics.`}
                      </p>
                       <p className="text-xs text-muted-foreground mt-2">Last attempt: {lastRefreshedPeriod}</p>
                    </CardContent>
                  </Card>
                )}
             </TabsContent>
            );
           })}
        </Tabs>
      )}
    </div>
  );
}
