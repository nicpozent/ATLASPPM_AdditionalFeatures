// Tasks tab — board + table views, drag-to-move, assignee filter, Jira pull-sync.
// Extracted from Project.tsx unchanged (ADR-0041).
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { syncJira, syncToast } from "@/lib/jiraSync";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, Button, Select } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { toast } from "@/components/Toast";
import { useProject } from "./useProject";
import { type Task, BOARD_COLS, TASK_PRIORITY, useAssigneeOptions, useEpicOptions, useSprintOptions } from "./taskModel";
import { TaskDetailModal, NewTaskModal } from "./TaskModals";

export function Tasks({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const { data: project } = useProject(projectId);
  const [view, setView] = useState<"board" | "table">("board");
  const [modal, setModal] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [assignee, setAssignee] = useState("");   // "" ⇒ all assignees
  const dragId = useRef<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const assigneeOptions = useAssigneeOptions(projectId);
  const epicOptions = useEpicOptions(projectId);
  const sprintOptions = useSprintOptions(projectId);

  // Jira pull-sync — only offered when this project is mapped to a Jira board and
  // the role can manage integrations. Refreshes everything the sync writes.
  const jiraMapped = !!project?.jiraProjectKey && !!project?.jiraBoardId;
  const canSyncJira = can("cap-integrations", "E");
  // Runs in the background (see syncJira/ADR-0030) so a large re-sync can't 504.
  const syncProject = useMutation({
    mutationFn: () => syncJira(`/projects/${projectId}/jira/sync`, false),
    onSuccess: (o) => {
      toast(syncToast(o), o.ok || o.state === "running" ? "info" : "error");
      if (o.ok || o.state === "running") {
        for (const k of ["tasks", "epics", "sprints", "spillover", "raid"]) qc.invalidateQueries({ queryKey: [k, projectId] });
        qc.invalidateQueries({ queryKey: ["spillover-summary"] });
      }
    },
    onError: (e) => toast((e as Error).message, "error"),
  });

  const { data } = useQuery({
    queryKey: ["tasks", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; tasks: Task[]; canCreate?: boolean }> =>
      (await api<{ canEdit: boolean; tasks: Task[]; canCreate?: boolean }>(`/projects/${projectId}/tasks`)) ?? { canEdit: false, tasks: [] },
  });
  const move = useMutation({
    mutationFn: (v: { id: number; status: string }) => api(`/tasks/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: v.status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
  const replan = useMutation({
    mutationFn: (v: { id: number; sprint: string }) => api(`/tasks/${v.id}`, { method: "PATCH", body: JSON.stringify({ sprint: v.sprint }) }),
    onSuccess: () => {
      // Re-planning changes spillover → refresh the board, the RAID log and the
      // Overview / portfolio spillover figures that derive from it.
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["spillover", projectId] });
      qc.invalidateQueries({ queryKey: ["raid", projectId] });
      qc.invalidateQueries({ queryKey: ["spillover-summary"] });
    },
  });

  const tasks = data?.tasks ?? [];
  const canEdit = data?.canEdit ?? false;
  const canCreate = data?.canCreate ?? false;
  const isSpilled = (t: Task) => !!t.sprint && !!t.baseline && t.sprint !== t.baseline;
  // Assignee filter: options are the assignees actually present on the board.
  const assignees = Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean))).sort();
  const shown = assignee ? tasks.filter((t) => t.assignee === assignee) : tasks;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its tasks." /></Card>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "inline-flex", background: color.border3, borderRadius: 10, padding: 3, gap: 2 }}>
          {(["board", "table"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "6px 15px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", textTransform: "capitalize", background: view === v ? color.surface : "transparent", color: view === v ? color.primary : color.subtle, boxShadow: view === v ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>{v}</button>
          ))}
        </div>
        {assignees.length > 0 && (
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} title="Filter by assignee" style={{ maxWidth: 190, fontSize: 12.5, padding: "7px 10px" }}>
            <option value="">All assignees</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        )}
        <div style={{ flex: 1 }} />
        {jiraMapped && (
          <Button variant="secondary" onClick={() => syncProject.mutate()} disabled={syncProject.isPending || !canSyncJira} title={canSyncJira ? `Pull ${project?.jiraProjectKey} / board ${project?.jiraBoardId} from Jira` : "Needs Edit on Integrations & connectors"}>
            <Icon name="refresh" size={15} /> {syncProject.isPending ? "Syncing…" : "Sync from Jira"}
          </Button>
        )}
        <Button onClick={() => setModal(true)} disabled={!canCreate} title={canCreate ? undefined : "Your role can't create tasks (needs the Project schedule right)"}><Icon name="plus" size={16} /> New task</Button>
      </div>

      {view === "board" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, alignItems: "start" }}>
          {BOARD_COLS.map((c) => {
            const cards = shown.filter((t) => t.status === c.label);
            const over = overCol === c.label;
            return (
              <div key={c.label}
                onDragOver={(e) => { if (canEdit) { e.preventDefault(); if (overCol !== c.label) setOverCol(c.label); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = dragId.current; dragId.current = null; setOverCol(null);
                  const t = tasks.find((x) => x.id === id);
                  if (id && t && t.status !== c.label) move.mutate({ id, status: c.label });
                }}
                style={{ background: over ? color.primaryTint : color.surfaceAlt, border: `1px ${over ? "dashed" : "solid"} ${over ? color.primary : color.border3}`, borderRadius: 13, padding: 10, minHeight: 120 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, padding: "2px 4px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: color.textMuted }}>{c.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.ink, background: c.tint, padding: "1px 8px", borderRadius: 20 }}>{cards.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {cards.map((t) => {
                    const pr = TASK_PRIORITY[t.priority] ?? TASK_PRIORITY.Medium;
                    return (
                      <div key={t.id} draggable={canEdit} onDragStart={() => { dragId.current = t.id; }}
                        onClick={() => setOpenId(t.id)}
                        style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 11, padding: 12, cursor: "pointer", boxShadow: "0 1px 2px rgba(20,26,60,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                          <span style={{ fontFamily: font.mono, fontSize: 10, color: color.faint3 }}>{t.code}</span>
                          <span style={{ flex: 1 }} />
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: pr.ink, background: pr.tint, padding: "1px 6px", borderRadius: 20 }}>{t.priority}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: color.text, lineHeight: 1.35, marginBottom: 9 }}>{t.name}</div>
                        {(isSpilled(t) || t.assigneeOnLeave || t.assigneeKnown === false) && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                            {isSpilled(t) && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, color: color.warningInk, background: color.warningTint, border: `1px solid ${color.warnBorder}`, borderRadius: 5, padding: "1px 6px" }} title={`Baselined in ${t.baseline}, now in ${t.sprint}`}>
                                <Icon name="alert" size={11} /> Spilled · {t.baseline} → {t.sprint}
                              </span>
                            )}
                            {t.assigneeOnLeave && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, color: color.dangerInk, background: color.dangerTint, border: `1px solid ${color.dangerBorder}`, borderRadius: 5, padding: "1px 6px" }} title={`${t.assignee} is on leave during this task's scheduled window`}>
                                <Icon name="alert" size={11} /> Assignee on leave
                              </span>
                            )}
                            {t.assigneeKnown === false && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, color: color.warningInk, background: color.warningTint, border: `1px solid ${color.warnBorder}`, borderRadius: 5, padding: "1px 6px" }} title={`${t.assignee} isn't an onboarded team member (not synced from Entra).`}>
                                <Icon name="alert" size={11} /> Assignee not onboarded
                              </span>
                            )}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: color.faint }}>
                          <span style={{ fontFamily: font.mono }}>{t.sprint || "—"}</span>
                          {t.points > 0 && <span style={{ fontWeight: 700, color: color.faint2 }}>{t.points} pt</span>}
                          {t.size && <span style={{ fontWeight: 700, color: color.faint2 }}>{t.size}</span>}
                          <span style={{ flex: 1 }} />
                          <span>{t.assignee}</span>
                        </div>
                      </div>
                    );
                  })}
                  {cards.length === 0 && <div style={{ fontSize: 11.5, color: color.faint3, textAlign: "center", padding: "14px 6px" }}>No tasks</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 0.9fr 0.9fr 0.9fr 1fr", padding: "14px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
            <div>Task</div><div>Epic</div><div>Assignee</div><div>Sprint</div><div>Baseline</div><div>Status</div>
          </div>
          {shown.length === 0 ? (
            <EmptyBlock message={assignee ? `No tasks for ${assignee}.` : "No tasks yet."} minHeight={140} />
          ) : shown.map((t) => {
            const col = BOARD_COLS.find((c) => c.label === t.status) ?? BOARD_COLS[0];
            return (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 0.9fr 0.9fr 0.9fr 1fr", alignItems: "center", padding: "14px 22px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3, flex: "none" }}>{t.code}</span>
                  <button onClick={() => setOpenId(t.id)} style={{ fontSize: 13.5, fontWeight: 600, color: color.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>{t.name}</button>
                  {t.assigneeOnLeave && <span title={`${t.assignee} is on leave during this task's scheduled window`} style={{ flex: "none", fontSize: 9, fontWeight: 700, color: color.dangerInk, background: color.dangerTint, border: `1px solid ${color.dangerBorder}`, borderRadius: 4, padding: "0 5px" }}>ON LEAVE</span>}
                  {t.assigneeKnown === false && <span title={`${t.assignee} isn't an onboarded team member (not synced from Entra) — add them to a team or check the name.`} style={{ flex: "none", fontSize: 9, fontWeight: 700, color: color.warningInk, background: color.warningTint, border: `1px solid ${color.warnBorder}`, borderRadius: 4, padding: "0 5px" }}>⚠ NOT ONBOARDED</span>}
                </div>
                <div style={{ fontSize: 12.5, color: color.subtle }}>{t.epic || "—"}</div>
                <div style={{ fontSize: 13, color: color.textMuted }}>{t.assignee}</div>
                <div>
                  {canEdit ? (
                    <input
                      key={t.sprint} defaultValue={t.sprint}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== t.sprint) replan.mutate({ id: t.id, sprint: v }); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      placeholder="—" title="Re-plan sprint — moving off the baseline flags it as spilled"
                      style={{ width: 84, fontFamily: font.mono, fontSize: 12, fontWeight: isSpilled(t) ? 700 : 400, color: isSpilled(t) ? "#8A6300" : color.textMuted, background: isSpilled(t) ? color.warningTint : "#fff", border: `1px solid ${isSpilled(t) ? color.warnBorder : color.border}`, borderRadius: 6, padding: "4px 7px" }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, fontFamily: font.mono, fontWeight: isSpilled(t) ? 700 : 400, color: isSpilled(t) ? "#8A6300" : color.faint }}>{t.sprint || "—"}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: color.faint, fontFamily: font.mono, display: "flex", alignItems: "center", gap: 6 }}>
                  {t.baseline || "—"}
                  {isSpilled(t) && <span title={`Baselined in ${t.baseline}`} style={{ fontSize: 9, fontWeight: 700, color: color.warningInk, background: color.warningTint, border: `1px solid ${color.warnBorder}`, borderRadius: 4, padding: "0 5px" }}>SPILLED</span>}
                </div>
                <div><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: col.ink, background: col.tint, padding: "3px 10px", borderRadius: 20 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: col.color }} />{t.status}</span></div>
              </div>
            );
          })}
        </Card>
      )}

      {modal && <NewTaskModal projectId={projectId} assigneeOptions={assigneeOptions} epicOptions={epicOptions} sprintOptions={sprintOptions} onClose={() => setModal(false)} />}
      {openId !== null && (() => {
        const t = tasks.find((x) => x.id === openId);
        if (!t) return null;
        return <TaskDetailModal projectId={projectId} task={t} canEdit={canEdit} assigneeOptions={assigneeOptions} epicOptions={epicOptions} sprintOptions={sprintOptions} onClose={() => setOpenId(null)} />;
      })()}
    </div>
  );
}
