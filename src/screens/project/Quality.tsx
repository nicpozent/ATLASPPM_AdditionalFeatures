// Extracted from Project.tsx — the Quality tab and its modals/types.
// No behaviour change; shared presentational helpers come from ./shared.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, Button, Modal, Input, Select } from "@/components/ui";
import { toastError } from "@/components/Toast";
import { DecLabel } from "./shared";
import { sectionTitleS } from "./util";

interface PlanTask { id: number; title: string; status: string; assignee: string; }
interface TestPlan { id: number; name: string; stage: string; cases: number; passed: number; failed: number; blocked: number; notRun: number; execPct: number; tasks: PlanTask[]; }
const PLAN_TASK_STATUSES = ["Not run", "In test", "Passed", "Failed", "Blocked"];
const PLAN_TASK_COLOR: Record<string, { ink: string; tint: string }> = {
  Passed: { ink: "#0B6B37", tint: "#E7F4EC" }, "In test": { ink: "#0C5798", tint: "#E6EFFB" },
  Failed: { ink: "#A1282B", tint: "#FBE7E8" }, Blocked: { ink: "#8A6300", tint: "#FBF2D7" }, "Not run": { ink: "#56607A", tint: "#EEF1F6" },
};
interface Defect { id: number; code: string; title: string; severity: string; owner: string; status: string; test: string; }
interface QualityData { canEdit: boolean; totals: { cases: number; coverage: number; passRate: number; failed: number; openDefects: number }; plans: TestPlan[]; defects: Defect[]; }

const QUALITY_SOURCES: [string, string][] = [["jira", "Jira / Xray"], ["ado", "Azure Test Plans"], ["sdp", "ServiceDesk Plus"], ["manual", "Manual"]];
const QA_STAGES = ["Unit", "Integration", "System", "UAT", "Regression", "Performance", "Security"];
const DEFECT_SEVERITIES = ["Critical", "High", "Medium", "Low"];
const DEFECT_STATUSES = ["Open", "In progress", "Resolved", "Closed"];
const SEV_COLOR: Record<string, { ink: string; tint: string }> = {
  Critical: { ink: "#A1282B", tint: "#FBE7E8" }, High: { ink: "#8A6300", tint: "#FBF2D7" }, Medium: { ink: "#0C5798", tint: "#E6EFFB" }, Low: { ink: "#56607A", tint: "#EEF1F6" },
};
const DEFECT_STATUS_COLOR: Record<string, { ink: string; tint: string }> = {
  Open: { ink: "#A1282B", tint: "#FBE7E8" }, "In progress": { ink: "#8A6300", tint: "#FBF2D7" }, Resolved: { ink: "#0B6B37", tint: "#E7F4EC" }, Closed: { ink: "#56607A", tint: "#EEF1F6" },
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
            <div key={p.id} style={{ padding: "13px 22px", borderTop: "1px solid #F2F4F9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#5E2E89", background: "#F0E8F7", padding: "2px 9px", borderRadius: 20 }}>{p.stage}</span>
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
                <span style={{ fontSize: 11, color: "#0B6B37" }}>● {p.passed} passed</span>
                <span style={{ fontSize: 11, color: "#A1282B" }}>● {p.failed} failed</span>
                <span style={{ fontSize: 11, color: "#8A6300" }}>● {p.blocked} blocked</span>
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
            <div key={d.id} onClick={() => canEdit && setOpenDefect(d)} style={{ display: "grid", gridTemplateColumns: DEF_COLS, alignItems: "center", padding: "13px 22px", borderBottom: "1px solid #F2F4F9", cursor: canEdit ? "pointer" : "default" }}>
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

function PlanTasks({ projectId, plan, canEdit }: { projectId: string; plan: TestPlan; canEdit: boolean }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["quality", projectId] });
  const add = useMutation({
    mutationFn: () => api(`/test-plans/${plan.id}/tasks`, { method: "POST", body: JSON.stringify({ title: title.trim() }) }),
    onSuccess: () => { setTitle(""); invalidate(); },
    onError: (e) => toastError(e),
  });
  const setStatus = useMutation({
    mutationFn: (v: { id: number; status: string }) => api(`/test-plan-tasks/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: v.status }) }),
    onSuccess: invalidate, onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/test-plan-tasks/${id}`, { method: "DELETE" }),
    onSuccess: invalidate, onError: (e) => toastError(e),
  });

  return (
    <div style={{ marginTop: 11, paddingTop: 11, borderTop: "1px dashed #E4E8F1" }}>
      {plan.tasks.length === 0 ? (
        <div style={{ fontSize: 11.5, color: color.faint3, marginBottom: canEdit ? 9 : 0 }}>No test cases on this plan yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: canEdit ? 10 : 0 }}>
          {plan.tasks.map((t) => {
            const sc = PLAN_TASK_COLOR[t.status] ?? PLAN_TASK_COLOR["Not run"];
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
                <span style={{ flex: 1, color: color.text }}>{t.title}{t.assignee && <span style={{ color: color.faint3 }}> · {t.assignee}</span>}</span>
                {canEdit ? (
                  <select value={t.status} onChange={(e) => setStatus.mutate({ id: t.id, status: e.target.value })}
                    style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, border: "none", borderRadius: 20, padding: "3px 8px", fontFamily: "inherit", cursor: "pointer" }}>
                    {PLAN_TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 8px", borderRadius: 20 }}>{t.status}</span>
                )}
                {canEdit && <button onClick={() => del.mutate(t.id)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: "#A1282B", display: "inline-flex" }}><Icon name="trash" size={13} /></button>}
              </div>
            );
          })}
        </div>
      )}
      {canEdit && (
        <div style={{ display: "flex", gap: 8 }}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a test case…" onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) add.mutate(); }} style={{ flex: 1, fontSize: 12.5, padding: "6px 10px" }} />
          <Button variant="secondary" onClick={() => title.trim() && add.mutate()} disabled={add.isPending || !title.trim()}>Add</Button>
        </div>
      )}
    </div>
  );
}

function PlanModal({ projectId, plan, onClose }: { projectId: string; plan?: TestPlan; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: plan?.name ?? "", stage: plan?.stage ?? "System",
    cases: String(plan?.cases ?? ""), passed: String(plan?.passed ?? ""), failed: String(plan?.failed ?? ""), blocked: String(plan?.blocked ?? ""),
  });
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["quality", projectId] });
  const body = () => JSON.stringify({ name: f.name.trim(), stage: f.stage, cases: Number(f.cases) || 0, passed: Number(f.passed) || 0, failed: Number(f.failed) || 0, blocked: Number(f.blocked) || 0 });
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
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {plan && (confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this plan?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
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
            <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this defect?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        ))}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => f.title.trim() && save.mutate()} disabled={save.isPending || !f.title.trim()}>{save.isPending ? "Saving…" : defect ? "Save changes" : "Log defect"}</Button>
      </div>
    </Modal>
  );
}

// ---- Dependencies (cross-project links) ------------------------------------
