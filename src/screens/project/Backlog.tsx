// Backlog tab — un-sprinted tasks; create, edit, assign to a sprint. Extracted
// from Project.tsx unchanged (ADR-0041).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, Button, Select } from "@/components/ui";
import { toastError } from "@/components/Toast";
import { type Task, TASK_PRIORITY, useAssigneeOptions, useEpicOptions, useSprintOptions } from "./taskModel";
import { TaskDetailModal, NewTaskModal } from "./TaskModals";

export function Backlog({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [assignee, setAssignee] = useState("");   // "" ⇒ all assignees
  const assigneeOptions = useAssigneeOptions(projectId);
  const epicOptions = useEpicOptions(projectId);
  const sprintOptions = useSprintOptions(projectId);

  const { data } = useQuery({
    queryKey: ["tasks", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; tasks: Task[]; canCreate?: boolean }> =>
      (await api<{ canEdit: boolean; tasks: Task[]; canCreate?: boolean }>(`/projects/${projectId}/tasks`)) ?? { canEdit: false, tasks: [] },
  });
  const assign = useMutation({
    mutationFn: (v: { id: number; sprint: string }) => api(`/tasks/${v.id}`, { method: "PATCH", body: JSON.stringify({ sprint: v.sprint, baseline: v.sprint }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["spillover", projectId] });
      qc.invalidateQueries({ queryKey: ["spillover-summary"] });
    },
    onError: (e) => toastError(e),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its backlog." /></Card>;
  const tasks = data?.tasks ?? [];
  const canEdit = data?.canEdit ?? false;
  const canCreate = data?.canCreate ?? false;
  const allBacklog = tasks.filter((t) => !t.sprint);
  const assignees = Array.from(new Set(allBacklog.map((t) => t.assignee).filter(Boolean))).sort();
  const backlog = assignee ? allBacklog.filter((t) => t.assignee === assignee) : allBacklog;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Un-sprinted work. Assign a sprint to pull an item into an iteration.</div>
        <div style={{ flex: 1 }} />
        {assignees.length > 0 && (
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} title="Filter by assignee" style={{ maxWidth: 190, fontSize: 12.5, padding: "7px 10px" }}>
            <option value="">All assignees</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        )}
        <Button onClick={() => setModal(true)} disabled={!canCreate} title={canCreate ? undefined : "Your role can't create tasks (needs the Project schedule right)"}><Icon name="plus" size={16} /> New backlog item</Button>
      </div>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.7fr 2.4fr 1fr 0.7fr 0.7fr 1.1fr", padding: "13px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Code</div><div>Task</div><div>Epic</div><div>Points</div><div>Priority</div><div>Assign sprint</div>
        </div>
        {backlog.length === 0 ? (
          <EmptyBlock message={assignee ? `No backlog items for ${assignee}.` : "Backlog is empty — every task is assigned to a sprint."} minHeight={140} />
        ) : backlog.map((t) => {
          const pr = TASK_PRIORITY[t.priority] ?? TASK_PRIORITY.Medium;
          return (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "0.7fr 2.4fr 1fr 0.7fr 0.7fr 1.1fr", alignItems: "center", padding: "12px 22px", borderBottom: "1px solid #F2F4F9" }}>
              <div style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3 }}>{t.code}</div>
              <button onClick={() => setOpenId(t.id)} style={{ fontSize: 13.5, fontWeight: 600, color: color.primary, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</button>
              <div style={{ fontSize: 12, color: color.subtle }}>{t.epic || "—"}</div>
              <div style={{ fontSize: 12.5, color: color.faint2, fontWeight: 700 }}>{t.points || "—"}</div>
              <div><span style={{ fontSize: 10, fontWeight: 700, color: pr.ink, background: pr.tint, padding: "2px 8px", borderRadius: 20 }}>{t.priority}</span></div>
              <div onClick={(e) => e.stopPropagation()}>
                {canEdit && sprintOptions.length > 0 ? (
                  <Select value="" onChange={(e) => { if (e.target.value) assign.mutate({ id: t.id, sprint: e.target.value }); }} style={{ fontSize: 12, padding: "5px 8px" }}>
                    <option value="">→ Sprint…</option>
                    {sprintOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                ) : (
                  <span style={{ fontSize: 11.5, color: color.faint3 }}>{sprintOptions.length === 0 ? "No sprints yet" : "—"}</span>
                )}
              </div>
            </div>
          );
        })}
      </Card>
      {modal && <NewTaskModal projectId={projectId} assigneeOptions={assigneeOptions} epicOptions={epicOptions} sprintOptions={sprintOptions} onClose={() => setModal(false)} />}
      {openId !== null && (() => {
        const t = tasks.find((x) => x.id === openId);
        if (!t) return null;
        return <TaskDetailModal projectId={projectId} task={t} canEdit={canEdit} assigneeOptions={assigneeOptions} epicOptions={epicOptions} sprintOptions={sprintOptions} onClose={() => setOpenId(null)} />;
      })()}
    </div>
  );
}
