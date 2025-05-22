// src/app/metrics/boomerang/page.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Rocket, ShieldCheck } from "lucide-react";
import { getBoomerangMetrics, refreshBoomerangMetrics } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import type { Team } from "../../config/_components/types";
import { useGetTeams } from '@/hooks/use-team-queries'; // Import the hook
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


export default function BoomerangMetricsPage() {
  const { data: teamsData, isLoading: isLoadingTeams, error: teamsError } = useGetTeams();
  const teams: Team[] = teamsData || [];
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchMetrics() {
      if (selectedTeamId) {
        setIsLoadingMetrics(true);
        const fetchedMetrics = await getBoomerangMetrics(selectedTeamId);
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
    const result = await refreshBoomerangMetrics(selectedTeamId);
    if (result.success && result.data) {
      setMetrics(result.data.metrics);
      toast({ title: "Success", description: "Boomerang metrics refreshed." });
    } else {
      toast({ title: "Error", description: result.message || "Failed to refresh metrics.", variant: "destructive" });
    }
    setIsRefreshing(false);
  };
  
  const displayMetrics = useMemo(() => {
    if (!metrics || metrics.info) return null;
    return {
      buildSuccessRate: metrics.buildSuccessRate || 0,
      lastRefreshed: metrics.lastRefreshed ? new Date(metrics.lastRefreshed).toLocaleString() : "N/A"
    };
  }, [metrics]);

  if (teamsError) {
    return <div className="container mx-auto py-10 text-center text-destructive">Error loading teams: {teamsError.message}</div>;
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Boomerang CI/CD Metrics</CardTitle>
            <CardDescription>Monitor your team's pipeline performance.</CardDescription>
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
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {(isLoadingTeams || isLoadingMetrics) && !metrics && <p className="text-center">Loading metrics...</p>}
      {!selectedTeamId && !isLoadingTeams && <p className="text-center text-muted-foreground">Please select a team to view metrics.</p>}
      
      {selectedTeamId && metrics?.info && 
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">{metrics.info}</p>
          </CardContent>
        </Card>
      }

      {selectedTeamId && displayMetrics && (
         <Tabs defaultValue="cumulative" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cumulative">Cumulative View</TabsTrigger>
            <TabsTrigger value="repo-wise" disabled>Repo-wise View (NA)</TabsTrigger>
          </TabsList>
          <TabsContent value="cumulative">
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Build Success Rate</CardTitle>
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displayMetrics.buildSuccessRate.toFixed(1)}%</div>
                  <Progress value={displayMetrics.buildSuccessRate} className="mt-2 h-2" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Deployment Time</CardTitle>
                   <Rocket className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                   <div className="text-2xl font-bold">15m 30s</div> 
                   <p className="text-xs text-muted-foreground">(Placeholder data)</p>
                </CardContent>
              </Card>
            </div>
             <p className="text-sm text-muted-foreground mt-4 text-right">Last refreshed: {displayMetrics.lastRefreshed}</p>
          </TabsContent>
           <TabsContent value="repo-wise">
            <p className="text-center text-muted-foreground py-8">Repo-wise view is not yet available.</p>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
