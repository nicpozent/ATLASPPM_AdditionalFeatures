// Task-domain types, constants and option hooks shared by the Tasks, Backlog,
// Sprints and Epics tabs. Non-component code lives here (a `.ts`) so the sibling
// component files keep clean React fast-refresh (ADR-0041).
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";

export interface Task {
  id: number; code: string; name: string; epic: string; assignee: string; status: string;
  sprint: string; baseline: string; priority: string;
  startDate: string; targetDate: string; points: number; size: string; estimateHours: number;
  assigneeOnLeave: boolean;
  assigneeKnown?: boolean;
  // Rich fields carried across from Jira (empty/zero for locally-created tasks).
  description?: string; issueType?: string; reporter?: string; statusName?: string;
  resolution?: string; labels?: string[]; components?: string[]; fixVersions?: string[];
  parentKey?: string; epicKey?: string; timeSpentHours?: number;
  jiraKey?: string; jiraUrl?: string; jiraCreated?: string; jiraUpdated?: string;
  attachmentCount?: number; commentCount?: number;
}

export interface TaskAttachment { id: number; fileName: string; contentType: string; size: number; author: string; createdAt: string; }

// Methodologies that run in fixed-length sprints/iterations get the Sprints tab.
export const AGILE_WITH_SPRINTS = ["Scrum", "SAFe", "Scrumban", "Disciplined Agile"];
export const isAgileWithSprints = (m?: string) => !!m && AGILE_WITH_SPRINTS.includes(m);

export const BOARD_COLS = [
  { label: "To Do", color: "#8A93A6", tint: "#EEF1F6", ink: "#56607A" },
  { label: "In Progress", color: "#0F6CBD", tint: "#E6EFFB", ink: "#0C5798" },
  { label: "In Review", color: "#E0A100", tint: "#FBF2D7", ink: "#8A6300" },
  { label: "Done", color: "#15A34A", tint: "#E7F4EC", ink: "#0B6B37" },
  { label: "Blocked", color: "#D13438", tint: "#FBE7E8", ink: "#A1282B" },
];
export const TASK_PRIORITY: Record<string, { ink: string; tint: string }> = {
  Critical: { ink: "#A1282B", tint: "#FBE7E8" },
  High:     { ink: "#8A6300", tint: "#FBF2D7" },
  Medium:   { ink: "#0C5798", tint: "#E6EFFB" },
  Low:      { ink: "#56607A", tint: "#EEF1F6" },
};
export const TASK_PRIORITIES = ["Critical", "High", "Medium", "Low"];
export const TASK_STATUSES = ["To Do", "In Progress", "In Review", "Done", "Blocked"];
export const TASK_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export function useAssigneeOptions(projectId: string | null): string[] {
  // People attached to the project (role + team/sub-team/individual) first, then
  // the rest of the onboarded roster as a fallback pool — resolved server-side so
  // the dropdown is populated even before a sub-team is attached.
  const { data } = useQuery({
    queryKey: ["assignee-options", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<string[]> => {
      try { return (await api<string[]>(`/projects/${projectId}/assignee-options`)) ?? []; } catch { return []; }
    },
  });
  return useMemo(() => (data ?? []).filter((n) => n?.trim()), [data]);
}

// Epic names for the task epic dropdown (tasks tie to an epic by name).
export function useEpicOptions(projectId: string | null): string[] {
  const { data } = useQuery({
    queryKey: ["epics", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ epics: { name: string }[] } | null> => {
      try { return await api(`/projects/${projectId}/epics`); } catch { return null; }
    },
  });
  return (data?.epics ?? []).map((e) => e.name);
}

// Sprint names for the task sprint dropdown (tasks tie to a sprint by name).
export function useSprintOptions(projectId: string | null): string[] {
  const { data } = useQuery({
    queryKey: ["sprints", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ sprints: { name: string }[] } | null> => {
      try { return await api(`/projects/${projectId}/sprints`); } catch { return null; }
    },
  });
  return (data?.sprints ?? []).map((s) => s.name);
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
