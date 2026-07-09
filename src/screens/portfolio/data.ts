// Portfolio data layer — empty by default until the API exists.
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";
import { color } from "@/theme";

export interface Project {
  id: string; name: string; dept: string; owner: string; methodology: string;
  status: "green" | "amber" | "red" | "hold" | "completed"; health: string; progress: number;
  budget: number; spent: number; target: string; blockerCount: number;
  archived?: boolean; isSystem?: boolean; startDate?: string;
}
export type ProjectBucket = "active" | "completed" | "archived";
export type BlockerStatus = "Active" | "In progress" | "Resolved" | "Cancelled" | "Archived";
export interface Blocker {
  id: string; title: string; projectId: string; projectName: string; owner: string; status: BlockerStatus; description: string;
}

export interface StatusFilter { key: string; label: string; match: (p: Project) => boolean; ink: string; tint: string; }
export const STATUS_FILTERS: StatusFilter[] = [
  { key: "all",   label: "All",      match: () => true,                           ink: "#fff",     tint: color.primary },
  { key: "green", label: "On track", match: (p: Project) => p.status === "green", ink: color.successInk, tint: color.successTint },
  { key: "amber", label: "At risk",  match: (p: Project) => p.status === "amber", ink: color.warningInk, tint: color.warningTint },
  { key: "red",   label: "Critical", match: (p: Project) => p.status === "red",   ink: color.dangerInk, tint: color.dangerTint },
  { key: "hold",  label: "On hold",  match: (p: Project) => p.status === "hold",  ink: color.subtle, tint: color.neutralTint },
];

export function useProjects(bucket: ProjectBucket = "active") {
  const qs = bucket === "archived" ? "?archived=true" : bucket === "completed" ? "?completed=true" : "";
  return useQuery({
    queryKey: ["projects", bucket], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Project[]> => {
      try { return (await api<Project[]>(`/projects${qs}`)) ?? []; } catch { return []; }
    },
  });
}

export function useBlockers() {
  return useQuery({
    queryKey: ["blockers"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Blocker[]> => {
      try { return (await api<Blocker[]>("/blockers")) ?? []; } catch { return []; }
    },
  });
}
