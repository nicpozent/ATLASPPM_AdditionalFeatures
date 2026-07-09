// Sprints tab (agile-with-sprints projects only) — sprint cards with metrics,
// collapsible task lists, and the create/edit sprint modal. Extracted from
// Project.tsx unchanged (ADR-0041).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, ProgressBar, Button, Modal, Input, Select } from "@/components/ui";
import { toastError } from "@/components/Toast";
import { DecLabel } from "./shared";
import { type Task } from "./taskModel";
import { SprintTaskRow } from "./TaskModals";

interface SprintItem {
  id: number; name: string; goal: string; startDate: string; endDate: string; status: string;
  committedPoints: number; taskCount: number; doneCount: number; points: number; donePoints: number; spilledCount: number;
}
const SPRINT_STATUSES = ["Planned", "Started", "Halted", "Completed", "Cancelled"];
const SPRINT_STATUS: Record<string, { ink: string; tint: string }> = {
  Started:   { ink: color.successInk, tint: color.successTint },
  Planned:   { ink: color.subtle, tint: color.bg },
  Halted:    { ink: color.warningInk, tint: color.warningTint },
  Completed: { ink: color.primaryDark, tint: color.primaryTint2 },
  Cancelled: { ink: color.dangerInk, tint: color.dangerTint },
  // legacy values from before the lifecycle expansion
  Active:    { ink: color.successInk, tint: color.successTint },
  Closed:    { ink: color.primaryDark, tint: color.primaryTint2 },
};

export function Sprints({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<SprintItem | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data } = useQuery({
    queryKey: ["sprints", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; canCreate: boolean; sprints: SprintItem[] }> =>
      (await api<{ canEdit: boolean; canCreate: boolean; sprints: SprintItem[] }>(`/projects/${projectId}/sprints`)) ?? { canEdit: false, canCreate: false, sprints: [] },
  });
  // Tasks drive the per-sprint list (grouped by sprint name); dedupes with the
  // Tasks/Backlog tabs' identical query.
  const { data: taskData } = useQuery({
    queryKey: ["tasks", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; tasks: Task[]; canCreate?: boolean }> =>
      (await api<{ canEdit: boolean; tasks: Task[]; canCreate?: boolean }>(`/projects/${projectId}/tasks`)) ?? { canEdit: false, tasks: [] },
  });
  const allTasks = taskData?.tasks ?? [];
  const sprints = data?.sprints ?? [];
  const canEdit = data?.canEdit ?? false;
  const canCreate = data?.canCreate ?? false;
  const toggle = (id: number) => setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const del = useMutation({
    mutationFn: (id: number) => api(`/sprints/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints", projectId] }),
    onError: (e) => toastError(e),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its sprints." /></Card>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: color.ink }}>Sprints</div>
        <div style={{ flex: 1 }} />
        <Button onClick={() => setModal(true)} disabled={!canCreate} title={canCreate ? undefined : "Your role can't create sprints (needs the Project schedule right)"}><Icon name="plus" size={16} /> New sprint</Button>
      </div>

      {sprints.length === 0 ? (
        <Card><EmptyBlock minHeight={200} message="No sprints planned yet. Create one to group tasks into an iteration." /></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sprints.map((s) => {
            const sc = SPRINT_STATUS[s.status] ?? SPRINT_STATUS.Planned;
            const pct = s.committedPoints > 0 ? Math.min(100, Math.round((100 * s.donePoints) / s.committedPoints)) : (s.points > 0 ? Math.round((100 * s.donePoints) / s.points) : 0);
            return (
              <Card key={s.id} padding={18}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                      <span style={{ fontFamily: font.head, fontSize: 15.5, fontWeight: 700, color: color.ink }}>{s.name}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "2px 9px", borderRadius: 20 }}>{s.status}</span>
                      {s.spilledCount > 0 && <span title={`${s.spilledCount} task(s) carried in from another sprint`} style={{ fontSize: 10, fontWeight: 700, color: color.warningInk, background: color.warningTint, border: `1px solid ${color.warnBorder}`, borderRadius: 5, padding: "1px 6px" }}>{s.spilledCount} spilled-in</span>}
                    </div>
                    {s.goal && <div style={{ fontSize: 12.5, color: color.subtle, marginBottom: 4 }}>{s.goal}</div>}
                    <div style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono }}>{s.startDate || "—"} → {s.endDate || "—"}</div>
                  </div>
                  {canEdit && (
                    <div style={{ display: "flex", gap: 7 }}>
                      <Button variant="secondary" onClick={() => setEdit(s)}><Icon name="edit" size={15} /> Edit</Button>
                      <button onClick={() => { if (confirm(`Delete sprint “${s.name}”? Tasks stay, but lose this iteration.`)) del.mutate(s.id); }} title="Delete sprint" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, border: `1px solid ${color.border}`, background: color.surface, cursor: "pointer", color: color.dangerInk }}><Icon name="trash" size={15} /></button>
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${color.bg}` }}>
                  <SprintMetric label="Committed" value={`${s.committedPoints} pts`} />
                  <SprintMetric label="Completed" value={`${s.donePoints} pts`} />
                  <SprintMetric label="Tasks" value={`${s.doneCount} / ${s.taskCount} done`} />
                  <div>
                    <div style={{ fontSize: 10.5, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Progress</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <ProgressBar pct={pct} height={7} />
                      <span style={{ fontFamily: font.head, fontSize: 13, fontWeight: 700, color: color.ink }}>{pct}%</span>
                    </div>
                  </div>
                </div>
                {(() => {
                  const sprintTasks = allTasks.filter((t) => t.sprint === s.name);
                  const open = expanded.has(s.id);
                  return (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${color.bg}` }}>
                      <button onClick={() => toggle(s.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: color.primary, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                        <Icon name={open ? "chevronDown" : "chevronRight"} size={15} /> {sprintTasks.length} task{sprintTasks.length === 1 ? "" : "s"}
                      </button>
                      {open && (sprintTasks.length === 0 ? (
                        <div style={{ fontSize: 12, color: color.faint3, marginTop: 8, paddingLeft: 4 }}>No tasks in this sprint yet.</div>
                      ) : (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 1 }}>
                          {sprintTasks.map((t) => <SprintTaskRow key={t.id} t={t} />)}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Card>
            );
          })}
        </div>
      )}

      {modal && <SprintModal projectId={projectId} onClose={() => setModal(false)} />}
      {edit && <SprintModal projectId={projectId} sprint={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function SprintMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: color.text }}>{value}</div>
    </div>
  );
}

function SprintModal({ projectId, sprint, onClose }: { projectId: string; sprint?: SprintItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(sprint?.name ?? "");
  const [goal, setGoal] = useState(sprint?.goal ?? "");
  const [startDate, setStartDate] = useState(sprint?.startDate ?? "");
  const [endDate, setEndDate] = useState(sprint?.endDate ?? "");
  const [status, setStatus] = useState(sprint?.status ?? "Planned");
  const [committed, setCommitted] = useState(String(sprint?.committedPoints || ""));

  const body = () => JSON.stringify({
    name: name.trim(), goal: goal.trim(), startDate: startDate.trim(), endDate: endDate.trim(),
    status, committedPoints: Number(committed) || 0,
  });
  const save = useMutation({
    mutationFn: () => sprint
      ? api(`/sprints/${sprint.id}`, { method: "PATCH", body: body() })
      : api(`/projects/${projectId}/sprints`, { method: "POST", body: body() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sprints", projectId] }); onClose(); },
    onError: (e) => toastError(e),
  });

  return (
    <Modal onClose={onClose} width={480} label={sprint ? "Edit sprint" : "New sprint"}>
      <DecLabel>Name</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PI2 · S5" style={{ marginBottom: 14 }} />
      <DecLabel>Goal</DecLabel>
      <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Sprint goal" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Start date</DecLabel><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div style={{ flex: 1 }}><DecLabel>End date</DecLabel><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{SPRINT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Committed points</DecLabel><Input type="number" min={0} value={committed} onChange={(e) => setCommitted(e.target.value)} placeholder="auto from tasks" /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (name.trim()) save.mutate(); }} disabled={save.isPending || !name.trim()}>{save.isPending ? "Saving…" : sprint ? "Save changes" : "Add sprint"}</Button>
      </div>
    </Modal>
  );
}
