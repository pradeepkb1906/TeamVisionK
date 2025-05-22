// src/hooks/use-team-queries.ts
"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeams, addTeam } from '@/lib/actions';
import type { TeamFormData } from '@/lib/schemas';
import type { Team } from '@/app/config/_components/types'; // Using existing Team type

export const teamKeys = {
  all: ['teams'] as const,
  list: () => [...teamKeys.all, 'list'] as const,
};

export function useGetTeams() {
  return useQuery<Team[], Error>({
    queryKey: teamKeys.list(),
    queryFn: getTeams,
    // Options like staleTime or cacheTime can be configured here if needed
  });
}

export function useAddTeam() {
  const queryClient = useQueryClient();
  return useMutation<
    { success: boolean; data?: Team; message?: string }, // Matches addTeam return type from actions
    Error,
    TeamFormData
  >({
    mutationFn: addTeam,
    onSuccess: (result) => {
      if (result.success) {
        // When a team is added successfully, invalidate the teams list query.
        // This will cause all components using useGetTeams to re-fetch.
        queryClient.invalidateQueries({ queryKey: teamKeys.list() });
      }
    },
  });
}
