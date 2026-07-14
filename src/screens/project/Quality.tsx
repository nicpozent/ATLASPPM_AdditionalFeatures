// Extracted from Project.tsx — the Quality tab and its modals/types.
// No behaviour change; shared presentational helpers come from ./shared.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, Button, Modal, Input, Select, Textarea } from "@/components/ui";
import { toast, toastError } from "@/components/Toast";
import { DecLabel } from "./shared";
import { sectionTitleS } from "./util";

interface PlanTask { id: number; title: string; status: string; assignee: string; description: string; startDate: string; dueDate: string; estimateHours: number; jiraKey: string; }
interface TestPlan { id: number; name: string; stage: string; cases: number; passed: number; failed: number; blocked: number; notRun: number; execPct: number; jiraBoardId: number; tasks: PlanTask[]; }
const PLAN_TASK_STATUSES = ["Not run", "In test", "Passed", "Failed", "Blocked"];
const PLAN_TASK_COLOR: Record<string, { ink: string; tint: string }> = {
  Passed: { ink: color.successInk, tint: color.successTint }, "In test": { ink: color.primaryDark, tint: color.primaryTint2 },
  Failed: { ink: color.dangerInk, tint: color.dangerTint }, Blocked: { ink: color.warningInk, tint: color.warningTint }, "Not run": { ink: color.subtle, tint: color.bg },
};
interface Defect { id: number; code: string; title: string; severity: string; owner: string; status: string; test: string; }
interface QualityData { canEdit: boolean; totals: { cases: number; coverage: number; passRate: number; failed: number; openDefects: number }; plans: TestPlan[]; defects: Defect[]; }

const QUALITY_SOURCES: [string, string][] = [["jira", "Jira / Xray"], ["ado", "Azure Test Plans"], ["sdp", "ServiceDesk Plus"], ["manual", "Manual"]];
const QA_STAGES = ["Unit", "Integration", "System", "UAT", "Regression", "Performance", "Security"];
const DEFECT_SEVERITIES = ["Critical", "High", "Medium", "Low"];
const DEFECT_STATUSES = ["Open", "In progress", "Resolved", "Closed"];
const SEV_COLOR: Record<string, { ink: string; tint: string }> = {
  Critical: { ink: color.dangerInk, tint: color.dangerTint }, High: { ink: color.warningInk, tint: color.warningTint }, Medium: { ink: color.primaryDark, tint: color.primaryTint2 }, Low: { ink: color.subtle, tint: color.bg },
};
const DEFECT_STATUS_COLOR: Record<string, { ink: string; tint: string }> = {
  Open: { ink: color.dangerInk, tint: color.dangerTint }, "In progress": { ink: color.warningInk, tint: color.warningTint }, Resolved: { ink: color.successInk, tint: color.successTint }, Closed: { ink: color.subtle, tint: color.bg },
};
const DEF_COLS = "0.7fr 2.4fr 0.9fr 1fr 1fr 0.8fr";

export function Quality({ projectId }: { projectId: string | null }) {
  const [source, setSource] = useState("jira");
  const [planModal, setPlanModal] = useState(false);
  const [defectModal, setDefectModal] = useState(false);
  const [openPlan, setOpenPlan] = useState<TestPlan | null>(null);
  const [openDefect, setOpenDefect] = useState<Defect | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const { data } = useQuery({
    queryKey: ["quality", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<QualityData | null> => await api<QualityData>(`/projects/${projectId}/quality`),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its quality data." /></Card>;
  if (!data) return <Card><EmptyBlock minHeight={220} message="Loading quality data…" /></Card>;

  const { totals, plans, defects, canEdit } = data;
  const statCards: [string, number | string, string][] = [
    ["Test cases", totals.cases, color.ink], ["Executed", `${totals.coverage}%`, "#0F6CBD"],
    ["Pass rate", `${totals.passRate}%`, "#0B6B37"], ["Failed", totals.failed, "#A1282B"], ["Open defects", totals.openDefects, color.ink],
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Test plans, execution &amp; defects for this project.</div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: color.faint3 }}>Source</span>
        <div style={{ minWidth: 170 }}><Select value={source} onChange={(e) => setSource(e.target.value)}>{QUALITY_SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 13, marginBottom: 18 }}>
        {statCards.map(([label, value, ink]) => (
          <div key={label} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: "#7B849A" }}>{label}</div>
            <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: ink, marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* test plans */}
      <Card padding={0} style={{ overflow: "hidden", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 22px 13px" }}>
          <span style={{ flex: 1, ...sectionTitleS }}>Test plans &amp; execution</span>
          {canEdit && <Button onClick={() => setPlanModal(true)}><Icon name="plus" size={16} /> New plan</Button>}
        </div>
        {plans.length === 0 ? (
          <EmptyBlock message="No test plans yet." minHeight={110} />
        ) : plans.map((p) => {
          const pct = (n: number) => p.cases === 0 ? "0%" : `${(100 * n / p.cases).toFixed(1)}%`;
          return (
            <div key={p.id} style={{ padding: "13px 22px", borderTop: `1px solid ${color.surfaceAlt}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#5E2E89", background: color.accentTint, padding: "2px 9px", borderRadius: 20 }}>{p.stage}</span>
                <button onClick={() => canEdit && setOpenPlan(p)} style={{ flex: 1, textAlign: "left", fontSize: 13.5, fontWeight: 600, color: canEdit ? color.primary : color.text, background: "none", border: "none", padding: 0, cursor: canEdit ? "pointer" : "default", fontFamily: "inherit" }}>{p.name}</button>
                <span style={{ fontSize: 11.5, color: color.faint }}>{p.cases} cases · {p.execPct}% executed</span>
                <button onClick={() => toggleExpand(p.id)} style={{ fontSize: 11.5, fontWeight: 600, color: color.primary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>{expanded.has(p.id) ? "▾" : "▸"} {p.tasks.length} task{p.tasks.length === 1 ? "" : "s"}</button>
              </div>
              <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", background: color.bg }}>
                <div style={{ width: pct(p.passed), background: "#15A34A" }} />
                <div style={{ width: pct(p.failed), background: "#D13438" }} />
                <div style={{ width: pct(p.blocked), background: "#E0A100" }} />
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 7 }}>
                <span style={{ fontSize: 11, color: color.successInk }}>● {p.passed} passed</span>
                <span style={{ fontSize: 11, color: color.dangerInk }}>● {p.failed} failed</span>
                <span style={{ fontSize: 11, color: color.warningInk }}>● {p.blocked} blocked</span>
                <span style={{ fontSize: 11, color: color.faint3 }}>○ {p.notRun} not run</span>
              </div>
              {expanded.has(p.id) && <PlanTasks projectId={projectId} plan={p} canEdit={canEdit} />}
            </div>
          );
        })}
      </Card>

      {/* defects */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 22px 13px" }}>
          <span style={{ flex: 1, ...sectionTitleS }}>Defects</span>
          {canEdit && <Button onClick={() => setDefectModal(true)}><Icon name="plus" size={16} /> Log defect</Button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: DEF_COLS, padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>ID</div><div>Defect</div><div>Severity</div><div>Owner</div><div>Status</div><div>Test</div>
        </div>
        {defects.length === 0 ? (
          <EmptyBlock message="No defects logged yet." minHeight={110} />
        ) : defects.map((d) => {
          const sv = SEV_COLOR[d.severity] ?? SEV_COLOR.Medium;
          const st = DEFECT_STATUS_COLOR[d.status] ?? DEFECT_STATUS_COLOR.Open;
          return (
            <div key={d.id} onClick={() => canEdit && setOpenDefect(d)} style={{ display: "grid", gridTemplateColumns: DEF_COLS, alignItems: "center", padding: "13px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, cursor: canEdit ? "pointer" : "default" }}>
              <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint3 }}>{d.code}</div>
              <div style={{ fontSize: 13, color: color.text, fontWeight: 500 }}>{d.title}</div>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: sv.ink, background: sv.tint, padding: "3px 9px", borderRadius: 6 }}>{d.severity}</span></div>
              <div style={{ fontSize: 12, color: color.subtle }}>{d.owner}</div>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: st.ink, background: st.tint, padding: "3px 9px", borderRadius: 6 }}>{d.status}</span></div>
              <div style={{ fontSize: 11.5, color: color.subtle, fontFamily: font.mono }}>{d.test || "—"}</div>
            </div>
          );
        })}
      </Card>

      {planModal && <PlanModal projectId={projectId} onClose={() => setPlanModal(false)} />}
      {openPlan && <PlanModal projectId={projectId} plan={openPlan} onClose={() => setOpenPlan(null)} />}
      {defectModal && <DefectModal projectId={projectId} onClose={() => setDefectModal(false)} />}
      {openDefect && <DefectModal projectId={projectId} defect={openDefect} onClose={() => setOpenDefect(null)} />}
    </div>
  );
}

// A short date like "12 Mar" from an ISO date, or "" — for the compact task row.
function shortDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function PlanTasks({ projectId, plan, canEdit }: { projectId: string; plan: TestPlan; canEdit: boolean }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [openTask, setOpenTask] = useState<PlanTask | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["quality", projectId] });
  // Quick inline status change without opening the full window.
  const setStatus = useMutation({
    mutationFn: (v: { id: number; status: string }) => api(`/test-plan-tasks/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: v.status }) }),
    onSuccess: invalidate, onError: (e) => toastError(e),
  });
  const ingest = useMutation({
    mutationFn: () => api<{ added: number; updated: number; removed: number }>(`/test-plans/${plan.id}/jira-ingest`, { method: "POST" }),
    onSuccess: (r) => { toast(`Jira ingest: +${r?.added ?? 0} new · ${r?.updated ?? 0} updated · ${r?.removed ?? 0} removed`, "info"); invalidate(); },
    onError: (e) => toastError(e),
  });

  return (
    <div style={{ marginTop: 11, paddingTop: 11, borderTop: `1px dashed ${color.border3}` }}>
      {plan.tasks.length === 0 ? (
        <div style={{ fontSize: 11.5, color: color.faint3, marginBottom: canEdit ? 9 : 0 }}>No test tasks on this plan yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: canEdit ? 10 : 0 }}>
          {plan.tasks.map((t) => {
            const sc = PLAN_TASK_COLOR[t.status] ?? PLAN_TASK_COLOR["Not run"];
            const meta = [t.assignee, shortDate(t.dueDate) && `due ${shortDate(t.dueDate)}`, t.estimateHours > 0 && `${t.estimateHours}h`].filter(Boolean).join(" · ");
            return (
              <div key={t.id} onClick={() => canEdit && setOpenTask(t)} title={canEdit ? "Open test task" : undefined}
                style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, padding: "5px 8px", borderRadius: 8, cursor: canEdit ? "pointer" : "default" }}>
                {t.jiraKey && <span style={{ fontFamily: font.mono, fontSize: 10, fontWeight: 700, color: color.primaryDark, background: color.primaryTint2, padding: "1px 6px", borderRadius: 5, flex: "none" }}>{t.jiraKey}</span>}
                <span style={{ flex: 1, minWidth: 0, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.title}{meta && <span style={{ color: color.faint3 }}> · {meta}</span>}
                </span>
                {canEdit ? (
                  <select value={t.status} onClick={(e) => e.stopPropagation()} onChange={(e) => setStatus.mutate({ id: t.id, status: e.target.value })}
                    style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, border: "none", borderRadius: 20, padding: "3px 8px", fontFamily: "inherit", cursor: "pointer", flex: "none" }}>
                    {PLAN_TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 8px", borderRadius: 20, flex: "none" }}>{t.status}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {canEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={() => setModal(true)}><Icon name="plus" size={14} /> Add test task</Button>
          {plan.jiraBoardId > 0 && (
            <Button variant="secondary" onClick={() => ingest.mutate()} disabled={ingest.isPending} title={`Pull issues from Jira board ${plan.jiraBoardId}`}>
              <Icon name="refresh" size={14} /> {ingest.isPending ? "Ingesting…" : `Ingest from Jira (board ${plan.jiraBoardId})`}
            </Button>
          )}
        </div>
      )}
      {modal && <PlanTaskModal projectId={projectId} planId={plan.id} onClose={() => setModal(false)} />}
      {openTask && <PlanTaskModal projectId={projectId} planId={plan.id} task={openTask} onClose={() => setOpenTask(null)} />}
    </div>
  );
}

// Full test-task window: title, description/steps, status, assignee, start & due
// dates and the planned time to spend.
function PlanTaskModal({ projectId, planId, task, onClose }: { projectId: string; planId: number; task?: PlanTask; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    title: task?.title ?? "", status: task?.status ?? "Not run", assignee: task?.assignee ?? "",
    description: task?.description ?? "", startDate: task?.startDate ?? "", dueDate: task?.dueDate ?? "",
    estimateHours: task?.estimateHours ? String(task.estimateHours) : "",
  });
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["quality", projectId] });
  const body = () => JSON.stringify({
    title: f.title.trim(), status: f.status, assignee: f.assignee.trim(),
    description: f.description.trim(), startDate: f.startDate, dueDate: f.dueDate,
    estimateHours: Number(f.estimateHours) || 0,
  });
  const save = useMutation({
    mutationFn: () => task
      ? api(`/test-plan-tasks/${task.id}`, { method: "PATCH", body: body() })
      : api(`/test-plans/${planId}/tasks`, { method: "POST", body: body() }),
    onSuccess: () => { invalidate(); onClose(); }, onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/test-plan-tasks/${task!.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); }, onError: (e) => toastError(e),
  });
  const dateWrong = !!f.startDate && !!f.dueDate && f.dueDate < f.startDate;
  return (
    <Modal onClose={onClose} width={520} label={task ? (task.jiraKey ? `${task.jiraKey} · Test task` : "Test task") : "New test task"}>
      <DecLabel>Title</DecLabel>
      <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Verify checkout with expired card" style={{ marginBottom: 14 }} />
      <DecLabel>Details / steps</DecLabel>
      <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Preconditions, steps and expected result…" style={{ marginBottom: 14, width: "100%", resize: "vertical" }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{PLAN_TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Assignee</DecLabel><Input value={f.assignee} onChange={(e) => set("assignee", e.target.value)} placeholder="Who runs it?" /></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Start date</DecLabel><Input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
        <div style={{ flex: 1 }}><DecLabel>Due date</DecLabel><Input type="date" value={f.dueDate} min={f.startDate || undefined} onChange={(e) => set("dueDate", e.target.value)} /></div>
        <div style={{ flex: 1 }}><DecLabel>Time to spend (h)</DecLabel><Input type="number" min={0} step={0.5} value={f.estimateHours} onChange={(e) => set("estimateHours", e.target.value)} placeholder="0" /></div>
      </div>
      {dateWrong && <div style={{ fontSize: 11.5, color: color.dangerInk, marginTop: 8 }}>Due date is before the start date.</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {task && (confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: color.dangerInk, fontWeight: 600 }}>Delete this task?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: color.danger }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.dangerInk, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        ))}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => f.title.trim() && !dateWrong && save.mutate()} disabled={save.isPending || !f.title.trim() || dateWrong}>{save.isPending ? "Saving…" : task ? "Save changes" : "Add task"}</Button>
      </div>
    </Modal>
  );
}

function PlanModal({ projectId, plan, onClose }: { projectId: string; plan?: TestPlan; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: plan?.name ?? "", stage: plan?.stage ?? "System",
    cases: String(plan?.cases ?? ""), passed: String(plan?.passed ?? ""), failed: String(plan?.failed ?? ""), blocked: String(plan?.blocked ?? ""),
    jiraBoardId: plan?.jiraBoardId ? String(plan.jiraBoardId) : "",
  });
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["quality", projectId] });
  const body = () => JSON.stringify({ name: f.name.trim(), stage: f.stage, cases: Number(f.cases) || 0, passed: Number(f.passed) || 0, failed: Number(f.failed) || 0, blocked: Number(f.blocked) || 0, jiraBoardId: Number(f.jiraBoardId) || 0 });
  const save = useMutation({
    mutationFn: () => plan ? api(`/test-plans/${plan.id}`, { method: "PATCH", body: body() }) : api(`/projects/${projectId}/test-plans`, { method: "POST", body: body() }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/test-plans/${plan!.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  return (
    <Modal onClose={onClose} width={500} label={plan ? "Test plan" : "New test plan"}>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 2 }}><DecLabel>Plan name</DecLabel><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Checkout regression" /></div>
        <div style={{ flex: 1 }}><DecLabel>Stage</DecLabel><Select value={f.stage} onChange={(e) => set("stage", e.target.value)}>{QA_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Cases</DecLabel><Input type="number" min={0} value={f.cases} onChange={(e) => set("cases", e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>Passed</DecLabel><Input type="number" min={0} value={f.passed} onChange={(e) => set("passed", e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>Failed</DecLabel><Input type="number" min={0} value={f.failed} onChange={(e) => set("failed", e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>Blocked</DecLabel><Input type="number" min={0} value={f.blocked} onChange={(e) => set("blocked", e.target.value)} placeholder="0" /></div>
      </div>
      <div style={{ marginTop: 14 }}>
        <DecLabel>Linked Jira board id</DecLabel>
        <Input type="number" min={0} value={f.jiraBoardId} onChange={(e) => set("jiraBoardId", e.target.value)} placeholder="e.g. 42 — leave blank for none" />
        <div style={{ fontSize: 11, color: color.faint3, marginTop: 4 }}>Link an agile board to pull its issues into this plan's tasks (Integrations → Jira must be configured). Ingest from the plan's task list.</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {plan && (confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: color.dangerInk, fontWeight: 600 }}>Delete this plan?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: color.danger }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.dangerInk, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        ))}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => f.name.trim() && save.mutate()} disabled={save.isPending || !f.name.trim()}>{save.isPending ? "Saving…" : plan ? "Save changes" : "Add plan"}</Button>
      </div>
    </Modal>
  );
}

function DefectModal({ projectId, defect, onClose }: { projectId: string; defect?: Defect; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    title: defect?.title ?? "", severity: defect?.severity ?? "Medium",
    owner: defect && defect.owner !== "—" ? defect.owner : "", status: defect?.status ?? "Open", test: defect?.test ?? "",
  });
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["quality", projectId] });
  const save = useMutation({
    mutationFn: () => defect
      ? api(`/defects/${defect.id}`, { method: "PATCH", body: JSON.stringify({ ...f, title: f.title.trim() }) })
      : api(`/projects/${projectId}/defects`, { method: "POST", body: JSON.stringify({ ...f, title: f.title.trim() }) }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/defects/${defect!.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  return (
    <Modal onClose={onClose} width={480} label={defect ? `${defect.code} · Defect` : "Log defect"}>
      <DecLabel>Defect</DecLabel>
      <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="What's the defect?" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Severity</DecLabel><Select value={f.severity} onChange={(e) => set("severity", e.target.value)}>{DEFECT_SEVERITIES.map((s) => <option key={s}>{s}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{DEFECT_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Owner</DecLabel><Input value={f.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Owner" /></div>
        <div style={{ flex: 1 }}><DecLabel>Test</DecLabel><Input value={f.test} onChange={(e) => set("test", e.target.value)} placeholder="e.g. TC-090" /></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {defect && (confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: color.dangerInk, fontWeight: 600 }}>Delete this defect?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: color.danger }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.dangerInk, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        ))}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => f.title.trim() && save.mutate()} disabled={save.isPending || !f.title.trim()}>{save.isPending ? "Saving…" : defect ? "Save changes" : "Log defect"}</Button>
      </div>
    </Modal>
  );
}

// ---- Dependencies (cross-project links) ------------------------------------
