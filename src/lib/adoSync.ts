import { api } from "@/api";

// Background Azure DevOps sync driver — the ADO analogue of jiraSync (ADR-0039).
// A large work-item pull can exceed the edge timeout, so the UI runs it in the
// BACKGROUND: the POST returns a job id (202) and we poll its status. Falls back
// gracefully if the server ran synchronously (no jobId) or reported a config error.
export interface AdoSyncOutcome {
  ok: boolean;
  state?: "done" | "failed" | "running";
  projects?: number; sprints?: number; epics?: number; tasks?: number;
  error?: string; message?: string; errors?: string[];
}

interface QueuedResp { ok: boolean; queued?: boolean; jobId?: string; error?: string; message?: string; projects?: number; sprints?: number; epics?: number; tasks?: number; }
interface JobStatus { state: string; projects?: number; sprints?: number; epics?: number; tasks?: number; error?: string; errors?: string[]; }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function syncAdo(path: string, delta = false): Promise<AdoSyncOutcome> {
  const sep = path.includes("?") ? "&" : "?";
  const r = await api<QueuedResp>(`${path}${sep}delta=${delta}&background=true`, { method: "POST" });
  if (!r) return { ok: false, message: "No response from server." };
  if (r.ok === false) return { ok: false, error: r.error, message: r.message };
  // Server ran synchronously (didn't queue) — return its counts directly.
  if (!r.queued || !r.jobId) return { ok: true, state: "done", projects: r.projects, sprints: r.sprints, epics: r.epics, tasks: r.tasks };
  // Poll the job to completion (~90s ceiling).
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    const s = await api<JobStatus>(`/integrations/ado/sync/status/${r.jobId}`);
    if (s && (s.state === "done" || s.state === "failed"))
      return { ok: s.state === "done", state: s.state as AdoSyncOutcome["state"], projects: s.projects, sprints: s.sprints, epics: s.epics, tasks: s.tasks, error: s.error, errors: s.errors };
  }
  return { ok: true, state: "running" };
}

// Human-readable toast text for an outcome.
export function adoSyncToast(o: AdoSyncOutcome): string {
  if (!o.ok && o.state !== "failed") return o.error || o.message || "Nothing to sync.";
  if (o.state === "failed") return `Azure DevOps sync failed${o.error ? `: ${o.error}` : ""}`;
  if (o.state === "running") return "Sync still running in the background — refresh shortly.";
  const bits = [o.projects != null ? `${o.projects} projects` : null, o.tasks != null ? `${o.tasks} tasks` : null, o.sprints != null ? `${o.sprints} sprints` : null].filter(Boolean).join(" · ");
  return bits ? `Synced from Azure DevOps — ${bits}` : "Synced from Azure DevOps";
}
