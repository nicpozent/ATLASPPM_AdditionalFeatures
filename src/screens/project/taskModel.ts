// Task-domain types, constants and option hooks shared by the Tasks, Backlog,
// Sprints and Epics tabs. Non-component code lives here (a `.ts`) so the sibling
// component files keep clean React fast-refresh (ADR-0041).
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";
import { color } from "@/theme";

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
  { label: "To Do", color: color.holdBorder, tint: color.neutralTint, ink: color.subtle },
  { label: "In Progress", color: color.primary, tint: color.primaryTint2, ink: color.primaryDark },
  { label: "In Review", color: color.warning, tint: color.warningTint, ink: color.warningInk },
  { label: "Done", color: color.success, tint: color.successTint, ink: color.successInk },
  { label: "Blocked", color: color.danger, tint: color.dangerTint, ink: color.dangerInk },
];
export const TASK_PRIORITY: Record<string, { ink: string; tint: string }> = {
  Critical: { ink: color.dangerInk, tint: color.dangerTint },
  High:     { ink: color.warningInk, tint: color.warningTint },
  Medium:   { ink: color.primaryDark, tint: color.primaryTint2 },
  Low:      { ink: color.subtle, tint: color.neutralTint },
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
