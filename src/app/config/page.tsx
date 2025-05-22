// src/app/config/page.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamForm } from "./_components/team-form";
import { GithubConfigForm } from "./_components/github-config-form";
import { TeamMembersForm } from "./_components/team-members-form";
import { JiraConfigForm } from "./_components/jira-config-form";
import { SonarQubeConfigForm } from "./_components/sonarqube-config-form";
import { BoomerangConfigForm } from "./_components/boomerang-config-form";
import { ApiKeysForm } from "./_components/api-keys-form";
import { DbConfigForm } from "./_components/db-config-form";
import { getTeams } from "@/lib/actions";
import type { Team } from "./_components/types"; // Will create this type file

export default async function ConfigurationPage() {
  const teams: Team[] = await getTeams();

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8 text-center">TeamOptiVision Configuration</h1>
      <Tabs defaultValue="team" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 mb-6">
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="github">GitHub</TabsTrigger>
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="jira">Jira</TabsTrigger>
          <TabsTrigger value="sonarqube">SonarQube</TabsTrigger>
          <TabsTrigger value="boomerang">Boomerang</TabsTrigger>
          <TabsTrigger value="apikeys">AI Keys</TabsTrigger>
          <TabsTrigger value="dbconfig">DB Config</TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>Add new teams or select an existing team to configure.</CardDescription>
            </CardHeader>
            <CardContent>
              <TeamForm initialTeams={teams} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="github">
          <Card>
            <CardHeader>
              <CardTitle>GitHub Configuration</CardTitle>
              <CardDescription>Configure GitHub integration for a selected team.</CardDescription>
            </CardHeader>
            <CardContent>
              <GithubConfigForm teams={teams} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Add and manage team member details for a selected team.</CardDescription>
            </CardHeader>
            <CardContent>
              <TeamMembersForm teams={teams} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="jira">
          <Card>
            <CardHeader>
              <CardTitle>Jira Configuration</CardTitle>
              <CardDescription>Configure Jira integration for a selected team.</CardDescription>
            </CardHeader>
            <CardContent>
              <JiraConfigForm teams={teams} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sonarqube">
          <Card>
            <CardHeader>
              <CardTitle>SonarQube Configuration</CardTitle>
              <CardDescription>Configure SonarQube integration for a selected team.</CardDescription>
            </CardHeader>
            <CardContent>
              <SonarQubeConfigForm teams={teams} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boomerang">
          <Card>
            <CardHeader>
              <CardTitle>Boomerang Configuration</CardTitle>
              <CardDescription>Configure Boomerang integration for a selected team.</CardDescription>
            </CardHeader>
            <CardContent>
              <BoomerangConfigForm teams={teams} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apikeys">
          <Card>
            <CardHeader>
              <CardTitle>AI API Keys</CardTitle>
              <CardDescription>Manage AI provider API keys for a selected team.</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiKeysForm teams={teams} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dbconfig">
          <Card>
            <CardHeader>
              <CardTitle>Database Configuration</CardTitle>
              <CardDescription>Set up application database parameters (simulated).</CardDescription>
            </CardHeader>
            <CardContent>
              <DbConfigForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
