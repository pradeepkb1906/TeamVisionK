// src/app/config/_components/team-members-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { TeamMemberFormData } from "@/lib/schemas";
import { TeamMemberSchema } from "@/lib/schemas";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { saveTeamMember, getTeamMembers } from "@/lib/actions";
import type { Team } from "./types";
import { TECHNOLOGIES, BANDS } from "@/lib/constants";
import { useState, useEffect } from "react";
import { PlusCircle, Users, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


interface TeamMembersFormProps {
  teams: Team[];
}

type TeamMemberWithId = TeamMemberFormData & { id: string };

export function TeamMembersForm({ teams }: TeamMembersFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [currentTeamMembers, setCurrentTeamMembers] = useState<TeamMemberWithId[]>([]);

  const form = useForm<TeamMemberFormData>({
    resolver: zodResolver(TeamMemberSchema),
    defaultValues: {
      teamId: "",
      technology: undefined,
      band: undefined,
      rate: 0,
      numResources: 1,
    },
  });
  
  const watchTeamId = form.watch("teamId");

  useEffect(() => {
    async function fetchTeamMembers() {
      if (watchTeamId) {
        setIsLoadingMembers(true);
        setCurrentTeamMembers([]); // Clear previous members
        try {
          const members = await getTeamMembers(watchTeamId);
          setCurrentTeamMembers(members);
        } catch (error) {
          toast({ title: "Error", description: "Could not load team members.", variant: "destructive" });
        } finally {
          setIsLoadingMembers(false);
        }
      } else {
        setCurrentTeamMembers([]);
      }
      // Reset form fields for new entry, keeping teamId if selected
      form.reset({
        teamId: watchTeamId || "",
        technology: undefined,
        band: undefined,
        rate: 0,
        numResources: 1,
      });
    }
    fetchTeamMembers();
  }, [watchTeamId, form, toast]);


  async function onSubmit(data: TeamMemberFormData) {
    setIsSubmitting(true);
    const result = await saveTeamMember(data);
    if (result.success && result.data) {
      toast({ title: "Success", description: "Team member details saved." });
      // Add to current list client-side for immediate feedback
      setCurrentTeamMembers(prev => [...prev, result.data as TeamMemberWithId]);
      form.reset({ // Reset form for next entry, keeping selected teamId
        teamId: data.teamId, 
        technology: undefined,
        band: undefined,
        rate: 0,
        numResources: 1,
      });
      router.refresh(); // Ensure other parts of app relying on this data get updated
    } else {
      toast({ title: "Error", description: result.message || "Failed to save team member.", variant: "destructive" });
    }
    setIsSubmitting(false);
  }

  // Placeholder for delete functionality if needed in future
  // async function handleDeleteMember(memberId: string) {
  //   // Call a delete action, then refresh or update client state
  //   toast({title: "Info", description: `Delete for ${memberId} not implemented.`})
  // }

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="teamId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Team</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value || undefined}
                  disabled={isLoadingMembers}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="technology"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Technology</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || undefined}
                    disabled={isLoadingMembers || !watchTeamId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select technology" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TECHNOLOGIES.map((tech) => (
                        <SelectItem key={tech} value={tech}>{tech}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="band"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Band</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || undefined}
                    disabled={isLoadingMembers || !watchTeamId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select band" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BANDS.map((band) => (
                        <SelectItem key={band} value={band}>{band}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter rate" {...field} disabled={isLoadingMembers || !watchTeamId}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="numResources"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Resources</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter number of resources" {...field} disabled={isLoadingMembers || !watchTeamId} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <Button type="submit" disabled={isSubmitting || isLoadingMembers || !watchTeamId}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Add Team Member Details"}
          </Button>
        </form>
      </Form>

      {watchTeamId && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Current Team Members
            </CardTitle>
            <CardDescription>
              {isLoadingMembers ? "Loading members..." : `Showing members for the selected team.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMembers ? (
              <p>Loading...</p>
            ) : currentTeamMembers.length > 0 ? (
              <ScrollArea className="h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Technology</TableHead>
                      <TableHead>Band</TableHead>
                      <TableHead className="text-right">Rate (USD)</TableHead>
                      <TableHead className="text-right">Resources</TableHead>
                      {/* <TableHead className="text-right">Actions</TableHead> */}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentTeamMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>{member.technology}</TableCell>
                        <TableCell>{member.band}</TableCell>
                        <TableCell className="text-right">${member.rate.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{member.numResources}</TableCell>
                        {/* <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteMember(member.id)} disabled>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell> */}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground">No team members added for this team yet.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
