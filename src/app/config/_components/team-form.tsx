
// src/app/config/_components/team-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { TeamFormData } from "@/lib/schemas";
import { TeamSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { Team } from "./types";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useAddTeam } from '@/hooks/use-team-queries';

interface TeamFormProps {
  initialTeams: Team[];
}

export function TeamForm({ initialTeams }: TeamFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  
  const addTeamMutation = useAddTeam();

  const form = useForm<TeamFormData>({
    resolver: zodResolver(TeamSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  async function onSubmit(data: TeamFormData) {
    addTeamMutation.mutate(data, {
      onSuccess: (result) => {
        if (result.success && result.data) {
          toast({
            title: "Success",
            description: `Team "${(result.data as Team).name}" added successfully.`,
          });
          form.reset();
          router.refresh(); // Refreshes server components and re-runs RSC data fetching
                           // React Query invalidation (in useAddTeam) will handle client components
        } else {
          toast({
            title: "Error",
            description: result.message || "Failed to add team.",
            variant: "destructive",
          });
        }
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter team name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={addTeamMutation.isPending}>
            {addTeamMutation.isPending ? "Adding Team..." : "Add Team"}
          </Button>
        </form>
      </Form>

      {teams.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Existing Teams</CardTitle>
            <CardDescription>List of all configured teams.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <ul className="space-y-2">
                {teams.map((team) => (
                  <li key={team.id} className="flex items-center gap-2 p-2 border rounded-md shadow-sm">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span>{team.name}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
