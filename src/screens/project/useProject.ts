// The project-detail query, shared by Project.tsx and the extracted tab modules
// (Tasks needs the Jira mapping / methodology). Relocated here so the tab files
// can import it without a circular dependency back into Project.tsx (ADR-0041).
import { useQuery } from "@tanstack/react-query";
import { api, type Schemas } from "@/api";

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

// ---- Team capacity --------------------------------------------------------
// The /projects/{id}/capacity query was hand-written TWICE — on the Project
// Overview (TeamCapacity) and the Gantt resource view — with two independently
// declared, silently drifting type sets (CapacityRow/CapPerson + two `Capacity`
// interfaces). This is the single source (#97).
//
// The row/envelope types are DERIVED from the generated OpenAPI contract
// (Schemas["CapacityRowDto"/"CapacityDto"]) rather than hand-declared, so a
// backend DTO change breaks this at COMPILE time instead of producing undefined
// at runtime. openapi-typescript marks every C# record field optional/nullable
// (Swashbuckle can't express non-nullability), so we strip that here: the server
// always populates these, and the mapper below defaults any missing value.
type CapacityRowGen = Schemas["CapacityRowDto"];
type CapacityGen = Schemas["CapacityDto"];
export type CapacityPerson = { [K in keyof CapacityRowGen]-?: NonNullable<CapacityRowGen[K]> };
export type Capacity =
  Omit<{ [K in keyof CapacityGen]-?: NonNullable<CapacityGen[K]> }, "people"> & { people: CapacityPerson[] };

export function useCapacity(projectId: string | null) {
  return useQuery({
    queryKey: ["capacity", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<Capacity | null> => {
      const raw = await api<CapacityGen>(`/projects/${projectId}/capacity`);
      if (!raw) return null;
      return {
        assigned: raw.assigned ?? 0, overCount: raw.overCount ?? 0, highOps: raw.highOps ?? 0,
        unknown: raw.unknown ?? [],
        people: (raw.people ?? []).map((p) => ({
          name: p.name ?? "", role: p.role ?? "", initials: p.initials ?? "", color: p.color ?? "",
          opsPct: p.opsPct ?? 0, projectPct: p.projectPct ?? 0, productPct: p.productPct ?? 0,
          util: p.util ?? 0, over: p.over ?? false, highOps: p.highOps ?? false,
        })),
      };
    },
  });
}
