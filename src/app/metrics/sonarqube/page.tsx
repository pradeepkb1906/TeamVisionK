
// src/app/metrics/sonarqube/page.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Gauge, ShieldCheck, AlertTriangle, Sprout, Percent, Hourglass, CheckCircle, XCircle } from "lucide-react";
import { getSonarQubeMetrics, refreshSonarQubeMetrics } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import type { Team } from "../../config/_components/types";
import { useGetTeams } from '@/hooks/use-team-queries';
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SonarQubeTeamMetricsData } from '@/lib/db';

const RATING_COLORS: Record<string, string> = {
  'A': 'text-green-500',
  'B': 'text-blue-500',
  'C': 'text-yellow-500',
  'D': 'text-orange-500',
  'E': 'text-red-500',
};

const RATING_BG_COLORS: Record<string, string> = {
  'A': 'bg-green-500/20',
  'B': 'bg-blue-500/20',
  'C': 'bg-yellow-500/20',
  'D': 'bg-orange-500/20',
  'E': 'bg-red-500/20',
};

const QUALITY_GATE_STATUS_ICONS: Record<string, React.ElementType> = {
  'OK': CheckCircle,
  'ERROR': XCircle,
  'WARN': AlertTriangle,
};

const QUALITY_GATE_STATUS_COLORS: Record<string, string> = {
  'OK': 'text-green-500',
  'ERROR': 'text-red-500',
  'WARN': 'text-yellow-500',
};


export default function SonarQubeMetricsPage() {
  const { data: teamsData, isLoading: isLoadingTeams, error: teamsError } = useGetTeams();
  const teams: Team[] = teamsData || [];

  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [metrics, setMetrics] = useState<SonarQubeTeamMetricsData | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchMetrics() {
      if (selectedTeamId) {
        setIsLoadingMetrics(true);
        setMetrics(null); // Clear previous metrics
        const fetchedMetrics = await getSonarQubeMetrics(selectedTeamId);
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
    const result = await refreshSonarQubeMetrics(selectedTeamId);
     if (result.success && result.data?.metrics) {
      setMetrics(result.data.metrics as SonarQubeTeamMetricsData);
      toast({ title: "Success", description: "SonarQube metrics refreshed." });
    } else {
      toast({ title: "Error", description: result.message || "Failed to refresh metrics.", variant: "destructive" });
      // Re-fetch old metrics if refresh fails but some data might still exist or info message updated
      const oldMetrics = await getSonarQubeMetrics(selectedTeamId);
      setMetrics(oldMetrics);
    }
    setIsRefreshing(false);
  };
  
  const displayMetrics = useMemo(() => {
    if (!metrics || metrics.info) return null;
    return {
      projectKey: metrics.projectKey || "N/A",
      codeCoverage: metrics.coverage || 0,
      bugs: metrics.bugs || 0,
      vulnerabilities: metrics.vulnerabilities || 0,
      codeSmells: metrics.codeSmells || 0,
      technicalDebtHours: metrics.technicalDebtHours || 0,
      qualityGateStatus: metrics.qualityGateStatus || "N/A",
      securityRating: metrics.securityRating || "N/A",
      reliabilityRating: metrics.reliabilityRating || "N/A",
      maintainabilityRating: metrics.maintainabilityRating || "N/A",
      lastRefreshed: metrics.lastRefreshed ? new Date(metrics.lastRefreshed).toLocaleString() : "N/A"
    };
  }, [metrics]);

  if (teamsError) {
    return <div className="container mx-auto py-10 text-center text-destructive">Error loading teams: {teamsError.message}</div>;
  }
  
  const QualityGateIcon = displayMetrics?.qualityGateStatus ? QUALITY_GATE_STATUS_ICONS[displayMetrics.qualityGateStatus.toUpperCase()] || AlertTriangle : AlertTriangle;
  const qualityGateColor = displayMetrics?.qualityGateStatus ? QUALITY_GATE_STATUS_COLORS[displayMetrics.qualityGateStatus.toUpperCase()] || 'text-muted-foreground' : 'text-muted-foreground';


  return (
    <div className="container mx-auto py-10 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>SonarQube Metrics</CardTitle>
            <CardDescription>Analyze code quality and security for your team's project: {displayMetrics?.projectKey || (metrics?.projectKey) || ""}</CardDescription>
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
          <CardContent className="pt-2 text-sm text-muted-foreground text-right">
              Last refreshed: {displayMetrics.lastRefreshed}
          </CardContent>
        )}
      </Card>

      {(isLoadingTeams || (isLoadingMetrics && !metrics)) && <p className="text-center py-6">Loading metrics...</p>}
      {!selectedTeamId && !isLoadingTeams && <p className="text-center text-muted-foreground py-6">Please select a team to view metrics.</p>}
      
      {selectedTeamId && metrics?.info && 
        <Card className="border-yellow-500 bg-yellow-50/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle /> Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-700">{metrics.info.message}</p>
             <p className="text-xs text-muted-foreground mt-1">Last attempt: {new Date(metrics.lastRefreshed).toLocaleString()}</p>
          </CardContent>
        </Card>
      }

      {selectedTeamId && displayMetrics && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-1"> {/* Simplified to one tab for now */}
            <TabsTrigger value="overview">Project Overview</TabsTrigger>
            {/* <TabsTrigger value="repo-wise" disabled>Repo-wise View (NA)</TabsTrigger> */}
          </TabsList>
          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Quality Gate Status</CardTitle>
                  <QualityGateIcon className={`h-5 w-5 ${qualityGateColor}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${qualityGateColor}`}>{displayMetrics.qualityGateStatus}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Code Coverage</CardTitle>
                  <Percent className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.codeCoverage.toFixed(1)}%</div>
                  <Progress value={displayMetrics.codeCoverage} className="mt-2 h-2" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Technical Debt</CardTitle>
                  <Hourglass className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.technicalDebtHours.toFixed(1)} hours</div>
                  <p className="text-xs text-muted-foreground">Estimated remediation effort</p>
                </CardContent>
              </Card>
               <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bugs</CardTitle>
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">{displayMetrics.bugs}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Vulnerabilities</CardTitle>
                  <ShieldCheck className="h-5 w-5 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{displayMetrics.vulnerabilities}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Code Smells</CardTitle>
                  <Gauge className="h-5 w-5 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-500">{displayMetrics.codeSmells}</div>
                </CardContent>
              </Card>
              <Card className={RATING_BG_COLORS[displayMetrics.reliabilityRating] || 'bg-muted'}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Reliability Rating</CardTitle>
                   <Sprout className={`h-5 w-5 ${RATING_COLORS[displayMetrics.reliabilityRating] || 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${RATING_COLORS[displayMetrics.reliabilityRating] || 'text-foreground'}`}>{displayMetrics.reliabilityRating}</div>
                </CardContent>
              </Card>
               <Card className={RATING_BG_COLORS[displayMetrics.securityRating] || 'bg-muted'}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Security Rating</CardTitle>
                  <ShieldCheck className={`h-5 w-5 ${RATING_COLORS[displayMetrics.securityRating] || 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${RATING_COLORS[displayMetrics.securityRating] || 'text-foreground'}`}>{displayMetrics.securityRating}</div>
                </CardContent>
              </Card>
              <Card className={RATING_BG_COLORS[displayMetrics.maintainabilityRating] || 'bg-muted'}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Maintainability Rating</CardTitle>
                  <Gauge className={`h-5 w-5 ${RATING_COLORS[displayMetrics.maintainabilityRating] || 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                   <div className={`text-2xl font-bold ${RATING_COLORS[displayMetrics.maintainabilityRating] || 'text-foreground'}`}>{displayMetrics.maintainabilityRating}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
