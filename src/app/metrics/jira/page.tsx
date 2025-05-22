
// src/app/metrics/jira/page.tsx
"use client";

import * as React from 'react'; // Added React import
import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, ListChecks, Users, Tag, FolderTree, AlertTriangle, Sigma, CalendarDays, Percent } from "lucide-react";
import { getJiraMetrics, refreshJiraMetrics } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import type { Team } from "../../config/_components/types";
import { useGetTeams } from '@/hooks/use-team-queries';
import type { JiraTeamMetricsData } from '@/lib/db';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"; // Removed BarChart, XAxis, YAxis, Bar, CartesianGrid
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from '@/components/ui/separator';

const chartConfigBase = {
  issues: { label: "Issues" },
  bug: { label: "Bugs", color: "hsl(var(--chart-1))" },
  task: { label: "Tasks", color: "hsl(var(--chart-2))" },
  story: { label: "Stories", color: "hsl(var(--chart-3))" },
  epic: { label: "Epics", color: "hsl(var(--chart-4))" },
  subtask: { label: "Sub-tasks", color: "hsl(var(--chart-5))" },
  other: { label: "Other", color: "hsl(var(--muted))"}
} satisfies Record<string, any>;


export default function JiraMetricsPage() {
  const { data: teamsData, isLoading: isLoadingTeams, error: teamsError } = useGetTeams();
  const teams: Team[] = teamsData || [];

  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [metrics, setMetrics] = useState<JiraTeamMetricsData | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchMetrics() {
      if (selectedTeamId) {
        setIsLoadingMetrics(true);
        const fetchedMetrics = await getJiraMetrics(selectedTeamId);
        setMetrics(fetchedMetrics);
        setIsLoadingMetrics(false);
      } else {
        setMetrics(null);
      }
    }
    fetchMetrics();
  }, [selectedTeamId]);

  const handleRefreshMetrics = async () => {
    if (!selectedTeamId) {
      toast({ title: "Error", description: "Please select a team.", variant: "destructive" });
      return;
    }
    setIsRefreshing(true);
    const result = await refreshJiraMetrics(selectedTeamId);
    if (result.success && result.data?.metrics) {
      setMetrics(result.data.metrics as JiraTeamMetricsData);
      toast({ title: "Success", description: "Jira metrics refreshed." });
    } else {
      toast({ title: "Error", description: result.message || "Failed to refresh Jira metrics.", variant: "destructive" });
      // Optionally, re-fetch old metrics if refresh fails but data exists
      const oldMetrics = await getJiraMetrics(selectedTeamId);
      setMetrics(oldMetrics);
    }
    setIsRefreshing(false);
  };

  const {
    displayMetrics,
    issuesByTypeChartData,
    issuesByAssigneeChartData,
    issuesByStatusChartData,
    issuesByLabelChartData,
    issuesByCategoryChartData,
    dynamicChartConfig
  } = useMemo(() => {
    if (!metrics || metrics.info) {
      return {
        displayMetrics: null,
        issuesByTypeChartData: [],
        issuesByAssigneeChartData: [],
        issuesByStatusChartData: [],
        issuesByLabelChartData: [],
        issuesByCategoryChartData: [],
        dynamicChartConfig: chartConfigBase
      };
    }

    const dm = {
      totalIssues: metrics.totalIssues || 0,
      averageIssueAgeDays: metrics.averageIssueAgeDays?.toFixed(1) || "0.0",
      lastRefreshed: metrics.lastRefreshed ? new Date(metrics.lastRefreshed).toLocaleString() : "N/A"
    };

    const typeData = Object.entries(metrics.issuesByType || {})
      .map(([name, value]) => ({ name, value, fill: `var(--color-${name.toLowerCase().replace(/\s+/g, '-')})` }))
      .sort((a,b) => b.value - a.value);

    const assigneeData = Object.entries(metrics.issuesByAssignee || {})
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);

    const statusData = Object.entries(metrics.issuesByStatus || {})
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);

    const labelData = Object.entries(metrics.issuesByLabel || {})
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);

    const categoryData = Object.entries(metrics.issuesByCategory || {})
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);

    // Dynamically build chartConfig for colors
    const newChartConfig = { ...chartConfigBase };
    typeData.forEach((item, index) => {
        const key = item.name.toLowerCase().replace(/\s+/g, '-');
        if (!newChartConfig[key]) {
            newChartConfig[key] = { label: item.name, color: `hsl(var(--chart-${(index % 5) + 1}))` };
        }
    });


    return {
      displayMetrics: dm,
      issuesByTypeChartData: typeData,
      issuesByAssigneeChartData: assigneeData,
      issuesByStatusChartData: statusData,
      issuesByLabelChartData: labelData,
      issuesByCategoryChartData: categoryData,
      dynamicChartConfig: newChartConfig
    };
  }, [metrics]);

  if (teamsError) {
    return <div className="container mx-auto py-10 text-center text-destructive">Error loading teams: {teamsError.message}</div>;
  }

  const renderTableCard = (title: string, data: {name: string, value: number}[], icon: React.ElementType) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {React.createElement(icon, {className: "h-5 w-5"})}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ScrollArea className="h-60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map(item => (
                  <TableRow key={item.name}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">{item.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <p className="text-muted-foreground text-center py-4">No data available.</p>
        )}
      </CardContent>
    </Card>
  );


  return (
    <div className="container mx-auto py-10 space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-2xl">Jira Project Metrics</CardTitle>
            <CardDescription>Track your team's progress and issues in Jira.</CardDescription>
          </div>
           <div className="flex items-center gap-4">
            <Select onValueChange={setSelectedTeamId} value={selectedTeamId || undefined} disabled={isLoadingTeams || isRefreshing}>
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
              {isRefreshing ? "Refreshing..." : "Refresh Metrics"}
            </Button>
          </div>
        </CardHeader>
         {displayMetrics && (
            <CardContent className="pt-4 text-sm text-muted-foreground text-right">
                Last refreshed: {displayMetrics.lastRefreshed}
            </CardContent>
        )}
      </Card>

      {(isLoadingTeams || (isLoadingMetrics && !metrics)) && <p className="text-center py-6 text-lg">Loading metrics...</p>}
      {!selectedTeamId && !isLoadingTeams && <p className="text-center text-muted-foreground py-6 text-lg">Please select a team to view metrics.</p>}

      {selectedTeamId && metrics?.info &&
        <Card className="border-yellow-500 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle /> Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-700">{metrics.info.message}</p>
          </CardContent>
        </Card>
      }

      {selectedTeamId && displayMetrics && (
        <>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
              <Sigma className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{displayMetrics.totalIssues}</div>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Issue Age</CardTitle>
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{displayMetrics.averageIssueAgeDays} days</div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            <Card className="lg:col-span-2 xl:col-span-1">
                <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Percent className="h-5 w-5" /> Issues by Type
                </CardTitle>
                </CardHeader>
                <CardContent className="pb-0">
                {issuesByTypeChartData.length > 0 ? (
                    <ChartContainer config={dynamicChartConfig} className="mx-auto aspect-square max-h-[350px]">
                        <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                        <Pie
                            data={issuesByTypeChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            labelLine={false}
                            label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                            {issuesByTypeChartData.map((entry: any) => (
                                <Cell key={`cell-${entry.name}`} fill={entry.fill} stroke={entry.fill} />
                            ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center" />
                        </PieChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                ) : (
                    <p className="text-muted-foreground text-center py-4">No data available for chart.</p>
                )}
                </CardContent>
            </Card>

            {renderTableCard("Issues by Status", issuesByStatusChartData, Tag)}
            {renderTableCard("Issues by Assignee", issuesByAssigneeChartData, Users)}
            {renderTableCard("Issues by Label", issuesByLabelChartData, Tag)}
            {renderTableCard("Issues by Category (Component)", issuesByCategoryChartData, FolderTree)}
        </div>
        </>
      )}
    </div>
  );
}
