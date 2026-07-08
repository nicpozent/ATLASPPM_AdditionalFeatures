// The project-detail query, shared by Project.tsx and the extracted tab modules
// (Tasks needs the Jira mapping / methodology). Relocated here so the tab files
// can import it without a circular dependency back into Project.tsx (ADR-0041).
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";

export interface ProjectDetail {
  id: string; name: string; dept: string; owner: string; methodology: string;
  status: string; health: string; progress: number; phase: string;
  budget: number; spent: number; due: string; startDate?: string; target?: string; summary?: string;
  jiraProjectKey?: string; jiraBoardId?: number | null; lastJiraSync?: string;
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ["project", id], retry: false, enabled: !!id, staleTime: 60_000,
    queryFn: async (): Promise<ProjectDetail | null> => {
      try { return await api<ProjectDetail>(`/projects/${id}`); } catch { return null; }
    },
  });
}
