// Portfolio data layer — empty by default until the API exists.
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";

export interface Project {
  id: string; name: string; dept: string; owner: string; methodology: string;
  status: "green" | "amber" | "red" | "hold"; health: string; progress: number;
  budget: number; spent: number; target: string; blockerCount: number;
}
export type BlockerStatus = "Active" | "In progress" | "Resolved";
export interface Blocker {
  id: string; title: string; projectId: string; projectName: string; owner: string; status: BlockerStatus;
}

export const STATUS_FILTERS = [
  { key: "all",   label: "All",      match: () => true,                           ink: "#fff",     tint: "#0F6CBD" },
  { key: "green", label: "On track", match: (p: Project) => p.status === "green", ink: "#0B6B37", tint: "#E7F4EC" },
  { key: "amber", label: "At risk",  match: (p: Project) => p.status === "amber", ink: "#8A6300", tint: "#FBF2D7" },
  { key: "red",   label: "Critical", match: (p: Project) => p.status === "red",   ink: "#A1282B", tint: "#FBE7E8" },
  { key: "hold",  label: "On hold",  match: (p: Project) => p.status === "hold",  ink: "#566077", tint: "#EEF0F4" },
] as const;

export function useProjects() {
  return useQuery({
    queryKey: ["projects"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Project[]> => {
      try { return (await api<Project[]>("/projects")) ?? []; } catch { return []; }
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
