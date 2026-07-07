import { useState, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api, apiUpload, apiDownload } from "@/api";
import { syncJira, syncToast } from "@/lib/jiraSync";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, ProgressBar, Button, Modal, Input, Select, Textarea } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { SubscribeButton } from "@/components/SubscribeButton";
import { StakeholderMatrixCard } from "@/components/StakeholderMatrixCard";
import { TeamPanel } from "@/components/TeamPanel";
import { SkillsPanel } from "@/components/SkillsPanel";
import { JiraSyncButton } from "@/components/JiraSyncButton";
import { DEPARTMENTS } from "@/departments";
import { toast, toastError } from "@/components/Toast";
import { SCREENS } from "@/nav";

// ---- data (empty until API exists) -----------------------------------------
interface ProjectDetail {
  id: string; name: string; dept: string; owner: string; methodology: string;
  status: string; health: string; progress: number; phase: string;
  budget: number; spent: number; due: string; startDate?: string; target?: string; summary?: string;
  jiraProjectKey?: string; jiraBoardId?: number | null; lastJiraSync?: string;
}
function useProject(id: string | null) {
  return useQuery({
    queryKey: ["project", id], retry: false, enabled: !!id, staleTime: 60_000,
    queryFn: async (): Promise<ProjectDetail | null> => {
      try { return await api<ProjectDetail>(`/projects/${id}`); } catch { return null; }
    },
  });
}

const TABS = [
  ["overview", "Overview"], ["tasks", "Tasks"], ["backlog", "Backlog"], ["sprints", "Sprints"], ["epics", "Epics"], ["requirements", "Requirements"],
  ["quality", "Quality"], ["governance", "Governance"], ["architecture", "Architecture"],
  ["security", "Security & Privacy"], ["dependencies", "Dependencies"], ["blockers", "Blockers"], ["vacations", "Vacations"],
  ["artifacts", "Artifacts"], ["raid", "RAID Log"], ["comments", "Comments"],
] as const;
type TabId = (typeof TABS)[number][0];

// Methodologies that run in fixed-length sprints/iterations get the Sprints tab.
const AGILE_WITH_SPRINTS = ["Scrum", "SAFe", "Scrumban", "Disciplined Agile"];
const isAgileWithSprints = (m?: string) => !!m && AGILE_WITH_SPRINTS.includes(m);

const BOARD_COLS = [
  { label: "To Do", color: "#8A93A6", tint: "#EEF1F6", ink: "#56607A" },
  { label: "In Progress", color: "#0F6CBD", tint: "#E6EFFB", ink: "#0C5798" },
  { label: "In Review", color: "#E0A100", tint: "#FBF2D7", ink: "#8A6300" },
  { label: "Done", color: "#15A34A", tint: "#E7F4EC", ink: "#0B6B37" },
  { label: "Blocked", color: "#D13438", tint: "#FBE7E8", ink: "#A1282B" },
];
const TASK_PRIORITY: Record<string, { ink: string; tint: string }> = {
  Critical: { ink: "#A1282B", tint: "#FBE7E8" },
  High:     { ink: "#8A6300", tint: "#FBF2D7" },
  Medium:   { ink: "#0C5798", tint: "#E6EFFB" },
  Low:      { ink: "#56607A", tint: "#EEF1F6" },
};
const TASK_PRIORITIES = ["Critical", "High", "Medium", "Low"];
const TASK_STATUSES = ["To Do", "In Progress", "In Review", "Done", "Blocked"];
const TASK_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export default function Project() {
  const [params] = useSearchParams();
  const id = params.get("id");
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("overview");
  const [editing, setEditing] = useState(false);
  const { data: p } = useProject(id);
  const { can } = usePermissions();
  const mayEdit = can("cap-projects", "E");

  const dash = (v?: string | number) => (v == null || v === "" ? "—" : v);
  const fmt = (v?: number) => (v == null ? "—" : "€" + (v / 1000).toFixed(1) + "M");

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* header */}
      <Card style={{ marginBottom: 18 }} padding="22px 24px">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", background: color.faint3 }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: color.subtle, background: color.bg, padding: "3px 10px", borderRadius: 20 }}>{dash(p?.health)}</span>
              <span style={{ fontFamily: font.mono, fontSize: 12, color: color.faint3 }}>{dash(p?.id ?? id ?? undefined)}</span>
            </div>
            <h2 style={{ fontFamily: font.head, fontSize: 23, fontWeight: 600, color: color.ink, margin: "0 0 4px", letterSpacing: "-0.01em" }}>{p?.name ?? "No project loaded"}</h2>
            <div style={{ fontSize: 13, color: color.faint }}>{p ? `${p.dept} · Sponsor ${p.owner} · ${p.methodology}` : "Select a project from the Portfolio to view its detail."}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {p && <SubscribeButton targetType="project" targetId={p.id} />}
            {p && mayEdit && <Button variant="secondary" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> Edit</Button>}
            <Button variant="secondary"><Icon name="download" size={16} /> Status PPTX</Button>
            <Button onClick={() => navigate(SCREENS.gantt.path)}><Icon name="gantt" size={16} /> Timeline</Button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginTop: 20, paddingTop: 18, borderTop: `1px solid ${color.bg}` }}>
          <Meta label="Progress">
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <ProgressBar pct={p?.progress ?? 0} height={7} />
              <span style={{ fontFamily: font.head, fontSize: 15, fontWeight: 700, color: color.ink }}>{p ? `${p.progress}%` : "—"}</span>
            </div>
          </Meta>
          <Meta label="Phase"><span style={{ fontSize: 15, fontWeight: 600, color: color.text }}>{dash(p?.phase)}</span></Meta>
          <Meta label="Budget"><span style={{ fontSize: 15, fontWeight: 600, color: color.text }}>{p ? `${fmt(p.spent)} / ${fmt(p.budget)}` : "—"}</span></Meta>
          <Meta label="Start"><span style={{ fontSize: 15, fontWeight: 600, color: color.text }}>{dash(p?.startDate || undefined)}</span></Meta>
          <Meta label="Target"><span style={{ fontSize: 15, fontWeight: 600, color: color.text }}>{dash(p?.target || p?.due)}</span></Meta>
        </div>
      </Card>

      {/* tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${color.border3}`, marginBottom: 20, overflowX: "auto" }}>
        {TABS.filter(([tid]) => tid !== "sprints" || isAgileWithSprints(p?.methodology)).map(([tid, label]) => {
          const active = tab === tid;
          return (
            <button key={tid} onClick={() => setTab(tid)} style={{
              padding: "10px 4px", margin: "0 14px 0 0", border: "none", borderBottom: active ? "2.5px solid #0F6CBD" : "2.5px solid transparent",
              background: "none", cursor: "pointer", fontSize: 14, fontWeight: active ? 700 : 500, color: active ? color.primary : "#6A7488", fontFamily: "inherit", whiteSpace: "nowrap",
            }}>{label}</button>
          );
        })}
      </div>

      {tab === "overview" && <Overview projectId={id} />}
      {tab === "tasks" && <Tasks projectId={id} />}
      {tab === "backlog" && <Backlog projectId={id} />}
      {tab === "sprints" && (isAgileWithSprints(p?.methodology) ? <Sprints projectId={id} /> : <Overview projectId={id} />)}
      {tab === "governance" && <Governance projectId={id} />}
      {tab === "raid" && <Raid projectId={id} />}
      {tab === "security" && <Security projectId={id} />}
      {tab === "epics" && <Epics projectId={id} />}
      {tab === "artifacts" && <Artifacts projectId={id} />}
      {tab === "requirements" && <Requirements projectId={id} />}
      {tab === "architecture" && <Architecture projectId={id} />}
      {tab === "quality" && <Quality projectId={id} />}
      {tab === "dependencies" && <Dependencies projectId={id} />}
      {tab === "blockers" && <ProjectBlockers projectId={id} />}
      {tab === "vacations" && <Vacations projectId={id} />}
      {tab === "comments" && <Comments projectId={id} />}

      {editing && p && <EditProjectDetailModal project={p} onClose={() => setEditing(false)} />}
    </div>
  );
}

const PD_METHODOLOGIES = ["Scrum", "Kanban", "Scrumban", "SAFe", "Extreme Programming", "Disciplined Agile", "Waterfall", "V-Model", "Stage-Gate", "Iterative & Incremental", "Spiral", "RAD", "DevOps"];
const PD_STATUSES: { key: string; label: string }[] = [
  { key: "green", label: "On track" }, { key: "amber", label: "At risk" }, { key: "red", label: "Critical" },
  { key: "hold", label: "On hold" }, { key: "completed", label: "Completed" },
];
const PD_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pdToIso = (display?: string) => { if (!display) return ""; const d = new Date(display); return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const pdToDisplay = (iso: string) => { if (!iso) return ""; const [y, m, dd] = iso.split("-").map(Number); return y && m && dd ? `${dd} ${PD_MONTHS[m - 1]} ${y}` : ""; };

function EditProjectDetailModal({ project, onClose }: { project: ProjectDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(project.name);
  const [dept, setDept] = useState(project.dept);
  const [owner, setOwner] = useState(project.owner);
  const [methodology, setMethodology] = useState(project.methodology);
  const [status, setStatus] = useState(project.status);
  const [progress, setProgress] = useState(String(project.progress));
  const [startDate, setStartDate] = useState(project.startDate ?? "");
  const [target, setTarget] = useState(project.target ?? project.due ?? "");
  const [budget, setBudget] = useState(String(project.budget));
  const [spent, setSpent] = useState(String(project.spent));
  const [jiraKey, setJiraKey] = useState(project.jiraProjectKey ?? "");
  const [jiraBoard, setJiraBoard] = useState(project.jiraBoardId ? String(project.jiraBoardId) : "");

  // Owner options come from the project's team (lead + assigned architecture
  // roles + the candidate people pool), with the current owner always included.
  const { data: team } = useQuery({
    queryKey: ["assignments", project.id], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ lead: string; archRoles: { person: string }[]; options: string[] } | null> =>
      await api(`/projects/${project.id}/assignments`),
  });
  const ownerOptions = useMemo(() => {
    const set = new Set<string>();
    [project.owner, team?.lead, ...(team?.archRoles ?? []).map((r) => r.person), ...(team?.options ?? [])]
      .forEach((p) => { if (p && p.trim() && p !== "Unassigned") set.add(p.trim()); });
    return Array.from(set);
  }, [project.owner, team]);

  const save = useMutation({
    mutationFn: () => api(`/projects/${project.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: name.trim(), dept: dept.trim(), owner: owner.trim(), methodology, status,
        progress: Math.max(0, Math.min(100, Number(progress) || 0)),
        startDate: startDate.trim(), target: target.trim(),
        budget: Number(budget) || 0, spent: Number(spent) || 0,
        jiraProjectKey: jiraKey.trim(), jiraBoardId: Number(jiraBoard) || 0,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["gantt"] });
      onClose();
    },
    onError: (e) => toast((e as Error).message, "error"),
  });

  return (
    <Modal onClose={onClose} width={520} label={`Edit ${project.id}`}>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>Update the project's details. Health follows the status you pick.</div>
      <PdField label="Project name"><Input value={name} onChange={(e) => setName(e.target.value)} /></PdField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PdField label="Department"><Select value={DEPARTMENTS.includes(dept as never) ? dept : ""} onChange={(e) => setDept(e.target.value)}>
          <option value="">— Select —</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select></PdField>
        <PdField label="Project manager (owner)"><Select value={ownerOptions.includes(owner) ? owner : ""} onChange={(e) => setOwner(e.target.value)}>
          <option value="">{ownerOptions.length ? "— Select from team —" : "No team members assigned yet"}</option>
          {ownerOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select></PdField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PdField label="Methodology"><Select value={methodology} onChange={(e) => setMethodology(e.target.value)}>{PD_METHODOLOGIES.map((m) => <option key={m} value={m}>{m}</option>)}</Select></PdField>
        <PdField label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}>{PD_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></PdField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <PdField label="Progress %"><Input type="number" value={progress} onChange={(e) => setProgress(e.target.value)} /></PdField>
        <PdField label="Start date"><Input type="date" value={pdToIso(startDate)} onChange={(e) => setStartDate(pdToDisplay(e.target.value))} /></PdField>
        <PdField label="Target date"><Input type="date" value={pdToIso(target)} onChange={(e) => setTarget(pdToDisplay(e.target.value))} /></PdField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PdField label="Budget (€k)"><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></PdField>
        <PdField label="Spent (€k)"><Input type="number" value={spent} onChange={(e) => setSpent(e.target.value)} /></PdField>
      </div>
      <div style={{ borderTop: `1px solid ${color.border}`, margin: "6px 0 14px", paddingTop: 14 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: color.faint, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>Jira sync (pull-only)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <PdField label="Jira project key"><Input value={jiraKey} onChange={(e) => setJiraKey(e.target.value)} placeholder="e.g. GIT" /></PdField>
          <PdField label="Jira board id"><Input type="number" value={jiraBoard} onChange={(e) => setJiraBoard(e.target.value)} placeholder="e.g. 93" /></PdField>
        </div>
        <div style={{ fontSize: 11.5, color: color.faint2, lineHeight: 1.5 }}>Link this project to a Jira board to pull its sprints, epics and issues into Tasks. Leave blank to keep it unlinked. Sync from the Tasks tab.</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => name.trim() && save.mutate()} disabled={save.isPending || !name.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}

function PdField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

interface SpilledTask { code: string; name: string; baseline: string; sprint: string; assignee: string }

function SummaryCard({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canEdit = can("cap-projects", "E");
  const { data } = useProject(projectId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const summary = data?.summary ?? "";
  const save = useMutation({
    mutationFn: (text: string) => api(`/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ summary: text }) }),
    onSuccess: () => { setEditing(false); qc.invalidateQueries({ queryKey: ["project", projectId] }); },
  });

  return (
    <Card padding={22}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SectionTitle>Summary</SectionTitle>
        <div style={{ flex: 1 }} />
        {canEdit && !editing && (
          <button onClick={() => { setDraft(summary); setEditing(true); }} style={{ fontSize: 12.5, fontWeight: 600, color: color.primary, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            {summary ? "Edit" : "Add summary"}
          </button>
        )}
      </div>
      {editing ? (
        <div style={{ marginTop: 10 }}>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} placeholder="Describe the project's purpose, scope and current focus…" style={{ width: "100%" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 10 }}>
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(draft.trim())} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      ) : summary ? (
        <div style={{ fontSize: 13.5, color: color.subtle, lineHeight: 1.55, whiteSpace: "pre-wrap", marginTop: 8 }}>{summary}</div>
      ) : (
        <EmptyBlock message="No project summary yet." minHeight={70} />
      )}
    </Card>
  );
}

function Overview({ projectId }: { projectId: string | null }) {
  const [modal, setModal] = useState<null | "risks" | "report">(null);
  const { data: spilled = [] } = useQuery({
    queryKey: ["spillover", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<SpilledTask[]> => (await api<SpilledTask[]>(`/projects/${projectId}/spillover`)) ?? [],
  });
  const { data: detail } = useQuery({
    queryKey: ["project", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<ProjectDetail | null> => { try { return await api<ProjectDetail>(`/projects/${projectId}`); } catch { return null; } },
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {projectId && detail?.jiraProjectKey && (
          <Card padding="14px 18px" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12.5, color: color.textMuted }}>
              Linked to Jira <b style={{ color: color.ink }}>{detail.jiraProjectKey}</b>{detail.jiraBoardId ? ` · board ${detail.jiraBoardId}` : ""}
            </div>
            <JiraSyncButton path={`/projects/${projectId}/jira/sync`} lastSync={detail.lastJiraSync}
              invalidateKeys={["tasks", "sprints", "epics", "backlog", "project"]} />
          </Card>
        )}
        <PeopleRoles projectId={projectId} />
        {projectId && <TeamPanel entityType="project" entityId={projectId} />}
        {projectId && <SkillsPanel entityType="project" entityId={projectId} />}
        <WaysOfWorking projectId={projectId} />
        <TeamCapacity projectId={projectId} />
        <CommunicationPlan projectId={projectId} />
        <OpsImpactPanel projectId={projectId} />
        {/* AI assist (structural chrome) */}
        <div style={{ background: "linear-gradient(120deg,#0F1B3D,#123B7A)", border: "1px solid #14264F", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.12)", color: "#8EC5FF", fontSize: 14 }}>✦</span>
            <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: "#fff" }}>Atlas AI assist</div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#8EC5FF", background: "rgba(142,197,255,0.16)", padding: "2px 8px", borderRadius: 20, letterSpacing: "0.04em" }}>BETA</span>
          </div>
          <div style={{ fontSize: 12.5, color: "#AEBEDC", lineHeight: 1.5, marginBottom: 14 }}>Draft an executive status report or scan this project for delivery risks — generated from live project data.</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => projectId && setModal("report")} disabled={!projectId} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#0F1B3D", background: "#fff", border: "none", padding: "10px 16px", borderRadius: 9, cursor: projectId ? "pointer" : "not-allowed", opacity: projectId ? 1 : 0.55, fontFamily: "inherit" }}>✦ Draft status report</button>
            <button onClick={() => projectId && setModal("risks")} disabled={!projectId} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.22)", padding: "10px 16px", borderRadius: 9, cursor: projectId ? "pointer" : "not-allowed", opacity: projectId ? 1 : 0.55, fontFamily: "inherit" }}>◆ Detect risks</button>
          </div>
        </div>
        {modal === "risks" && projectId && <RisksModal projectId={projectId} onClose={() => setModal(null)} />}
        {modal === "report" && projectId && <StatusReportModal projectId={projectId} onClose={() => setModal(null)} />}
        <OperationalImpact projectId={projectId} />
        <SummaryCard projectId={projectId} />
        <Card padding={22}><SectionTitle>Epic progress</SectionTitle><EmptyBlock message="No epics tracked yet." minHeight={80} /></Card>
        <StakeholderMatrixCard scopeType="project" scopeId={projectId} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Card padding="18px 20px">
          <SectionTitle>Schedule spillover</SectionTitle>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: font.head, fontSize: 30, fontWeight: 700, color: spilled.length ? "#8A6300" : color.ink }}>{spilled.length}</span>
            <span style={{ fontSize: 12.5, color: color.faint2 }}>task{spilled.length === 1 ? "" : "s"} past baseline</span>
          </div>
          {spilled.length === 0 ? (
            <div style={{ fontSize: 12, color: color.faint3, marginTop: 8 }}>No tasks have slipped their baselined sprint.</div>
          ) : (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {spilled.slice(0, 4).map((t) => (
                <div key={t.code} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3, flex: "none" }}>{t.code}</span>
                  <span style={{ flex: 1, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                  <span style={{ fontFamily: font.mono, fontSize: 10, fontWeight: 700, color: "#8A6300", background: "#FBF2D7", borderRadius: 4, padding: "1px 6px", flex: "none" }}>{t.baseline} → {t.sprint}</span>
                </div>
              ))}
              {spilled.length > 4 && <div style={{ fontSize: 11.5, color: color.faint3 }}>+{spilled.length - 4} more · see Tasks</div>}
            </div>
          )}
        </Card>
        <Card padding="18px 20px"><SectionTitle>Key dates</SectionTitle><EmptyBlock message="No milestones set." minHeight={70} /></Card>
        <Card padding="18px 20px"><SectionTitle>Change requests</SectionTitle><EmptyBlock message="No change requests." minHeight={70} /></Card>
      </div>
    </div>
  );
}

// People & roles — the project lead is assigned by the PMO, the architecture
// roles by the Chief Architect; everyone else sees the panel read-only. Mirrors
// the prototype's peoplePanelEl exactly. Server enforces who may change what.
interface RoleRow { key: string; label: string; person: string; }
interface Assignments {
  canAssignLead: boolean; canAssignArch: boolean; leadKey: string; leadLabel: string;
  lead: string; archRoles: RoleRow[]; options: string[]; missingArch: string[];
}

function PeopleRoles({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["assignments", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<Assignments | null> => {
      try { return await api<Assignments>(`/projects/${projectId}/assignments`); } catch { return null; }
    },
  });
  const assign = useMutation({
    mutationFn: (v: { key: string; person: string }) =>
      api(`/projects/${projectId}/assignments/${v.key}`, { method: "PUT", body: JSON.stringify({ person: v.person }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments", projectId] });
      qc.invalidateQueries({ queryKey: ["capacity", projectId] }); // assigned team changed
      qc.invalidateQueries({ queryKey: ["risks", projectId] });    // capacity feeds the risk engine
    },
  });

  const options = data?.options ?? [];
  const roRow = (label: string, val: string) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #F4F6FA" }}>
      <span style={{ flex: 1, fontSize: 12.5, color: "#56607A" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: val ? "#1C2233" : "#B0B7C5" }}>{val === "N/A" ? "N/A" : val || "Unassigned"}</span>
    </div>
  );
  const selRow = (key: string, label: string, val: string) => (
    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #F4F6FA" }}>
      <span style={{ flex: 1, fontSize: 12.5, color: "#56607A" }}>{label}</span>
      <select value={val || ""} onChange={(e) => assign.mutate({ key, person: e.target.value })} disabled={!projectId || assign.isPending}
        style={{ border: "1px solid #E0E5EE", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", color: "#1C2233", background: "#fff", cursor: "pointer", minWidth: 190 }}>
        <option value="">— Unassigned —</option>
        <option value="N/A">N/A</option>
        {options.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );

  return (
    <Card padding="20px 22px">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: "#11163A" }}>People &amp; roles</div>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ fontSize: 11.5, color: "#8A92A6", lineHeight: 1.45, marginBottom: 14 }}>
        PMO assigns the project manager; the Chief Architect assigns architecture roles. Others see read-only.
      </div>
      {!projectId ? (
        <EmptyBlock message="Select a project from the Portfolio to assign people." minHeight={70} />
      ) : (
        <>
          {data?.canAssignLead ? selRow(data.leadKey, data.leadLabel, data.lead) : roRow(data?.leadLabel ?? "Project Manager", data?.lead ?? "")}
          {data?.canAssignArch && (data.missingArch.length > 0) && (
            <div style={{ margin: "12px 0 4px", fontSize: 12, color: "#8A6300", background: "#FBF2D7", border: "1px solid #F0E4B8", borderRadius: 9, padding: "9px 12px", lineHeight: 1.45 }}>
              ⚠ {data.missingArch.length} architecture role{data.missingArch.length > 1 ? "s" : ""} not yet assigned: {data.missingArch.join(", ")}
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#5E2E89", letterSpacing: "0.05em", textTransform: "uppercase", margin: "16px 0 2px" }}>Architecture roles</div>
          {(data?.archRoles ?? []).map((r) => data?.canAssignArch ? selRow(r.key, r.label, r.person) : roRow(r.label, r.person))}
        </>
      )}
    </Card>
  );
}

// Team capacity — the people assigned to this project (People & roles) checked
// against their allocation on Resources. Over-allocation is flagged and feeds
// the risk engine as a resource risk.
interface CapacityRow { name: string; role: string; initials: string; color: string; opsPct: number; projectPct: number; productPct: number; util: number; over: boolean; highOps: boolean; }
interface Capacity { assigned: number; overCount: number; highOps: number; people: CapacityRow[]; unknown: string[]; }

function TeamCapacity({ projectId }: { projectId: string | null }) {
  const { data } = useQuery({
    queryKey: ["capacity", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<Capacity | null> => (await api<Capacity>(`/projects/${projectId}/capacity`)) ?? null,
  });
  const seg = (pct: number, bg: string) => pct > 0 ? <div style={{ width: `${Math.min(pct, 100)}%`, background: bg, height: "100%" }} /> : null;
  return (
    <Card padding="18px 22px">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <SectionTitle>Team capacity</SectionTitle>
        {(data?.overCount ?? 0) > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#A1282B", background: "#FBE7E8", borderRadius: 20, padding: "1px 9px", marginBottom: 12 }}>{data!.overCount} over-allocated</span>}
      </div>
      <div style={{ fontSize: 12, color: color.faint2, marginTop: -6, marginBottom: 14 }}>Assigned people vs their allocation. Utilisation = ops + project + product; over 100% flags a resource risk.</div>
      {!data || data.assigned === 0 ? (
        <EmptyBlock message="No people assigned yet — assign roles in People & roles." minHeight={56} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.people.map((p) => (
            <div key={p.name}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: p.color, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{p.initials}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{p.name}</span>
                <span style={{ fontSize: 11.5, color: color.faint3 }}>{p.role}</span>
                <div style={{ flex: 1 }} />
                {p.highOps && !p.over && <span title="Heavy operational load" style={{ fontSize: 10, fontWeight: 700, color: "#8A6300", background: "#FBF2D7", borderRadius: 5, padding: "1px 6px" }}>HIGH OPS</span>}
                <span style={{ fontFamily: font.mono, fontSize: 12.5, fontWeight: 700, color: p.over ? "#A1282B" : color.textMuted }}>{p.util}%</span>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: "#EEF1F6", boxShadow: p.over ? "0 0 0 1.5px #D13438" : "none" }}>
                {seg(p.opsPct, "#E0A100")}
                {seg(p.projectPct, color.primary)}
                {seg(p.productPct, "#0E7C7B")}
              </div>
            </div>
          ))}
          {data.unknown.length > 0 && (
            <div style={{ fontSize: 11.5, color: color.faint3 }}>{data.unknown.join(", ")} — not on the Resources sheet (capacity unknown).</div>
          )}
          <div style={{ display: "flex", gap: 14, marginTop: 2, fontSize: 10.5, color: color.faint3 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#E0A100" }} /> Ops</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: color.primary }} /> Project</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#0E7C7B" }} /> Product</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// Operational impact — incidents / maintenance / changes that can affect this
// project. Active high-severity items are picked up by the risk engine. Logged
// manually here; the Source field is connector-ready (ServiceNow / SDP / Jira).
interface OperationalItem { id: number; ref: string; title: string; type: string; severity: string; status: string; source: string; owner: string; date: string; }
const OPS_TYPES = ["Incident", "Maintenance", "Service request", "On-call", "Change"];
const OPS_SEVERITIES = ["Critical", "High", "Medium", "Low"];
const OPS_STATUSES = ["Open", "In progress", "Resolved", "Closed"];
const OPS_SOURCES = ["Manual", "ServiceNow", "ManageEngine SDP", "Jira", "Azure DevOps"];
const OPS_SEV_COLOR: Record<string, { ink: string; tint: string }> = {
  Critical: { ink: "#A1282B", tint: "#FBE7E8" }, High: { ink: "#A1282B", tint: "#FBE7E8" },
  Medium: { ink: "#8A6300", tint: "#FBF2D7" }, Low: { ink: "#566077", tint: "#EEF1F6" },
};
const opsActive = (s: string) => s === "Open" || s === "In progress";

function OperationalImpact({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const { data } = useQuery({
    queryKey: ["operational", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; items: OperationalItem[] }> =>
      (await api<{ canEdit: boolean; items: OperationalItem[] }>(`/projects/${projectId}/operational`)) ?? { canEdit: false, items: [] },
  });
  const items = data?.items ?? [];
  const canEdit = data?.canEdit ?? false;
  const activeCount = items.filter((o) => opsActive(o.status)).length;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["operational", projectId] });
    qc.invalidateQueries({ queryKey: ["operational-all"] });    // portfolio strip on Delivery
    qc.invalidateQueries({ queryKey: ["risks", projectId] });   // ops feeds the risk engine
  };
  const patch = useMutation({
    mutationFn: (v: { id: number; status: string }) => api(`/operational/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: v.status }) }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/operational/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  return (
    <Card padding="18px 22px">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <SectionTitle>Operational impact</SectionTitle>
        {activeCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#A1282B", background: "#FBE7E8", borderRadius: 20, padding: "1px 9px", marginBottom: 12 }}>{activeCount} active</span>}
        <div style={{ flex: 1 }} />
        {canEdit && projectId && <Button variant="secondary" onClick={() => setModal(true)} style={{ marginBottom: 12, padding: "7px 12px" }}><Icon name="plus" size={15} /> Log item</Button>}
      </div>
      <div style={{ fontSize: 12, color: color.faint2, marginTop: -6, marginBottom: 14 }}>Incidents, maintenance & changes that can affect delivery. Active high-severity items are flagged as risks.</div>
      {items.length === 0 ? (
        <EmptyBlock message="No operational items linked to this project." minHeight={60} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((o) => {
            const sev = OPS_SEV_COLOR[o.severity] ?? OPS_SEV_COLOR.Medium;
            const resolved = o.status === "Resolved" || o.status === "Closed";
            return (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #F4F6FA", opacity: resolved ? 0.6 : 1 }}>
                <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3, flex: "none", width: 54 }}>{o.ref}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</div>
                  <div style={{ fontSize: 11, color: color.faint3 }}>{o.type} · {o.owner} · {o.date}{o.source !== "Manual" ? ` · ${o.source}` : ""}</div>
                </div>
                <span style={{ flex: "none", fontSize: 10.5, fontWeight: 700, color: sev.ink, background: sev.tint, padding: "2px 8px", borderRadius: 6 }}>{o.severity}</span>
                {canEdit ? (
                  <select value={o.status} onChange={(e) => patch.mutate({ id: o.id, status: e.target.value })}
                    style={{ flex: "none", fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", color: color.textMuted, background: "#fff", border: `1px solid ${color.border}`, borderRadius: 7, padding: "5px 8px", cursor: "pointer" }}>
                    {OPS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span style={{ flex: "none", fontSize: 11.5, fontWeight: 600, color: color.textMuted }}>{o.status}</span>
                )}
                {canEdit && (
                  <button onClick={() => remove.mutate(o.id)} title="Remove" style={{ flex: "none", width: 28, height: 28, borderRadius: 7, border: `1px solid ${color.border}`, background: "#fff", color: color.faint2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={14} /></button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {modal && projectId && <OperationalModal projectId={projectId} onClose={() => setModal(false)} onSaved={() => { setModal(false); refresh(); }} />}
    </Card>
  );
}

function OperationalModal({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(OPS_TYPES[0]);
  const [severity, setSeverity] = useState("Medium");
  const [owner, setOwner] = useState("");
  const [source, setSource] = useState(OPS_SOURCES[0]);
  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/operational`, { method: "POST", body: JSON.stringify({ title: title.trim(), type, severity, owner: owner.trim(), source }) }),
    onSuccess: onSaved,
  });
  return (
    <Modal onClose={onClose} width={480} label="Log operational item">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Record operational work that can affect this project's delivery.</div>
      <DecLabel>Title</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. POS outage in Nässjö region" style={{ marginBottom: 14 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><DecLabel>Type</DecLabel><Select value={type} onChange={(e) => setType(e.target.value)}>{OPS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></div>
        <div><DecLabel>Severity</DecLabel><Select value={severity} onChange={(e) => setSeverity(e.target.value)}>{OPS_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
        <div><DecLabel>Owner</DecLabel><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Assignee" /></div>
        <div><DecLabel>Source</DecLabel><Select value={source} onChange={(e) => setSource(e.target.value)}>{OPS_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => title.trim() && create.mutate()} disabled={create.isPending || !title.trim()}>{create.isPending ? "Logging…" : "Log item"}</Button>
      </div>
    </Modal>
  );
}

interface Task {
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

interface TaskAttachment { id: number; fileName: string; contentType: string; size: number; author: string; createdAt: string; }

function useAssigneeOptions(projectId: string | null): string[] {
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
function useEpicOptions(projectId: string | null): string[] {
  const { data } = useQuery({
    queryKey: ["epics", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ epics: { name: string }[] } | null> => {
      try { return await api(`/projects/${projectId}/epics`); } catch { return null; }
    },
  });
  return (data?.epics ?? []).map((e) => e.name);
}

// Sprint names for the task sprint dropdown (tasks tie to a sprint by name).
function useSprintOptions(projectId: string | null): string[] {
  const { data } = useQuery({
    queryKey: ["sprints", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ sprints: { name: string }[] } | null> => {
      try { return await api(`/projects/${projectId}/sprints`); } catch { return null; }
    },
  });
  return (data?.sprints ?? []).map((s) => s.name);
}

// A dropdown over known names that still accepts a legacy/free value (kept as an
// extra option) and offers a blank. Used for task → epic / sprint linking.
function LinkSelect({ value, options, placeholder, disabled, onChange }: { value: string; options: string[]; placeholder: string; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
    </Select>
  );
}

function Tasks({ projectId }: { projectId: string | null }) {
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
        <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2 }}>
          {(["board", "table"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "6px 15px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", textTransform: "capitalize", background: view === v ? "#fff" : "transparent", color: view === v ? color.primary : "#6A7488", boxShadow: view === v ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>{v}</button>
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
                style={{ background: over ? "#EAF2FB" : "#F5F7FA", border: `1px ${over ? "dashed" : "solid"} ${over ? color.primary : "#EAEEF4"}`, borderRadius: 13, padding: 10, minHeight: 120 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, padding: "2px 4px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#3A4358" }}>{c.label}</span>
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
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, color: "#8A6300", background: "#FBF2D7", border: "1px solid #F0E4B8", borderRadius: 5, padding: "1px 6px" }} title={`Baselined in ${t.baseline}, now in ${t.sprint}`}>
                                <Icon name="alert" size={11} /> Spilled · {t.baseline} → {t.sprint}
                              </span>
                            )}
                            {t.assigneeOnLeave && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, color: "#A1282B", background: "#FBE7E8", border: "1px solid #F3CFD0", borderRadius: 5, padding: "1px 6px" }} title={`${t.assignee} is on leave during this task's scheduled window`}>
                                <Icon name="alert" size={11} /> Assignee on leave
                              </span>
                            )}
                            {t.assigneeKnown === false && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, color: "#8A6300", background: "#FBF2D7", border: "1px solid #F0E4B8", borderRadius: 5, padding: "1px 6px" }} title={`${t.assignee} isn't an onboarded team member (not synced from Entra).`}>
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
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 0.9fr 0.9fr 0.9fr 1fr", alignItems: "center", padding: "14px 22px", borderBottom: "1px solid #F2F4F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3, flex: "none" }}>{t.code}</span>
                  <button onClick={() => setOpenId(t.id)} style={{ fontSize: 13.5, fontWeight: 600, color: color.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>{t.name}</button>
                  {t.assigneeOnLeave && <span title={`${t.assignee} is on leave during this task's scheduled window`} style={{ flex: "none", fontSize: 9, fontWeight: 700, color: "#A1282B", background: "#FBE7E8", border: "1px solid #F3CFD0", borderRadius: 4, padding: "0 5px" }}>ON LEAVE</span>}
                  {t.assigneeKnown === false && <span title={`${t.assignee} isn't an onboarded team member (not synced from Entra) — add them to a team or check the name.`} style={{ flex: "none", fontSize: 9, fontWeight: 700, color: "#8A6300", background: "#FBF2D7", border: "1px solid #F0E4B8", borderRadius: 4, padding: "0 5px" }}>⚠ NOT ONBOARDED</span>}
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
                      style={{ width: 84, fontFamily: font.mono, fontSize: 12, fontWeight: isSpilled(t) ? 700 : 400, color: isSpilled(t) ? "#8A6300" : color.textMuted, background: isSpilled(t) ? "#FBF2D7" : "#fff", border: `1px solid ${isSpilled(t) ? "#F0E4B8" : color.border}`, borderRadius: 6, padding: "4px 7px" }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, fontFamily: font.mono, fontWeight: isSpilled(t) ? 700 : 400, color: isSpilled(t) ? "#8A6300" : color.faint }}>{t.sprint || "—"}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: color.faint, fontFamily: font.mono, display: "flex", alignItems: "center", gap: 6 }}>
                  {t.baseline || "—"}
                  {isSpilled(t) && <span title={`Baselined in ${t.baseline}`} style={{ fontSize: 9, fontWeight: 700, color: "#8A6300", background: "#FBF2D7", border: "1px solid #F0E4B8", borderRadius: 4, padding: "0 5px" }}>SPILLED</span>}
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

// Read-only detail carried across from Jira — shown only for synced tasks. The
// editable fields above stay authoritative; this surfaces everything the sync
// imports that Atlas doesn't otherwise edit (description, people, labels,
// components, versions, resolution, time, timestamps) plus the file list.
function ChipRow({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: color.faint2, minWidth: 76 }}>{label}</span>
      {items.map((it) => (
        <span key={it} style={{ fontSize: 11.5, fontWeight: 600, color: color.textMuted, background: color.bg, border: `1px solid ${color.border2}`, borderRadius: 6, padding: "2px 8px" }}>{it}</span>
      ))}
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ fontSize: 11, color: color.faint2, minWidth: 76 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: color.text }}>{children}</span>
    </div>
  );
}

function JiraTaskPanel({ task }: { task: Task }) {
  const { data: attachments } = useQuery({
    queryKey: ["task-attachments", task.id], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<TaskAttachment[]> => (await api<TaskAttachment[]>(`/tasks/${task.id}/attachments`)) ?? [],
  });
  if (!task.jiraKey) return null;
  return (
    <div style={{ borderTop: `1px solid ${color.bg}`, marginTop: 20, paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <SectionTitle>Jira details</SectionTitle>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: color.primary, background: color.primaryTint, borderRadius: 6, padding: "2px 8px" }}>SYNCED · {task.jiraKey}</span>
        <div style={{ flex: 1 }} />
        {task.jiraUrl && (
          <a href={task.jiraUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: color.primary, textDecoration: "none" }}>
            <Icon name="externalLink" size={14} /> View in Jira
          </a>
        )}
      </div>

      {task.description && (
        <div style={{ fontSize: 12.5, color: color.subtle, whiteSpace: "pre-wrap", background: color.surfaceAlt, border: `1px solid ${color.border2}`, borderRadius: 9, padding: "10px 12px", marginBottom: 12, maxHeight: 220, overflow: "auto" }}>{task.description}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {task.issueType && <KV label="Type">{task.issueType}</KV>}
        {task.statusName && <KV label="Jira status">{task.statusName}</KV>}
        {task.reporter && <KV label="Reporter">{task.reporter}</KV>}
        {task.resolution && <KV label="Resolution">{task.resolution}</KV>}
        {task.parentKey && <KV label="Parent">{task.parentKey}</KV>}
        {!!task.timeSpentHours && <KV label="Time spent">{task.timeSpentHours}h logged</KV>}
        <ChipRow label="Labels" items={task.labels} />
        <ChipRow label="Components" items={task.components} />
        <ChipRow label="Fix versions" items={task.fixVersions} />
        {(task.jiraCreated || task.jiraUpdated) && (
          <KV label="Jira dates">
            <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint }}>
              {task.jiraCreated ? `created ${task.jiraCreated.slice(0, 10)}` : ""}{task.jiraUpdated ? ` · updated ${task.jiraUpdated.slice(0, 10)}` : ""}
            </span>
          </KV>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: color.faint2, marginBottom: 6 }}>Attachments ({attachments?.length ?? 0})</div>
        {attachments && attachments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${color.border2}`, borderRadius: 8, padding: "7px 10px" }}>
                <Icon name="paperclip" size={15} color={color.faint2} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: color.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fileName}</div>
                  <div style={{ fontSize: 10.5, color: color.faint3, fontFamily: font.mono }}>{fmtBytes(a.size)}{a.author ? ` · ${a.author}` : ""}</div>
                </div>
                <button onClick={() => apiDownload(`/task-attachments/${a.id}`, a.fileName)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: color.primary, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Icon name="download" size={14} /> Download</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: color.faint3 }}>No files attached in Jira.</div>
        )}
      </div>
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function TaskDetailModal({ projectId, task, canEdit, assigneeOptions, epicOptions, sprintOptions, onClose }: { projectId: string; task: Task; canEdit: boolean; assigneeOptions: string[]; epicOptions: string[]; sprintOptions: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(task.name);
  const [epic, setEpic] = useState(task.epic);
  const [assignee, setAssignee] = useState(task.assignee);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [sprint, setSprint] = useState(task.sprint);
  const [startDate, setStartDate] = useState(task.startDate);
  const [targetDate, setTargetDate] = useState(task.targetDate);
  const [points, setPoints] = useState(String(task.points || ""));
  const [size, setSize] = useState(task.size);
  const [estimate, setEstimate] = useState(String(task.estimateHours || ""));
  const [confirmDel, setConfirmDel] = useState(false);
  const [text, setText] = useState("");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    qc.invalidateQueries({ queryKey: ["spillover", projectId] });
    qc.invalidateQueries({ queryKey: ["raid", projectId] });
    qc.invalidateQueries({ queryKey: ["spillover-summary"] });
  };

  const save = useMutation({
    mutationFn: () => api(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({
      name: name.trim(), epic: epic.trim(), assignee: assignee.trim(), status, priority,
      sprint: sprint.trim(), startDate: startDate.trim(), targetDate: targetDate.trim(),
      points: Number(points) || 0, size, estimateHours: Number(estimate) || 0,
    }) }),
    onSuccess: () => { invalidateAll(); toast("Task saved"); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/tasks/${task.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidateAll(); toast("Task deleted"); onClose(); },
    onError: (e) => toastError(e),
  });

  const { data: cData } = useQuery({
    queryKey: ["task-comments", task.id], retry: false, staleTime: 15_000,
    queryFn: async (): Promise<{ canPost: boolean; comments: CommentItem[] }> =>
      (await api<{ canPost: boolean; comments: CommentItem[] }>(`/tasks/${task.id}/comments`)) ?? { canPost: false, comments: [] },
  });
  const comments = cData?.comments ?? [];
  const canPost = cData?.canPost ?? false;
  const post = useMutation({
    mutationFn: (body: string) => api(`/tasks/${task.id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["task-comments", task.id] }); },
  });

  const onLeave = task.assigneeOnLeave;

  return (
    <Modal onClose={onClose} width={620} label={`${task.code} · Task`}>
      {onLeave && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#A1282B", background: "#FBE7E8", border: "1px solid #F3CFD0", borderRadius: 9, padding: "9px 12px", marginBottom: 16 }}>
          <Icon name="alert" size={15} /> {task.assignee} is on leave during this task's scheduled window ({startDate || "—"} → {targetDate || startDate || "—"}).
        </div>
      )}
      <DecLabel>Task</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} placeholder="What needs doing?" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Epic</DecLabel><LinkSelect value={epic} options={epicOptions} placeholder="No epic" disabled={!canEdit} onChange={setEpic} /></div>
        <div style={{ flex: 1 }}>
          <DecLabel>Assignee</DecLabel>
          {assigneeOptions.length > 0 ? (
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={!canEdit}>
              <option value="">Unassigned</option>
              {assigneeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              {assignee && !assigneeOptions.includes(assignee) && <option value={assignee}>{assignee}</option>}
            </Select>
          ) : (
            <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={!canEdit} placeholder="Assignee" />
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit}>{TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Priority</DecLabel><Select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!canEdit}>{TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Sprint</DecLabel><LinkSelect value={sprint} options={sprintOptions} placeholder="Backlog (no sprint)" disabled={!canEdit} onChange={setSprint} /></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Start date</DecLabel><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canEdit} /></div>
        <div style={{ flex: 1 }}><DecLabel>Target date</DecLabel><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} disabled={!canEdit} /></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
        <div style={{ flex: 1 }}><DecLabel>Story points</DecLabel><Input type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} disabled={!canEdit} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>T-shirt size</DecLabel><Select value={size} onChange={(e) => setSize(e.target.value)} disabled={!canEdit}><option value="">—</option>{TASK_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Estimate (h)</DecLabel><Input type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} disabled={!canEdit} placeholder="0" /></div>
      </div>

      {/* Jira-sourced detail (read-only) — only for synced tasks */}
      <JiraTaskPanel task={task} />

      {/* Comments */}
      <div style={{ borderTop: `1px solid ${color.bg}`, marginTop: 20, paddingTop: 16 }}>
        <SectionTitle>Comments</SectionTitle>
        {comments.length === 0 ? (
          <div style={{ fontSize: 12.5, color: color.faint3, padding: "8px 0" }}>No comments yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "12px 0 4px" }}>
            {comments.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", flex: "none", background: "linear-gradient(135deg,#0F6CBD,#1E2C7C)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 }}>{c.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: color.text }}>{c.author}</span>
                    <span style={{ fontSize: 10.5, color: color.faint3, fontFamily: font.mono }}>{fmtCommentTime(c.at)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: color.subtle, whiteSpace: "pre-wrap", marginTop: 2 }}>{c.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder={canPost ? "Write a comment…" : "Your role can't post comments (needs Edit on “Projects & tasks”)"}
            disabled={!canPost || post.isPending}
            style={{ flex: 1, minHeight: 40, resize: "vertical", border: `1px solid ${color.border2}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5, fontFamily: "inherit", color: color.text, outline: "none" }}
          />
          <Button style={{ alignSelf: "flex-end" }} disabled={!canPost || post.isPending || !text.trim()} onClick={() => post.mutate(text.trim())}>{post.isPending ? "Posting…" : "Comment"}</Button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22 }}>
        {canEdit && (
          confirmDel ? (
            <>
              <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this task?</span>
              <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm delete"}</Button>
              <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete task</button>
          )
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {canEdit && <Button onClick={() => { if (name.trim()) save.mutate(); }} disabled={save.isPending || !name.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>}
      </div>
    </Modal>
  );
}

function NewTaskModal({ projectId, assigneeOptions, epicOptions, sprintOptions, defaultSprint, onClose }: { projectId: string; assigneeOptions: string[]; epicOptions: string[]; sprintOptions: string[]; defaultSprint?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [epic, setEpic] = useState("");
  const [assignee, setAssignee] = useState("");
  const [sprint, setSprint] = useState(defaultSprint ?? "");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("To Do");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [points, setPoints] = useState("");
  const [size, setSize] = useState("");
  const [estimate, setEstimate] = useState("");

  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify({
      name: name.trim(), epic: epic.trim(), assignee: assignee.trim(), sprint: sprint.trim(),
      baseline: sprint.trim(), priority, status, startDate: startDate.trim(), targetDate: targetDate.trim(),
      points: Number(points) || 0, size, estimateHours: Number(estimate) || 0,
    }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks", projectId] }); onClose(); },
  });
  const submit = () => { if (name.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={520} label="New task">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Add a task to this project's board.</div>
      <DecLabel>Task</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="What needs doing?" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Epic</DecLabel><LinkSelect value={epic} options={epicOptions} placeholder="No epic" onChange={setEpic} /></div>
        <div style={{ flex: 1 }}>
          <DecLabel>Assignee</DecLabel>
          {assigneeOptions.length > 0 ? (
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {assigneeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          ) : (
            <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Assignee" />
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Sprint</DecLabel><LinkSelect value={sprint} options={sprintOptions} placeholder="Backlog (no sprint)" onChange={setSprint} /></div>
        <div style={{ flex: 1 }}>
          <DecLabel>Priority</DecLabel>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>{TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
        </div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>{BOARD_COLS.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}</Select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Start date</DecLabel><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div style={{ flex: 1 }}><DecLabel>Target date</DecLabel><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Story points</DecLabel><Input type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>T-shirt size</DecLabel><Select value={size} onChange={(e) => setSize(e.target.value)}><option value="">—</option>{TASK_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Estimate (h)</DecLabel><Input type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="0" /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !name.trim()}>{create.isPending ? "Adding…" : "Add task"}</Button>
      </div>
    </Modal>
  );
}

// ---- Backlog (un-sprinted tasks; create, edit, assign to a sprint) ---------
function Backlog({ projectId }: { projectId: string | null }) {
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

// ---- Sprints (agile-with-sprints projects only) ---------------------------
interface SprintItem {
  id: number; name: string; goal: string; startDate: string; endDate: string; status: string;
  committedPoints: number; taskCount: number; doneCount: number; points: number; donePoints: number; spilledCount: number;
}
const SPRINT_STATUSES = ["Planned", "Started", "Halted", "Completed", "Cancelled"];
const SPRINT_STATUS: Record<string, { ink: string; tint: string }> = {
  Started:   { ink: "#0B6B37", tint: "#E7F4EC" },
  Planned:   { ink: "#56607A", tint: "#EEF1F6" },
  Halted:    { ink: "#8A6300", tint: "#FBF2D7" },
  Completed: { ink: "#0C5798", tint: "#E6EFFB" },
  Cancelled: { ink: "#A1282B", tint: "#FBE7E8" },
  // legacy values from before the lifecycle expansion
  Active:    { ink: "#0B6B37", tint: "#E7F4EC" },
  Closed:    { ink: "#0C5798", tint: "#E6EFFB" },
};

// One task line — code, name, completion tick and a status pill. Shared by the
// Sprints cards and the Epic detail modal so both read the same way.
function SprintTaskRow({ t }: { t: Task }) {
  const col = BOARD_COLS.find((c) => c.label === t.status) ?? BOARD_COLS[0];
  const done = t.status === "Done";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, background: color.bg }}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", background: done ? "#15A34A" : "transparent", border: done ? "none" : `2px solid ${col.color}` }}>
        {done && <Icon name="check" size={11} color="#fff" />}
      </span>
      <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3, flex: "none" }}>{t.code}</span>
      <span style={{ fontSize: 12.5, color: color.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: done ? "line-through" : "none" }}>{t.name}</span>
      {t.assignee && t.assignee !== "Unassigned" && <span style={{ fontSize: 11, color: color.faint2, flex: "none" }}>{t.assignee}</span>}
      <span style={{ fontSize: 10, fontWeight: 700, color: col.ink, background: col.tint, padding: "2px 8px", borderRadius: 20, flex: "none" }}>{t.status}</span>
    </div>
  );
}

function Sprints({ projectId }: { projectId: string | null }) {
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
                      {s.spilledCount > 0 && <span title={`${s.spilledCount} task(s) carried in from another sprint`} style={{ fontSize: 10, fontWeight: 700, color: "#8A6300", background: "#FBF2D7", border: "1px solid #F0E4B8", borderRadius: 5, padding: "1px 6px" }}>{s.spilledCount} spilled-in</span>}
                    </div>
                    {s.goal && <div style={{ fontSize: 12.5, color: color.subtle, marginBottom: 4 }}>{s.goal}</div>}
                    <div style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono }}>{s.startDate || "—"} → {s.endDate || "—"}</div>
                  </div>
                  {canEdit && (
                    <div style={{ display: "flex", gap: 7 }}>
                      <Button variant="secondary" onClick={() => setEdit(s)}><Icon name="edit" size={15} /> Edit</Button>
                      <button onClick={() => { if (confirm(`Delete sprint “${s.name}”? Tasks stay, but lose this iteration.`)) del.mutate(s.id); }} title="Delete sprint" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, border: `1px solid ${color.border}`, background: "#fff", cursor: "pointer", color: "#A1282B" }}><Icon name="trash" size={15} /></button>
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

interface GateCriterion { id: number; label: string; met: boolean; }
interface Gate { id: number; code: string; name: string; approver: string; status: string; date: string; pct: number; metLabel: string; criteria: GateCriterion[]; }
interface GatesData { canGovern: boolean; gates: Gate[]; }

const GATE_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved:      { ink: "#0B6B37", tint: "#E7F4EC" },
  Pending:       { ink: "#8A6300", tint: "#FBF2D7" },
  Rejected:      { ink: "#A1282B", tint: "#FBE7E8" },
  "Not started": { ink: "#8A92A6", tint: "#EEF1F6" },
};

function Governance({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["gates", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<GatesData> => (await api<GatesData>(`/projects/${projectId}/gates`)) ?? { canGovern: false, gates: [] },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["gates", projectId] });
  const toggle = useMutation({
    mutationFn: (v: { critId: number; met: boolean }) => api(`/gates/criteria/${v.critId}`, { method: "PATCH", body: JSON.stringify({ met: v.met }) }),
    onSuccess: invalidate,
  });
  const addCrit = useMutation({
    mutationFn: (v: { gateId: number; label: string }) => api(`/gates/${v.gateId}/criteria`, { method: "POST", body: JSON.stringify({ label: v.label }) }),
    onSuccess: invalidate,
    onError: (e) => toastError(e),
  });
  const delCrit = useMutation({
    mutationFn: (critId: number) => api(`/gates/criteria/${critId}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (e) => toastError(e),
  });
  const decide = useMutation({
    mutationFn: (v: { gateId: number; action: "approve" | "reject" }) => api(`/gates/${v.gateId}/${v.action}`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const gates = data?.gates ?? [];
  const canGovern = data?.canGovern ?? false;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its governance." /></Card>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Stage-gate approvals, review checkpoints &amp; decision log.</div>
        <div style={{ flex: 1 }} />
        {canGovern && <span style={{ fontSize: 11, fontWeight: 600, color: "#0B6B37", background: "#E7F4EC", padding: "4px 10px", borderRadius: 6 }}>You can approve gates</span>}
      </div>

      {/* gate rail */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, marginBottom: 20 }}>
        {gates.map((g) => {
          const sc = GATE_STATUS[g.status] ?? GATE_STATUS["Not started"];
          const canAct = canGovern && g.status !== "Approved";
          return (
            <div key={g.id} style={{ flex: "0 0 224px", background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: "15px 16px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ flex: 1, fontFamily: font.head, fontSize: 13.5, fontWeight: 600, color: color.ink }}>{g.name}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{g.status}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: color.faint3, marginBottom: 10 }}>
                <span>{g.approver}</span><span>·</span><span>{g.date || "—"}</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: color.bg, overflow: "hidden", marginBottom: 8 }}><div style={{ height: "100%", width: `${g.pct}%`, background: color.primary }} /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                {g.criteria.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
                    <button onClick={() => canGovern && toggle.mutate({ critId: c.id, met: !c.met })} disabled={!canGovern || toggle.isPending}
                      style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: 7, textAlign: "left", background: "none", border: "none", padding: 0, cursor: canGovern ? "pointer" : "default", fontFamily: "inherit" }}>
                      <span style={{ flex: "none", width: 14, height: 14, borderRadius: 4, marginTop: 1, background: c.met ? "#15A34A" : "transparent", border: c.met ? "none" : `1.5px solid ${color.border2}`, color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.met ? "✓" : ""}</span>
                      <span style={{ fontSize: 11.5, color: color.text, lineHeight: 1.35 }}>{c.label}</span>
                    </button>
                    {canGovern && (
                      <button onClick={() => { if (confirm(`Remove criterion “${c.label}”?`)) delCrit.mutate(c.id); }} title="Remove criterion"
                        style={{ flex: "none", background: "none", border: "none", cursor: "pointer", color: color.faint3, padding: 0, marginTop: 1, lineHeight: 1 }}>×</button>
                    )}
                  </div>
                ))}
                {canGovern && (
                  <button onClick={() => { const l = prompt("New criterion")?.trim(); if (l) addCrit.mutate({ gateId: g.id, label: l }); }} disabled={addCrit.isPending}
                    style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 600, color: color.primary, background: "none", border: "none", padding: "2px 0", cursor: "pointer", fontFamily: "inherit" }}>+ Add criterion</button>
                )}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 10.5, color: color.faint3, marginBottom: 8 }}>{g.metLabel}</div>
              {canAct && (
                <div style={{ display: "flex", gap: 7 }}>
                  <button onClick={() => decide.mutate({ gateId: g.id, action: "approve" })} disabled={decide.isPending}
                    style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#fff", background: "#0B6B37", border: "none", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontFamily: "inherit" }}>Approve</button>
                  <button onClick={() => decide.mutate({ gateId: g.id, action: "reject" })} disabled={decide.isPending}
                    style={{ flex: "none", fontSize: 12, fontWeight: 600, color: "#A1282B", background: "#FBE7E8", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit" }}>Reject</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* review checkpoints (structural; populated from architecture/security reviews) */}
      <Card padding={0} style={{ overflow: "hidden", marginBottom: 18 }}>
        <div style={{ padding: "16px 22px 13px", fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Architecture &amp; security review checkpoints</div>
        <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1.2fr 0.9fr 0.8fr 2.2fr", padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Gate</div><div>Type</div><div>Reviewer</div><div>Status</div><div>Date</div><div>Note</div>
        </div>
        <EmptyBlock message="No review checkpoints scheduled yet." minHeight={120} />
      </Card>

      {/* decision log (ADR) */}
      <DecisionLog projectId={projectId} canGovern={canGovern} />
    </div>
  );
}

interface Decision { id: number; code: string; title: string; context: string; decision: string; owner: string; date: string; status: string; }
const DEC_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: "#0B6B37", tint: "#E7F4EC" },
  Proposed: { ink: "#0C5798", tint: "#E6EFFB" },
  Rejected: { ink: "#A1282B", tint: "#FBE7E8" },
};
const DEC_COLS = "0.7fr 1.6fr 2fr 1fr 0.8fr 0.9fr";

function DecisionLog({ projectId, canGovern }: { projectId: string | null; canGovern: boolean }) {
  const [modal, setModal] = useState(false);
  const [open, setOpen] = useState<Decision | null>(null);
  const { data } = useQuery({
    queryKey: ["decisions", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<Decision[]> => (await api<{ decisions: Decision[] }>(`/projects/${projectId}/decisions`))?.decisions ?? [],
  });
  const decisions = data ?? [];

  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px 22px 13px" }}>
        <span style={{ flex: 1, fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Decision log</span>
        {canGovern && (
          <button onClick={() => setModal(true)} style={{ fontSize: 12.5, fontWeight: 600, color: color.primary, background: "#EAF2FC", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit" }}>+ Log decision</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: DEC_COLS, padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
        <div>ID</div><div>Decision</div><div>Rationale</div><div>Owner</div><div>Date</div><div>Status</div>
      </div>
      {decisions.length === 0 ? (
        <EmptyBlock message="No decisions logged yet." minHeight={120} />
      ) : decisions.map((d) => {
        const sc = DEC_STATUS[d.status] ?? DEC_STATUS.Proposed;
        return (
          <div key={d.code} onClick={() => canGovern && setOpen(d)} style={{ display: "grid", gridTemplateColumns: DEC_COLS, alignItems: "flex-start", padding: "13px 22px", borderBottom: "1px solid #F2F4F9", cursor: canGovern ? "pointer" : "default" }}>
            <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint3 }}>{d.code}</div>
            <div style={{ fontSize: 13, color: color.text, fontWeight: 600 }}>{d.title}</div>
            <div style={{ fontSize: 12, color: color.faint, lineHeight: 1.4 }}><span style={{ color: color.faint3 }}>{d.context}</span> {d.decision}</div>
            <div style={{ fontSize: 12, color: color.subtle }}>{d.owner}</div>
            <div style={{ fontSize: 11.5, color: color.faint3 }}>{d.date}</div>
            <div><span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 9px", borderRadius: 6 }}>{d.status}</span></div>
          </div>
        );
      })}
      {modal && <LogDecisionModal projectId={projectId!} onClose={() => setModal(false)} />}
      {open && <EditDecisionModal projectId={projectId!} decision={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function EditDecisionModal({ projectId, decision, onClose }: { projectId: string; decision: Decision; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(decision.title);
  const [context, setContext] = useState(decision.context);
  const [dtext, setDtext] = useState(decision.decision);
  const [owner, setOwner] = useState(decision.owner === "—" ? "" : decision.owner);
  const [status, setStatus] = useState(decision.status);
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["decisions", projectId] });
  const save = useMutation({
    mutationFn: () => api(`/decisions/${decision.id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim(), context: context.trim(), decision: dtext.trim(), owner: owner.trim(), status }) }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/decisions/${decision.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  return (
    <Modal onClose={onClose} width={500} label={`${decision.code} · Decision`}>
      <DecLabel>Decision title</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What was decided?" style={{ marginBottom: 14 }} />
      <DecLabel>Context / problem</DecLabel>
      <Textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Why was a decision needed?" style={{ minHeight: 56, resize: "vertical", marginBottom: 14 }} />
      <DecLabel>Decision &amp; rationale</DecLabel>
      <Textarea value={dtext} onChange={(e) => setDtext(e.target.value)} placeholder="What was chosen and why?" style={{ minHeight: 56, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Owner</DecLabel><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Decision owner" /></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{["Proposed", "Approved", "Rejected"].map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this decision?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}

function LogDecisionModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [decision, setDecision] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("Proposed");

  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/decisions`, { method: "POST", body: JSON.stringify({ title: title.trim(), context: context.trim(), decision: decision.trim(), owner: owner.trim(), status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["decisions", projectId] }); onClose(); },
  });
  const submit = () => { if (title.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={500} label="Log a decision">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Captured in the project decision log.</div>
      <DecLabel>Decision title</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What was decided?" style={{ marginBottom: 14 }} />
      <DecLabel>Context / problem</DecLabel>
      <Textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Why was a decision needed?" style={{ minHeight: 56, resize: "vertical", marginBottom: 14 }} />
      <DecLabel>Decision &amp; rationale</DecLabel>
      <Textarea value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="What was chosen and why?" style={{ minHeight: 56, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <DecLabel>Owner</DecLabel>
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Decision owner" />
        </div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["Proposed", "Approved", "Rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !title.trim()}>{create.isPending ? "Logging…" : "Log decision"}</Button>
      </div>
    </Modal>
  );
}

function DecLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", marginBottom: 5 }}>{children}</label>;
}

interface RaidItem { id: number; type: string; title: string; owner: string; status: string; auto?: boolean; }
const RAID_TYPE_COLORS: Record<string, { ink: string; tint: string }> = {
  Risk:       { ink: "#8A6300", tint: "#FBF2D7" },
  Issue:      { ink: "#A1282B", tint: "#FBE7E8" },
  Assumption: { ink: "#0C5798", tint: "#E6EFFB" },
  Dependency: { ink: "#5E2E89", tint: "#F0E8F7" },
};
const RAID_STATUS: Record<string, { ink: string; tint: string; dot: string }> = {
  Open:       { ink: "#A1282B", tint: "#FBE7E8", dot: "#D13438" },
  Mitigating: { ink: "#8A6300", tint: "#FBF2D7", dot: "#E0A100" },
  Validating: { ink: "#8A6300", tint: "#FBF2D7", dot: "#E0A100" },
  "On track": { ink: "#0B6B37", tint: "#E7F4EC", dot: "#15A34A" },
  Resolved:   { ink: "#0B6B37", tint: "#E7F4EC", dot: "#15A34A" },
  Closed:     { ink: "#0B6B37", tint: "#E7F4EC", dot: "#15A34A" },
};
const raidStatus = (s: string) => RAID_STATUS[s] ?? { ink: "#56607A", tint: "#EEF1F6", dot: "#8A92A6" };
const RAID_TYPES = ["Risk", "Issue", "Assumption", "Dependency"];
const RAID_STATUSES = ["Open", "Mitigating", "Validating", "On track", "Resolved", "Closed"];

function Raid({ projectId }: { projectId: string | null }) {
  const [modal, setModal] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data } = useQuery({
    queryKey: ["raid", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; items: RaidItem[] }> =>
      (await api<{ canEdit: boolean; items: RaidItem[] }>(`/projects/${projectId}/raid`)) ?? { canEdit: false, items: [] },
  });
  const items = data?.items ?? [];
  const canEdit = data?.canEdit ?? false;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its RAID register." /></Card>;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Risks, issues, assumptions &amp; dependencies for this project.</div>
        <div style={{ flex: 1 }} />
        {canEdit && <Button onClick={() => setModal(true)}><Icon name="plus" size={16} /> New item</Button>}
      </div>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.9fr 3fr 1fr 1fr", padding: "14px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Type</div><div>Item</div><div>Owner</div><div>Status</div>
        </div>
        {items.length === 0 ? (
          <EmptyBlock message="No RAID items logged yet." minHeight={140} />
        ) : items.map((r) => {
          const tc = RAID_TYPE_COLORS[r.type] ?? RAID_TYPE_COLORS.Risk;
          const sc = raidStatus(r.status);
          const clickable = canEdit && !r.auto;
          return (
            <div key={r.id} onClick={() => clickable && setOpenId(r.id)}
              style={{ display: "grid", gridTemplateColumns: "0.9fr 3fr 1fr 1fr", alignItems: "start", padding: "14px 22px", borderBottom: "1px solid #F2F4F9", cursor: clickable ? "pointer" : "default" }}>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: tc.ink, background: tc.tint, padding: "3px 10px", borderRadius: 6 }}>{r.type}</span></div>
              <div style={{ fontSize: 13.5, color: color.text, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {r.title}
                {r.auto && <span title="Auto-raised by Atlas from live project data — clears automatically when resolved" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, color: "#0C5798", background: "#E6EFFB", borderRadius: 5, padding: "1px 7px", letterSpacing: "0.03em" }}>✦ AUTO</span>}
              </div>
              <div style={{ fontSize: 13, color: color.subtle }}>{r.owner}</div>
              <div><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 10px", borderRadius: 20 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />{r.status}</span></div>
            </div>
          );
        })}
      </Card>
      {modal && <RaidModal projectId={projectId} onClose={() => setModal(false)} />}
      {openId !== null && (() => {
        const r = items.find((x) => x.id === openId);
        if (!r) return null;
        return <RaidModal projectId={projectId} item={r} onClose={() => setOpenId(null)} />;
      })()}
    </>
  );
}

function RaidModal({ projectId, item, onClose }: { projectId: string; item?: RaidItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState(item?.type ?? RAID_TYPES[0]);
  const [title, setTitle] = useState(item?.title ?? "");
  const [owner, setOwner] = useState(item && item.owner !== "—" ? item.owner : "");
  const [status, setStatus] = useState(item?.status ?? RAID_STATUSES[0]);
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["raid", projectId] });

  const body = () => JSON.stringify({ type, title: title.trim(), owner: owner.trim(), status });
  const save = useMutation({
    mutationFn: () => item
      ? api(`/raid/${item.id}`, { method: "PATCH", body: body() })
      : api(`/projects/${projectId}/raid`, { method: "POST", body: body() }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/raid/${item!.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });

  return (
    <Modal onClose={onClose} width={480} label={item ? "RAID item" : "New RAID item"}>
      {!item && <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Log a risk, issue, assumption or dependency against this project.</div>}
      <DecLabel>Type</DecLabel>
      <Select value={type} onChange={(e) => setType(e.target.value)} style={{ marginBottom: 14 }}>
        {RAID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </Select>
      <DecLabel>Item</DecLabel>
      <Textarea value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Describe the risk / issue / assumption / dependency" style={{ minHeight: 60, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <DecLabel>Owner</DecLabel>
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" />
        </div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {RAID_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {item && (
          confirmDel ? (
            <>
              <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this item?</span>
              <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
              <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
          )
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : item ? "Save changes" : "Add item"}</Button>
      </div>
    </Modal>
  );
}

interface CommentItem { id: number; author: string; initials: string; body: string; at: string; }

function fmtCommentTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Comments({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data } = useQuery({
    queryKey: ["comments", projectId], enabled: !!projectId, retry: false, staleTime: 15_000,
    queryFn: async (): Promise<{ canPost: boolean; comments: CommentItem[] }> =>
      (await api<{ canPost: boolean; comments: CommentItem[] }>(`/projects/${projectId}/comments`)) ?? { canPost: false, comments: [] },
  });
  const comments = data?.comments ?? [];
  const canPost = data?.canPost ?? false;
  const post = useMutation({
    mutationFn: (body: string) => api(`/projects/${projectId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["comments", projectId] }); },
  });

  if (!projectId) return <Card><EmptyBlock minHeight={160} message="Select a project from the Portfolio to view its discussion." /></Card>;

  return (
    <Card padding={22}>
      <SectionTitle>Discussion</SectionTitle>
      {comments.length === 0 ? (
        <EmptyBlock message="No comments yet. Start the conversation below." minHeight={90} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "14px 0 4px" }}>
          {comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 11 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", flex: "none", background: "linear-gradient(135deg,#0F6CBD,#1E2C7C)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>{c.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{c.author}</span>
                  <span style={{ fontSize: 11, color: color.faint3, fontFamily: font.mono }}>{fmtCommentTime(c.at)}</span>
                </div>
                <div style={{ fontSize: 13, color: color.subtle, whiteSpace: "pre-wrap", marginTop: 2 }}>{c.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 12, borderTop: `1px solid ${color.bg}`, paddingTop: 16 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canPost ? "Write a comment…" : "Your role can't post comments (needs Edit on “Comments & artifacts”)"}
          disabled={!canPost || post.isPending}
          style={{ flex: 1, minHeight: 44, resize: "vertical", border: `1px solid ${color.border2}`, borderRadius: 9, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", color: color.text, outline: "none" }}
        />
        <Button style={{ alignSelf: "flex-end" }} disabled={!canPost || post.isPending || !text.trim()} onClick={() => post.mutate(text.trim())}>
          {post.isPending ? "Posting…" : "Comment"}
        </Button>
      </div>
    </Card>
  );
}

// ---- Security, privacy & compliance ---------------------------------------
interface SecProfile {
  classification: string; residency: string; subjects: string; retention: string;
  personalData: boolean; specialCategory: boolean; automatedDecisions: boolean; cardholderData: boolean;
  gdpr: boolean; pci: boolean; iso: boolean; aiAct: boolean; soc2: boolean; nis2: boolean;
  dpp?: boolean; ppwr?: boolean; eudr?: boolean;
}
interface SecControl { id: number; code: string; control: string; framework: string; evidence: string; owner: string; status: string; description: string; reason: string; }
interface SecReviewGate { id: number; name: string; type: string; reviewer: string; status: string; date: string; note: string; }
interface SecData { canEdit: boolean; profile: SecProfile; controls: SecControl[]; reviewGates: SecReviewGate[]; }
const SRG_TYPES = ["Security", "Architecture", "Privacy", "Threat model", "Data protection"];
const SRG_STATUSES = ["Scheduled", "Passed", "Failed", "Waived", "Not required"];
const SRG_STATUS: Record<string, { ink: string; tint: string }> = {
  Passed:         { ink: "#0B6B37", tint: "#E7F4EC" },
  Scheduled:      { ink: "#0C5798", tint: "#E6EFFB" },
  Failed:         { ink: "#A1282B", tint: "#FBE7E8" },
  Waived:         { ink: "#8A6300", tint: "#FBF2D7" },
  "Not required": { ink: "#56607A", tint: "#EEF1F6" },
};

const CLASS_OPTS = ["Public", "Internal", "Confidential", "Restricted"];
const RESIDENCY_OPTS = ["EU / EEA", "Global", "On-prem only"];
const FRAMEWORK_OPTS = ["ISO 27001", "GDPR", "PCI-DSS", "SOC 2", "NIS2", "EU AI Act", "Digital Product Passport (ESPR)", "Packaging (PPWR)", "EU Deforestation (EUDR)"];
const CTL_STATUSES = ["Planned", "Partial", "Implemented", "Archived"];
const CTL_STATUS: Record<string, { ink: string; tint: string }> = {
  Implemented: { ink: "#0B6B37", tint: "#E7F4EC" },
  Partial:     { ink: "#8A6300", tint: "#FBF2D7" },
  Planned:     { ink: "#56607A", tint: "#EEF1F6" },
  Archived:    { ink: "#5E2E89", tint: "#F0E8F7" },
};
const SEC_FLAGS: { key: keyof SecProfile; label: string; desc: string }[] = [
  { key: "gdpr", label: "GDPR", desc: "Personal data of EU/EEA data subjects" },
  { key: "pci", label: "PCI-DSS", desc: "Cardholder data in scope" },
  { key: "iso", label: "ISO 27001", desc: "ISMS Annex A controls apply" },
  { key: "aiAct", label: "EU AI Act", desc: "Automated recommendation model" },
  { key: "soc2", label: "SOC 2", desc: "Vendor assurance for SaaS components" },
  { key: "nis2", label: "NIS2", desc: "Essential-entity operational resilience" },
  { key: "dpp", label: "Digital Product Passport", desc: "ESPR product data & data carrier" },
  { key: "ppwr", label: "Packaging (PPWR)", desc: "Packaging design, recyclability & EPR" },
  { key: "eudr", label: "EU Deforestation (EUDR)", desc: "Due diligence for listed commodities" },
];
// Reference facts for the product & sustainability regulations (static domain
// knowledge, verified against EU sources — not per-project data).
const REG_GUIDE: { key: keyof SecProfile; name: string; scope: string; obligations: string[]; deadlines: { date: string; what: string }[] }[] = [
  {
    key: "dpp", name: "Digital Product Passport — ESPR (EU) 2024/1781",
    scope: "A digital record of a product's sustainability data (materials, durability, repairability, recycled content, carbon footprint), reached via a data carrier (QR/RFID). Rolls out per product group through delegated acts.",
    obligations: ["Unique product identifier + data carrier on product/packaging", "Machine-readable sustainability & circularity data", "Data kept accessible to authorities, consumers & the value chain", "Battery passport for EV/industrial/LMT batteries > 2 kWh"],
    deadlines: [{ date: "18 Feb 2027", what: "Battery passport mandatory (Battery Reg. 2023/1542)" }, { date: "2027", what: "Textiles delegated act expected to be adopted" }, { date: "2027–2030", what: "First ESPR product groups (textiles, furniture, tyres, electronics) phase in" }],
  },
  {
    key: "ppwr", name: "Packaging & Packaging Waste Regulation — PPWR (EU) 2025/40",
    scope: "Directly-applicable EU regulation covering all packaging placed on the EU market: design, minimisation, recyclability, recycled content, reuse and producer responsibility.",
    obligations: ["Declaration of conformity + technical documentation per packaging unit", "Packaging minimisation — e-commerce empty space ≤ 40%", "Restrictions on substances of concern (incl. PFAS in food-contact)", "Producer registration & extended producer responsibility (EPR)"],
    deadlines: [{ date: "12 Aug 2026", what: "Most obligations apply (conformity, minimisation, substances)" }, { date: "2027", what: "Producer registers available per member state" }, { date: "1 Jan 2030", what: "Recyclability grades, recycled-content minima, reuse targets, SUP bans" }],
  },
  {
    key: "eudr", name: "EU Deforestation Regulation — EUDR (EU) 2023/1115",
    scope: "Due-diligence regime for cattle, cocoa, coffee, oil palm, rubber, soy and wood (and derived products) placed on or exported from the EU — must be deforestation-free (after 31 Dec 2020) and legal.",
    obligations: ["Due-diligence statement per consignment via the EU Information System", "Geolocation coordinates of all plots of production", "Risk assessment & mitigation to negligible risk", "Deforestation-free (post-2020 cut-off) + legality evidence"],
    deadlines: [{ date: "30 Dec 2026", what: "Application for large & medium operators/traders (Reg. 2025/2650)" }, { date: "30 Jun 2027", what: "Application for micro & small enterprises" }],
  },
];
const DPIA_COLOR: Record<string, { ink: string; tint: string }> = {
  Required:      { ink: "#A1282B", tint: "#FBE7E8" },
  Recommended:   { ink: "#8A6300", tint: "#FBF2D7" },
  "Not required":{ ink: "#0B6B37", tint: "#E7F4EC" },
};
function dpiaVerdict(p: SecProfile): { level: string; reason: string } {
  if (p.specialCategory || p.automatedDecisions || p.classification === "Restricted")
    return { level: "Required", reason: "Special-category data, automated decision-making, or restricted classification triggers a mandatory DPIA under GDPR Art. 35." };
  if (p.personalData || p.cardholderData)
    return { level: "Recommended", reason: "Personal or cardholder data is processed — a screening DPIA is recommended to confirm residual risk." };
  return { level: "Not required", reason: "No personal, special-category or cardholder data identified in scope." };
}
const SEC_COLS = "0.6fr 1.9fr 0.9fr 1.9fr 1.1fr 0.9fr";

function Security({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [openCtl, setOpenCtl] = useState<SecControl | null>(null);
  const [gateModal, setGateModal] = useState(false);
  const [openGate, setOpenGate] = useState<SecReviewGate | null>(null);
  const { data } = useQuery({
    queryKey: ["security", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<SecData | null> => await api<SecData>(`/projects/${projectId}/security`),
  });
  const patch = useMutation({
    mutationFn: (body: Partial<SecProfile>) => api(`/projects/${projectId}/security`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security", projectId] }),
  });
  const cycle = useMutation({
    mutationFn: (v: { id: number; status: string }) => api(`/security/controls/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: v.status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security", projectId] }),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its security posture." /></Card>;
  if (!data) return <Card><EmptyBlock minHeight={220} message="Loading security profile…" /></Card>;

  const { profile: p, controls, canEdit } = data;
  const dpia = dpiaVerdict(p);
  const dc = DPIA_COLOR[dpia.level];
  const toggles: { key: keyof SecProfile; label: string }[] = [
    { key: "personalData", label: "Personal data processed" },
    { key: "specialCategory", label: "Special-category data" },
    { key: "automatedDecisions", label: "Automated decision-making" },
    { key: "cardholderData", label: "Cardholder data" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: color.ink }}>Security, privacy &amp; compliance</div>
        {canEdit && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#0B6B37", background: "#E7F4EC", padding: "4px 11px", borderRadius: 20 }}>● Security governance enabled</span>}
      </div>

      {/* data classification & privacy profile */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Data classification &amp; privacy profile</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "14px 26px" }}>
          <SecField label="Data classification">
            <Select value={p.classification} disabled={!canEdit} onChange={(e) => patch.mutate({ classification: e.target.value })}>
              {CLASS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </SecField>
          <SecField label="Data residency">
            <Select value={p.residency} disabled={!canEdit} onChange={(e) => patch.mutate({ residency: e.target.value })}>
              {RESIDENCY_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </SecField>
          <SecField label="Data subjects">
            <SecTextField value={p.subjects} disabled={!canEdit} placeholder="e.g. ~4.8M shoppers (Nordic)" onCommit={(v) => patch.mutate({ subjects: v })} />
          </SecField>
          <SecField label="Retention">
            <SecTextField value={p.retention} disabled={!canEdit} placeholder="e.g. 7 years (financial)" onCommit={(v) => patch.mutate({ retention: v })} />
          </SecField>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          {toggles.map((t) => (
            <Toggle key={t.key} on={!!p[t.key]} label={t.label} disabled={!canEdit} onClick={() => patch.mutate({ [t.key]: !p[t.key] } as Partial<SecProfile>)} />
          ))}
        </div>
      </Card>

      {/* DPIA banner */}
      <div style={{ border: `1px solid ${dc.ink}`, background: dc.tint, borderRadius: 16, padding: "18px 22px", marginBottom: 16 }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 700, color: dc.ink }}>DPIA / PIA — {dpia.level}</div>
        <div style={{ fontSize: 13, color: "#3A4358", lineHeight: 1.55, marginTop: 8 }}>{dpia.reason}</div>
      </div>

      {/* compliance flags */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Applicable frameworks &amp; regulations</SectionTitle>
        <div style={{ fontSize: 12, color: color.faint2, marginTop: -6, marginBottom: 14 }}>Toggle the regimes in scope for this initiative — these drive the required controls and gates.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {SEC_FLAGS.map((f) => {
            const on = !!p[f.key];
            return (
              <div key={f.key} onClick={() => canEdit && patch.mutate({ [f.key]: !on } as Partial<SecProfile>)} style={{ minWidth: 150, borderRadius: 11, border: `1px solid ${color.border}`, overflow: "hidden", cursor: canEdit ? "pointer" : "default" }}>
                <div style={{ background: on ? color.primary : "#EEF0F4", color: on ? "#fff" : "#7B849A", fontSize: 13, fontWeight: 700, padding: "9px 13px" }}>{f.label}</div>
                <div style={{ fontSize: 11, color: "#7B849A", padding: "8px 13px", lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* product & sustainability regulation reference — obligations + deadlines */}
      {(() => {
        const active = REG_GUIDE.filter((r) => !!p[r.key]);
        const shown = active.length > 0 ? active : REG_GUIDE;   // guidance even before a toggle is on
        return (
          <Card padding={22} style={{ marginBottom: 16 }}>
            <SectionTitle>Product &amp; sustainability regulations</SectionTitle>
            <div style={{ fontSize: 12, color: color.faint2, margin: "3px 0 14px" }}>
              {active.length > 0 ? "Obligations & key dates for the regulations enabled above." : "Reference for EU product & sustainability regulations. Toggle one on above when it applies to this project."}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {shown.map((r) => (
                <div key={r.key} style={{ border: `1px solid ${color.border}`, borderRadius: 12, padding: "15px 17px", opacity: active.length > 0 || !!p[r.key] ? 1 : 0.92 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: color.ink }}>{r.name}</span>
                    {!!p[r.key] && <span style={{ fontSize: 10, fontWeight: 700, color: "#0B6B37", background: "#E7F4EC", padding: "2px 8px", borderRadius: 20 }}>Applies</span>}
                  </div>
                  <div style={{ fontSize: 12, color: color.subtle, lineHeight: 1.5, marginBottom: 11 }}>{r.scope}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>Key obligations</div>
                      <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                        {r.obligations.map((o, i) => <li key={i} style={{ fontSize: 12, color: color.text, lineHeight: 1.4 }}>{o}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>Milestones</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {r.deadlines.map((d, i) => (
                          <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                            <span style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 700, color: color.primary, flex: "none", minWidth: 78 }}>{d.date}</span>
                            <span style={{ fontSize: 11.5, color: color.subtle, lineHeight: 1.4 }}>{d.what}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* security review gates */}
      <Card padding={0} style={{ overflow: "hidden", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "15px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <span style={{ flex: 1, fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>Security review gates</span>
          {canEdit && <button onClick={() => setGateModal(true)} style={{ fontSize: 12.5, fontWeight: 600, color: color.primary, background: "#EAF2FB", border: "none", padding: "8px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>+ Add gate</button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.1fr 0.9fr 0.9fr", padding: "11px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Gate</div><div>Type</div><div>Reviewer</div><div>Date</div><div>Status</div>
        </div>
        {(data.reviewGates ?? []).length === 0 ? (
          <EmptyBlock message="No security review gates scheduled yet." minHeight={110} />
        ) : data.reviewGates.map((g) => {
          const gs = SRG_STATUS[g.status] ?? SRG_STATUS.Scheduled;
          return (
            <div key={g.id} onClick={() => canEdit && setOpenGate(g)} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.1fr 0.9fr 0.9fr", alignItems: "center", padding: "12px 22px", borderBottom: "1px solid #F5F7FA", cursor: canEdit ? "pointer" : "default" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: canEdit ? color.primary : color.text }}>{g.name}{g.note && <div style={{ fontSize: 11, color: color.faint3, fontWeight: 400, marginTop: 2 }}>{g.note}</div>}</div>
              <div style={{ fontSize: 11.5, color: color.subtle }}>{g.type}</div>
              <div style={{ fontSize: 11.5, color: color.subtle }}>{g.reviewer || "—"}</div>
              <div style={{ fontSize: 11.5, color: color.faint, fontFamily: font.mono }}>{g.date || "—"}</div>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: gs.ink, background: gs.tint, padding: "3px 9px", borderRadius: 6 }}>{g.status}</span></div>
            </div>
          );
        })}
      </Card>

      {/* control evidence register */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "15px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <span style={{ flex: 1, fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>Control evidence register</span>
          {canEdit && <button onClick={() => setAddOpen(true)} style={{ fontSize: 12.5, fontWeight: 600, color: color.primary, background: "#EAF2FB", border: "none", padding: "8px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>+ Add control</button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: SEC_COLS, padding: "11px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>ID</div><div>Control</div><div>Framework</div><div>Evidence</div><div>Owner</div><div>Status</div>
        </div>
        {controls.length === 0 ? (
          <EmptyBlock message="No controls logged yet." minHeight={120} />
        ) : controls.map((c) => {
          const sc = CTL_STATUS[c.status] ?? CTL_STATUS.Planned;
          const nextStatus = CTL_STATUSES[(CTL_STATUSES.indexOf(c.status) + 1) % CTL_STATUSES.length];
          return (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: SEC_COLS, alignItems: "center", padding: "12px 22px", borderBottom: "1px solid #F5F7FA", opacity: c.status === "Archived" ? 0.6 : 1 }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, color: color.faint3 }}>{c.code}</div>
              <div style={{ minWidth: 0 }}>
                {canEdit ? (
                  <button onClick={() => setOpenCtl(c)} style={{ fontSize: 12.5, color: color.primary, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>{c.control}</button>
                ) : (
                  <span style={{ fontSize: 12.5, color: color.text, fontWeight: 600 }}>{c.control}</span>
                )}
                {c.reason && <div style={{ fontSize: 10.5, color: color.faint3, fontStyle: "italic", marginTop: 2 }}>{c.reason}</div>}
              </div>
              <div style={{ fontSize: 11.5, color: color.subtle }}>{c.framework}</div>
              <div style={{ fontSize: 11.5, color: "#7B849A", lineHeight: 1.4 }}>{c.evidence}</div>
              <div style={{ fontSize: 11.5, color: color.subtle }}>{c.owner}</div>
              <div>
                <button onClick={() => canEdit && cycle.mutate({ id: c.id, status: nextStatus })} disabled={!canEdit || cycle.isPending}
                  title={canEdit ? "Click to cycle status" : undefined}
                  style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "5px 10px", borderRadius: 20, border: "none", cursor: canEdit ? "pointer" : "default", fontFamily: "inherit" }}>{c.status}</button>
              </div>
            </div>
          );
        })}
      </Card>

      {addOpen && <AddControlModal projectId={projectId} onClose={() => setAddOpen(false)} />}
      {openCtl && <EditControlModal projectId={projectId} ctl={openCtl} onClose={() => setOpenCtl(null)} />}
      {gateModal && <SecReviewGateModal projectId={projectId} onClose={() => setGateModal(false)} />}
      {openGate && <SecReviewGateModal projectId={projectId} gate={openGate} onClose={() => setOpenGate(null)} />}
    </div>
  );
}

function SecReviewGateModal({ projectId, gate, onClose }: { projectId: string; gate?: SecReviewGate; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(gate?.name ?? "");
  const [type, setType] = useState(gate?.type ?? "Security");
  const [reviewer, setReviewer] = useState(gate?.reviewer ?? "");
  const [status, setStatus] = useState(gate?.status ?? "Scheduled");
  const [date, setDate] = useState(gate?.date ?? "");
  const [note, setNote] = useState(gate?.note ?? "");
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["security", projectId] });
  const body = () => JSON.stringify({ name: name.trim(), type, reviewer: reviewer.trim(), status, date: date.trim(), note: note.trim() });
  const save = useMutation({
    mutationFn: () => gate
      ? api(`/security/review-gates/${gate.id}`, { method: "PATCH", body: body() })
      : api(`/projects/${projectId}/security/review-gates`, { method: "POST", body: body() }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/security/review-gates/${gate!.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  return (
    <Modal onClose={onClose} width={480} label={gate ? "Security review gate" : "New review gate"}>
      <DecLabel>Gate</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. G2 Security review" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Type</DecLabel><Select value={type} onChange={(e) => setType(e.target.value)}>{SRG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{SRG_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Reviewer</DecLabel><Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Reviewer" /></div>
        <div style={{ flex: 1 }}><DecLabel>Date</DecLabel><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <DecLabel>Note</DecLabel>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Scope, findings, conditions…" style={{ minHeight: 56, resize: "vertical" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {gate && (confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this gate?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        ))}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (name.trim()) save.mutate(); }} disabled={save.isPending || !name.trim()}>{save.isPending ? "Saving…" : gate ? "Save changes" : "Add gate"}</Button>
      </div>
    </Modal>
  );
}

function EditControlModal({ projectId, ctl, onClose }: { projectId: string; ctl: SecControl; onClose: () => void }) {
  const qc = useQueryClient();
  const [control, setControl] = useState(ctl.control);
  const [framework, setFramework] = useState(ctl.framework);
  const [evidence, setEvidence] = useState(ctl.evidence === "—" ? "" : ctl.evidence);
  const [owner, setOwner] = useState(ctl.owner === "—" ? "" : ctl.owner);
  const [status, setStatus] = useState(ctl.status);
  const [description, setDescription] = useState(ctl.description);
  const [reason, setReason] = useState(ctl.reason);
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["security", projectId] });

  const save = useMutation({
    mutationFn: () => api(`/security/controls/${ctl.id}`, { method: "PATCH", body: JSON.stringify({
      control: control.trim(), framework, evidence: evidence.trim(), owner: owner.trim(), status,
      description: description.trim(), reason: reason.trim(),
    }) }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/security/controls/${ctl.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });

  return (
    <Modal onClose={onClose} width={520} label={`${ctl.code} · Control`}>
      <DecLabel>Control</DecLabel>
      <Input value={control} onChange={(e) => setControl(e.target.value)} placeholder="e.g. A.8.24 Use of cryptography" style={{ marginBottom: 14 }} />
      <DecLabel>Description</DecLabel>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the control does and how it's met" style={{ minHeight: 60, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Framework</DecLabel><Select value={framework} onChange={(e) => setFramework(e.target.value)}>{FRAMEWORK_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{CTL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Owner</DecLabel><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" /></div>
        <div style={{ flex: 1 }}><DecLabel>Evidence</DecLabel><Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Link / reference" /></div>
      </div>
      <DecLabel>Reason for change (e.g. why archived / modified)</DecLabel>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional rationale" />

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Remove this control?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Removing…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Remove control</button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (control.trim()) save.mutate(); }} disabled={save.isPending || !control.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}

function SecField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function SecTextField({ value, disabled, placeholder, onCommit }: { value: string; disabled?: boolean; placeholder?: string; onCommit: (v: string) => void }) {
  // Uncontrolled + key ensures the field re-syncs when the server value changes,
  // while local typing stays uncommitted until blur (no effect-driven setState).
  return (
    <Input key={value} defaultValue={value} disabled={disabled} placeholder={placeholder}
      onBlur={(e) => { if (e.target.value !== value) onCommit(e.target.value); }} />
  );
}

function Toggle({ on, label, disabled, onClick }: { on: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <div onClick={() => !disabled && onClick()} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, padding: "9px 14px", borderRadius: 9, border: `1px solid ${color.border2}`, background: "#F7F9FC", color: "#3A4358", cursor: disabled ? "default" : "pointer" }}>
      <span style={{ width: 34, height: 19, borderRadius: 20, background: on ? "#15A34A" : "#CBD2DE", position: "relative", flex: "none", transition: "background .15s" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
      </span>
      {label}
    </div>
  );
}

function AddControlModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [control, setControl] = useState("");
  const [framework, setFramework] = useState(FRAMEWORK_OPTS[0]);
  const [evidence, setEvidence] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState(CTL_STATUSES[0]);
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/security/controls`, { method: "POST", body: JSON.stringify({ control: control.trim(), framework, evidence: evidence.trim(), owner: owner.trim(), status, description: description.trim() }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security", projectId] }); onClose(); },
  });
  const submit = () => { if (control.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={500} label="Add a control">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Record a control and its evidence in the register.</div>
      <DecLabel>Control</DecLabel>
      <Input value={control} onChange={(e) => setControl(e.target.value)} placeholder="e.g. A.8.24 Use of cryptography" style={{ marginBottom: 14 }} />
      <DecLabel>Description</DecLabel>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the control does and how it's met" style={{ minHeight: 52, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <DecLabel>Framework</DecLabel>
          <Select value={framework} onChange={(e) => setFramework(e.target.value)}>
            {FRAMEWORK_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {CTL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>
      <DecLabel>Evidence</DecLabel>
      <Textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="What demonstrates this control is in place?" style={{ minHeight: 56, resize: "vertical", marginBottom: 14 }} />
      <DecLabel>Owner</DecLabel>
      <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Control owner" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !control.trim()}>{create.isPending ? "Adding…" : "Add control"}</Button>
      </div>
    </Modal>
  );
}

// ---- Epics -----------------------------------------------------------------
interface EpicRef { id: number; name: string; }
interface EpicItem { id: number; name: string; stories: number; done: number; pct: number; status: string; dependsOn: string; deps: EpicRef[]; }
const EPIC_STATUS: Record<string, { ink: string; tint: string; bar: string }> = {
  Complete:      { ink: "#0B6B37", tint: "#E7F4EC", bar: "#15A34A" },
  "In progress": { ink: "#0C5798", tint: "#E6EFFB", bar: "#0F6CBD" },
  Upcoming:      { ink: "#56607A", tint: "#EEF1F6", bar: "#8A93A6" },
  "At risk":     { ink: "#8A6300", tint: "#FBF2D7", bar: "#E0A100" },
};
const EPIC_STATUSES = ["Complete", "In progress", "Upcoming", "At risk"];

function Epics({ projectId }: { projectId: string | null }) {
  const [modal, setModal] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data } = useQuery({
    queryKey: ["epics", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; epics: EpicItem[]; canCreate?: boolean }> =>
      (await api<{ canEdit: boolean; epics: EpicItem[]; canCreate?: boolean }>(`/projects/${projectId}/epics`)) ?? { canEdit: false, epics: [] },
  });
  const epics = data?.epics ?? [];
  const canEdit = data?.canEdit ?? false;
  const canCreate = data?.canCreate ?? false;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its epics." /></Card>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Epics group the delivery stories for this project.</div>
        <div style={{ flex: 1 }} />
        <Button onClick={() => setModal(true)} disabled={!canCreate} title={canCreate ? undefined : "Your role can't create epics (needs the Project schedule right)"}><Icon name="plus" size={16} /> New epic</Button>
      </div>
      {epics.length === 0 ? (
        <Card><EmptyBlock minHeight={180} message="No epics yet." /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {epics.map((e) => {
            const sc = EPIC_STATUS[e.status] ?? EPIC_STATUS.Upcoming;
            const depLabel = e.deps.length > 0 ? `↳ after ${e.deps.map((d) => d.name).join(", ")}` : (e.dependsOn ? `↳ after ${e.dependsOn}` : "No dependencies");
            return (
              <button key={e.id} onClick={() => setOpenId(e.id)}
                style={{ textAlign: "left", background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 20, cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: color.text }}>{e.name}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 10px", borderRadius: 20 }}>{e.status}</span>
                </div>
                <div style={{ height: 9, background: color.bg, borderRadius: 5, overflow: "hidden", marginBottom: 9 }}>
                  <div style={{ height: "100%", width: `${e.pct}%`, background: sc.bar, borderRadius: 5 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: color.faint }}>
                  <span>{e.done} of {e.stories} stories done</span>
                  <span style={{ fontFamily: font.head, fontWeight: 700, color: color.ink }}>{e.pct}%</span>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F2F4F9", display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "#7A6BB0" }}>
                  <Icon name="link" size={14} /><span>{depLabel}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {modal && <EpicModal projectId={projectId} epics={epics} onClose={() => setModal(false)} />}
      {openId !== null && (() => {
        const e = epics.find((x) => x.id === openId);
        if (!e) return null;
        return <EpicModal projectId={projectId} epic={e} epics={epics} canEdit={canEdit} onClose={() => setOpenId(null)} />;
      })()}
    </div>
  );
}

function EpicModal({ projectId, epic, epics, canEdit = true, onClose }: { projectId: string; epic?: EpicItem; epics: EpicItem[]; canEdit?: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(epic?.name ?? "");
  const [stories, setStories] = useState(String(epic?.stories ?? ""));
  const [done, setDone] = useState(String(epic?.done ?? ""));
  const [status, setStatus] = useState(epic?.status ?? "Upcoming");
  const [dependsOn, setDependsOn] = useState(epic?.dependsOn ?? "");
  const [depIds, setDepIds] = useState<number[]>(epic?.deps.map((d) => d.id) ?? []);
  const [confirmDel, setConfirmDel] = useState(false);
  const readOnly = !!epic && !canEdit;

  // An epic can depend on any other epic (not itself).
  const candidates = epics.filter((e) => e.id !== epic?.id);
  const toggleDep = (id: number) => setDepIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

  const body = () => JSON.stringify({
    name: name.trim(), stories: Number(stories) || 0, done: Number(done) || 0, status,
    dependsOn: dependsOn.trim(), dependsOnIds: depIds,
  });
  const save = useMutation({
    mutationFn: () => epic
      ? api(`/epics/${epic.id}`, { method: "PATCH", body: body() })
      : api(`/projects/${projectId}/epics`, { method: "POST", body: body() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epics", projectId] }); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/epics/${epic!.id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epics", projectId] }); onClose(); },
    onError: (e) => toastError(e),
  });
  // Tasks referencing this epic (linked by name), shown when viewing an epic.
  const { data: taskData } = useQuery({
    queryKey: ["tasks", projectId], enabled: !!projectId && !!epic, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ tasks: Task[] }> => (await api<{ tasks: Task[] }>(`/projects/${projectId}/tasks`)) ?? { tasks: [] },
  });
  const epicTasks = (taskData?.tasks ?? []).filter((t) => epic && t.epic === epic.name);

  return (
    <Modal onClose={onClose} width={480} label={epic ? "Epic" : "New epic"}>
      {!epic && <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Group a set of delivery stories under an epic.</div>}
      <DecLabel>Epic name</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} placeholder="e.g. Checkout & Payments" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Stories</DecLabel><Input type="number" min={0} value={stories} onChange={(e) => setStories(e.target.value)} disabled={readOnly} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>Done</DecLabel><Input type="number" min={0} value={done} onChange={(e) => setDone(e.target.value)} disabled={readOnly} placeholder="0" /></div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={readOnly}>{EPIC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        </div>
      </div>
      <DecLabel>Depends on</DecLabel>
      {candidates.length === 0 ? (
        <div style={{ fontSize: 12, color: color.faint3, marginBottom: 12 }}>No other epics to depend on yet.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
          {candidates.map((c) => {
            const on = depIds.includes(c.id);
            return (
              <button key={c.id} type="button" disabled={readOnly} onClick={() => toggleDep(c.id)}
                style={{ fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: readOnly ? "default" : "pointer", padding: "5px 11px", borderRadius: 20, border: `1px solid ${on ? "#7A6BB0" : color.border}`, background: on ? "#F0E8F7" : "#fff", color: on ? "#5E2E89" : color.faint }}>
                {on ? "✓ " : ""}{c.name}
              </button>
            );
          })}
        </div>
      )}
      <DecLabel>Dependency note (optional)</DecLabel>
      <Input value={dependsOn} onChange={(e) => setDependsOn(e.target.value)} disabled={readOnly} placeholder="e.g. external vendor sign-off" />

      {epic && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${color.bg}` }}>
          <DecLabel>Tasks in this epic ({epicTasks.length})</DecLabel>
          {epicTasks.length === 0 ? (
            <div style={{ fontSize: 12, color: color.faint3 }}>No tasks reference this epic yet. Set a task's epic to “{epic.name}” to link it.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
              {epicTasks.map((t) => <SprintTaskRow key={t.id} t={t} />)}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22 }}>
        {epic && canEdit && (
          confirmDel ? (
            <>
              <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this epic?</span>
              <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
              <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete epic</button>
          )
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</Button>
        {!readOnly && <Button onClick={() => { if (name.trim()) save.mutate(); }} disabled={save.isPending || !name.trim()}>{save.isPending ? "Saving…" : epic ? "Save changes" : "Add epic"}</Button>}
      </div>
    </Modal>
  );
}

// ---- Artifacts -------------------------------------------------------------
interface ArtifactVersion { id: number; version: number; fileName: string; size: number; uploadedAt: string; }
interface ArtifactItem { id: number; name: string; type: string; owner: string; status: string; versions: ArtifactVersion[]; }
const ARTIFACT_TYPES = ["Governance", "Waterfall", "Agile", "Design", "Test", "Other"];
const ARTIFACT_STATUSES = ["Draft", "In review", "Approved", "Living"];
const ARTIFACT_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved:    { ink: "#0B6B37", tint: "#E7F4EC" },
  "In review": { ink: "#8A6300", tint: "#FBF2D7" },
  Living:      { ink: "#0C5798", tint: "#E6EFFB" },
  Draft:       { ink: "#56607A", tint: "#EEF1F6" },
};
const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

function Artifacts({ projectId }: { projectId: string | null }) {
  const [modal, setModal] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data } = useQuery({
    queryKey: ["artifacts", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; artifacts: ArtifactItem[] }> =>
      (await api<{ canEdit: boolean; artifacts: ArtifactItem[] }>(`/projects/${projectId}/artifacts`)) ?? { canEdit: false, artifacts: [] },
  });
  const artifacts = data?.artifacts ?? [];
  const canEdit = data?.canEdit ?? false;
  const open = artifacts.find((a) => a.id === openId) ?? null;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its artifacts." /></Card>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Waterfall &amp; agile artifacts — each carries its own file versions.</div>
        <div style={{ flex: 1 }} />
        <Button onClick={() => setModal(true)} disabled={!canEdit} title={canEdit ? undefined : "Your role can't add artifacts (needs Edit on “Comments & artifacts”)"}><Icon name="plus" size={16} /> New artifact</Button>
      </div>
      <Card padding={0} style={{ overflow: "hidden" }}>
        {artifacts.length === 0 ? (
          <EmptyBlock message="No artifacts yet." minHeight={140} />
        ) : artifacts.map((a) => {
          const sc = ARTIFACT_STATUS[a.status] ?? ARTIFACT_STATUS.Draft;
          return (
            <div key={a.id} onClick={() => setOpenId(a.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", borderBottom: "1px solid #F2F4F9", cursor: "pointer" }}>
              <span style={{ color: color.primary, display: "flex" }}><Icon name="sheet" size={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: color.text }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: color.faint3 }}>{a.type} · Owner {a.owner}</div>
              </div>
              <span style={{ fontSize: 12, color: color.faint }}>{a.versions.length ? `${a.versions.length} version${a.versions.length > 1 ? "s" : ""}` : "No file yet"}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 11px", borderRadius: 20 }}>{a.status}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: color.primary }}><Icon name="externalLink" size={15} /> Open</span>
            </div>
          );
        })}
      </Card>
      {modal && <NewArtifactModal projectId={projectId} onClose={() => setModal(false)} />}
      {open && <ArtifactWindow projectId={projectId} artifact={open} canEdit={canEdit} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function NewArtifactModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState(ARTIFACT_TYPES[0]);
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("Draft");
  const [file, setFile] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const art = await api<{ id: number }>(`/projects/${projectId}/artifacts`, { method: "POST", body: JSON.stringify({ name: name.trim(), type, owner: owner.trim(), status }) });
      if (art?.id && file) { const fd = new FormData(); fd.append("file", file); await apiUpload(`/artifacts/${art.id}/versions`, fd); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["artifacts", projectId] }); onClose(); },
  });
  const submit = () => { if (name.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={480} label="New artifact">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Register a document; attach its first file version now or later.</div>
      <DecLabel>Name</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Solution Architecture (SAD)" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Type</DecLabel><Select value={type} onChange={(e) => setType(e.target.value)}>{ARTIFACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{ARTIFACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <DecLabel>Owner</DecLabel>
      <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Document owner" style={{ marginBottom: 14 }} />
      <DecLabel>First version (optional)</DecLabel>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5, color: color.subtle }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !name.trim()}>{create.isPending ? "Saving…" : "Create artifact"}</Button>
      </div>
    </Modal>
  );
}

function ArtifactWindow({ projectId, artifact, canEdit, onClose }: { projectId: string; artifact: ArtifactItem; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const sc = ARTIFACT_STATUS[artifact.status] ?? ARTIFACT_STATUS.Draft;
  const upload = useMutation({
    mutationFn: async (file: File) => { const fd = new FormData(); fd.append("file", file); await apiUpload(`/artifacts/${artifact.id}/versions`, fd); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["artifacts", projectId] }),
  });
  const changeStatus = useMutation({
    mutationFn: (status: string) => api(`/artifacts/${artifact.id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["artifacts", projectId] }),
  });

  return (
    <Modal onClose={onClose} width={560} label={artifact.name}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: color.faint3 }}>{artifact.type} · Owner {artifact.owner}</span>
        <span style={{ flex: 1 }} />
        {canEdit ? (
          <Select
            value={artifact.status}
            disabled={changeStatus.isPending}
            onChange={(e) => changeStatus.mutate(e.target.value)}
            style={{ width: "auto", fontSize: 12, fontWeight: 600, color: sc.ink, background: sc.tint, borderColor: "transparent", padding: "4px 8px" }}
          >
            {ARTIFACT_STATUSES.map((s) => <option key={s} value={s} style={{ color: color.ink, background: "#fff" }}>{s}</option>)}
          </Select>
        ) : (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 11px", borderRadius: 20 }}>{artifact.status}</span>
        )}
      </div>
      <div style={{ fontFamily: font.head, fontSize: 14, fontWeight: 600, color: color.ink, margin: "18px 0 10px" }}>Versions</div>
      {artifact.versions.length === 0 ? (
        <div style={{ fontSize: 12.5, color: color.faint3, padding: "14px 0" }}>No file versions uploaded yet.</div>
      ) : (
        <div style={{ border: `1px solid ${color.border}`, borderRadius: 12, overflow: "hidden" }}>
          {artifact.versions.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: "1px solid #F2F4F9" }}>
              <span style={{ fontFamily: font.mono, fontSize: 11.5, fontWeight: 700, color: color.primary, background: color.primaryTint, padding: "2px 8px", borderRadius: 6 }}>v{v.version}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: color.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.fileName}</div>
                <div style={{ fontSize: 11, color: color.faint3 }}>{fmtSize(v.size)} · {v.uploadedAt}</div>
              </div>
              <button onClick={() => apiDownload(`/artifact-versions/${v.id}`, v.fileName)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: color.primary, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Icon name="download" size={15} /> Download</button>
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <label style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 14, fontSize: 12.5, fontWeight: 600, color: color.primary, background: "#EAF2FB", border: `1px solid ${color.border}`, borderRadius: 8, padding: "8px 13px", cursor: upload.isPending ? "default" : "pointer" }}>
          <Icon name="paperclip" size={15} /> {upload.isPending ? "Uploading…" : "Upload new version"}
          <input type="file" style={{ display: "none" }} disabled={upload.isPending} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
        </label>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

// ---- Requirements & traceability -------------------------------------------
interface ReqAttachment { id: number; fileName: string; size: number; uploadedAt: string; }
interface Requirement { id: number; code: string; title: string; type: string; priority: string; status: string; epic: string; story: string; test: string; testStatus: string; release: string; verified: boolean; description: string; attachments: ReqAttachment[]; }
interface ChangeRequest { id: number; code: string; title: string; reqCode: string; impact: string; sdp: string; status: string; raisedBy: string; date: string; }
interface ReqData { canEdit: boolean; stats: { total: number; approved: number; coverage: number; verified: number }; requirements: Requirement[]; changeRequests: ChangeRequest[]; }

const REQ_TYPES = ["Functional", "Non-functional", "Compliance"];
const REQ_STATUSES = ["Draft", "In review", "Approved", "Replaced", "Archived", "Retired (Requester)", "Retired (PM)", "Retired (Team)"];
const REQ_PRIORITIES = ["Critical", "High", "Medium", "Low"];
const TEST_RESULTS = ["Not run", "In test", "Passed", "Failed"];
const CR_IMPACTS = ["Low", "Medium", "High"];
const REQ_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: "#0B6B37", tint: "#E7F4EC" }, "In review": { ink: "#0C5798", tint: "#E6EFFB" }, Draft: { ink: "#56607A", tint: "#EEF1F6" },
  Replaced: { ink: "#5E2E89", tint: "#F0E8F7" }, Archived: { ink: "#56607A", tint: "#EEF1F6" },
  "Retired (Requester)": { ink: "#8A6300", tint: "#FBF2D7" }, "Retired (PM)": { ink: "#8A6300", tint: "#FBF2D7" }, "Retired (Team)": { ink: "#8A6300", tint: "#FBF2D7" },
};
const TEST_STATUS: Record<string, { ink: string; tint: string }> = {
  Passed: { ink: "#0B6B37", tint: "#E7F4EC" }, "In test": { ink: "#0C5798", tint: "#E6EFFB" }, Failed: { ink: "#A1282B", tint: "#FBE7E8" }, "Not run": { ink: "#56607A", tint: "#EEF1F6" },
};
const CR_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: "#0B6B37", tint: "#E7F4EC" }, Pending: { ink: "#8A6300", tint: "#FBF2D7" }, Rejected: { ink: "#A1282B", tint: "#FBE7E8" },
};
const REQ_COLS = "2.4fr 1fr 1.1fr 0.9fr 1fr 1fr 60px";
const CR_COLS = "0.7fr 2.2fr 0.9fr 0.8fr 1fr 0.9fr 1fr";

function Requirements({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const [reqModal, setReqModal] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [crFor, setCrFor] = useState<string | null>(null); // req code prefill, or "" for blank
  const [openCr, setOpenCr] = useState<ChangeRequest | null>(null);
  const { data } = useQuery({
    queryKey: ["requirements", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<ReqData | null> => await api<ReqData>(`/projects/${projectId}/requirements`),
  });
  const setResult = useMutation({
    mutationFn: (v: { id: number; testStatus: string }) => api(`/requirements/${v.id}`, { method: "PATCH", body: JSON.stringify({ testStatus: v.testStatus }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requirements", projectId] }),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its requirements." /></Card>;
  if (!data) return <Card><EmptyBlock minHeight={220} message="Loading requirements…" /></Card>;

  const { stats, requirements, changeRequests, canEdit } = data;
  const statCards: [string, number | string, string][] = [
    ["Requirements", stats.total, color.ink], ["Approved", stats.approved, "#0B6B37"],
    ["Test coverage", `${stats.coverage}%`, "#0F6CBD"], ["Verified", stats.verified, color.ink],
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13, marginBottom: 16 }}>
        {statCards.map(([label, value, ink]) => (
          <div key={label} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: "#7B849A" }}>{label}</div>
            <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: ink, marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* traceability matrix */}
      <Card padding={0} style={{ overflow: "hidden", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 22px 13px" }}>
          <div style={{ flex: 1 }}>
            <div style={sectionTitleS}>Traceability matrix</div>
            <div style={{ fontSize: 12, color: color.faint2 }}>Requirement → epic / story → test → release</div>
          </div>
          {canEdit && <Button onClick={() => setReqModal(true)}><Icon name="plus" size={16} /> New requirement</Button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: REQ_COLS, padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Requirement</div><div>Status</div><div>Epic / Story</div><div>Test</div><div>Result</div><div>Release</div><div />
        </div>
        {requirements.length === 0 ? (
          <EmptyBlock message="No requirements yet." minHeight={120} />
        ) : requirements.map((r) => {
          const sc = REQ_STATUS[r.status] ?? REQ_STATUS.Draft;
          const tc = TEST_STATUS[r.testStatus] ?? TEST_STATUS["Not run"];
          return (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: REQ_COLS, alignItems: "center", padding: "13px 22px", borderBottom: "1px solid #F2F4F9" }}>
              <div style={{ minWidth: 0 }}>
                <button onClick={() => setOpenId(r.id)} style={{ fontSize: 13.5, fontWeight: 600, color: color.primary, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>{r.title}</button>
                <div style={{ fontSize: 11, color: color.faint3, fontFamily: font.mono, display: "flex", alignItems: "center", gap: 6 }}>{r.code} · {r.type} · {r.priority}{r.attachments.length > 0 && <span title={`${r.attachments.length} attachment(s)`} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}><Icon name="paperclip" size={11} />{r.attachments.length}</span>}</div>
              </div>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 9px", borderRadius: 6 }}>{r.status}</span></div>
              <div style={{ fontSize: 12, color: color.subtle }}>{r.epic || "—"}<div style={{ fontSize: 11, color: color.faint3, fontFamily: font.mono }}>{r.story}</div></div>
              <div style={{ fontSize: 12, color: color.subtle, fontFamily: font.mono }}>{r.test}</div>
              <div>
                <select value={r.testStatus} disabled={!canEdit} onChange={(e) => setResult.mutate({ id: r.id, testStatus: e.target.value })}
                  style={{ fontSize: 11, fontWeight: 600, color: tc.ink, background: tc.tint, border: "none", borderRadius: 20, padding: "3px 8px", fontFamily: "inherit", cursor: canEdit ? "pointer" : "default" }}>
                  {TEST_RESULTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: color.subtle }}>{r.release}</div>
              <div style={{ textAlign: "right" }}>
                {canEdit && <button onClick={() => setCrFor(r.code)} title="Raise change request" style={{ fontSize: 10.5, fontWeight: 600, color: color.primary, background: "#EAF2FB", border: `1px solid ${color.border}`, padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>CR</button>}
              </div>
            </div>
          );
        })}
      </Card>

      {/* change requests */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 22px 13px" }}>
          <div style={{ flex: 1 }}>
            <div style={sectionTitleS}>Change requests</div>
            <div style={{ fontSize: 12, color: color.faint2 }}>Scope changes against requirements · PMO approval workflow</div>
          </div>
          {canEdit && <Button onClick={() => setCrFor("")}><Icon name="plus" size={16} /> Raise CR</Button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: CR_COLS, padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>ID</div><div>Change</div><div>Requirement</div><div>Impact</div><div>SDP change</div><div>Raised by</div><div>Status</div>
        </div>
        {changeRequests.length === 0 ? (
          <EmptyBlock message="No change requests raised yet." minHeight={110} />
        ) : changeRequests.map((c) => {
          const sc = CR_STATUS[c.status] ?? CR_STATUS.Pending;
          return (
            <div key={c.id} onClick={() => canEdit && setOpenCr(c)} style={{ display: "grid", gridTemplateColumns: CR_COLS, alignItems: "center", padding: "13px 22px", borderBottom: "1px solid #F2F4F9", cursor: canEdit ? "pointer" : "default" }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, color: color.faint3 }}>{c.code}</div>
              <div style={{ fontSize: 13, color: canEdit ? color.primary : color.text, fontWeight: 600 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: color.subtle, fontFamily: font.mono }}>{c.reqCode || "—"}</div>
              <div style={{ fontSize: 12, color: color.subtle }}>{c.impact}</div>
              <div style={{ fontSize: 12, color: color.subtle, fontFamily: font.mono }}>{c.sdp || "—"}</div>
              <div style={{ fontSize: 12, color: color.subtle }}>{c.raisedBy}</div>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 9px", borderRadius: 6 }}>{c.status}</span></div>
            </div>
          );
        })}
      </Card>

      {reqModal && <NewRequirementModal projectId={projectId} onClose={() => setReqModal(false)} />}
      {openId !== null && (() => {
        const r = requirements.find((x) => x.id === openId);
        if (!r) return null;
        return <RequirementModal projectId={projectId} req={r} canEdit={canEdit} onClose={() => setOpenId(null)} />;
      })()}
      {crFor !== null && <RaiseCrModal projectId={projectId} reqCodes={requirements.map((r) => r.code)} prefill={crFor} onClose={() => setCrFor(null)} />}
      {openCr && <EditCrModal projectId={projectId} cr={openCr} reqCodes={requirements.map((r) => r.code)} onClose={() => setOpenCr(null)} />}
    </div>
  );
}

function EditCrModal({ projectId, cr, reqCodes, onClose }: { projectId: string; cr: ChangeRequest; reqCodes: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(cr.title);
  const [reqCode, setReqCode] = useState(cr.reqCode);
  const [impact, setImpact] = useState(cr.impact);
  const [sdp, setSdp] = useState(cr.sdp);
  const [status, setStatus] = useState(cr.status);
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["requirements", projectId] });
  const save = useMutation({
    mutationFn: () => api(`/change-requests/${cr.id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim(), reqCode, impact, sdp: sdp.trim(), status }) }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/change-requests/${cr.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  return (
    <Modal onClose={onClose} width={480} label={`${cr.code} · Change request`}>
      <DecLabel>Change</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is changing?" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <DecLabel>Requirement</DecLabel>
          <Select value={reqCode} onChange={(e) => setReqCode(e.target.value)}>
            <option value="">—</option>
            {reqCodes.map((rc) => <option key={rc} value={rc}>{rc}</option>)}
            {reqCode && !reqCodes.includes(reqCode) && <option value={reqCode}>{reqCode}</option>}
          </Select>
        </div>
        <div style={{ flex: 1 }}><DecLabel>Impact</DecLabel><Select value={impact} onChange={(e) => setImpact(e.target.value)}>{CR_IMPACTS.map((i) => <option key={i}>{i}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{["Pending", "Approved", "Rejected"].map((s) => <option key={s}>{s}</option>)}</Select></div>
      </div>
      <DecLabel>SDP change (optional)</DecLabel>
      <Input value={sdp} onChange={(e) => setSdp(e.target.value)} placeholder="e.g. SDP-48213" />
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this CR?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}

function NewRequirementModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", type: REQ_TYPES[0], priority: "Medium", status: "Draft", epic: "", story: "", test: "", release: "", description: "" });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/requirements`, { method: "POST", body: JSON.stringify({ ...f, title: f.title.trim() }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["requirements", projectId] }); onClose(); },
  });
  return (
    <Modal onClose={onClose} width={520} label="New requirement">
      <DecLabel>Requirement</DecLabel>
      <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="What must the solution do?" style={{ marginBottom: 14 }} />
      <DecLabel>Description</DecLabel>
      <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Acceptance criteria, context, notes…" style={{ minHeight: 64, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Type</DecLabel><Select value={f.type} onChange={(e) => set("type", e.target.value)}>{REQ_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Priority</DecLabel><Select value={f.priority} onChange={(e) => set("priority", e.target.value)}>{REQ_PRIORITIES.map((t) => <option key={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{REQ_STATUSES.map((t) => <option key={t}>{t}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Epic</DecLabel><Input value={f.epic} onChange={(e) => set("epic", e.target.value)} placeholder="Epic" /></div>
        <div style={{ flex: 1 }}><DecLabel>Story</DecLabel><Input value={f.story} onChange={(e) => set("story", e.target.value)} placeholder="e.g. CHK-204" /></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Test</DecLabel><Input value={f.test} onChange={(e) => set("test", e.target.value)} placeholder="e.g. TC-118" /></div>
        <div style={{ flex: 1 }}><DecLabel>Release</DecLabel><Input value={f.release} onChange={(e) => set("release", e.target.value)} placeholder="e.g. R2.0 · Aug" /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => f.title.trim() && create.mutate()} disabled={create.isPending || !f.title.trim()}>{create.isPending ? "Adding…" : "Add requirement"}</Button>
      </div>
    </Modal>
  );
}

function RequirementModal({ projectId, req, canEdit, onClose }: { projectId: string; req: Requirement; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(req.title);
  const [description, setDescription] = useState(req.description);
  const [type, setType] = useState(req.type);
  const [priority, setPriority] = useState(req.priority);
  const [status, setStatus] = useState(req.status);
  const [epic, setEpic] = useState(req.epic);
  const [story, setStory] = useState(req.story);
  const [test, setTest] = useState(req.test === "—" ? "" : req.test);
  const [release, setRelease] = useState(req.release);
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["requirements", projectId] });

  const save = useMutation({
    mutationFn: () => api(`/requirements/${req.id}`, { method: "PATCH", body: JSON.stringify({
      title: title.trim(), description: description.trim(), type, priority, status,
      epic: epic.trim(), story: story.trim(), test: test.trim(), release: release.trim(),
    }) }),
    onSuccess: () => { invalidate(); toast("Requirement saved"); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/requirements/${req.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast("Requirement deleted"); onClose(); },
    onError: (e) => toastError(e),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => { const fd = new FormData(); fd.append("file", file); await apiUpload(`/requirements/${req.id}/attachments`, fd); },
    onSuccess: () => invalidate(),
    onError: (e) => toastError(e),
  });
  const removeAtt = useMutation({
    mutationFn: (attId: number) => api(`/requirement-attachments/${attId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
    onError: (e) => toastError(e),
  });

  return (
    <Modal onClose={onClose} width={560} label={`${req.code} · Requirement`}>
      <DecLabel>Requirement</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} placeholder="What must the solution do?" style={{ marginBottom: 14 }} />
      <DecLabel>Description</DecLabel>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} placeholder="Acceptance criteria, context, notes…" style={{ minHeight: 72, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Type</DecLabel><Select value={type} onChange={(e) => setType(e.target.value)} disabled={!canEdit}>{REQ_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Priority</DecLabel><Select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!canEdit}>{REQ_PRIORITIES.map((t) => <option key={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit}>{REQ_STATUSES.map((t) => <option key={t}>{t}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Epic</DecLabel><Input value={epic} onChange={(e) => setEpic(e.target.value)} disabled={!canEdit} placeholder="Epic" /></div>
        <div style={{ flex: 1 }}><DecLabel>Story</DecLabel><Input value={story} onChange={(e) => setStory(e.target.value)} disabled={!canEdit} placeholder="e.g. CHK-204" /></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Test</DecLabel><Input value={test} onChange={(e) => setTest(e.target.value)} disabled={!canEdit} placeholder="e.g. TC-118" /></div>
        <div style={{ flex: 1 }}><DecLabel>Release</DecLabel><Input value={release} onChange={(e) => setRelease(e.target.value)} disabled={!canEdit} placeholder="e.g. R2.0 · Aug" /></div>
      </div>

      {/* Attachments */}
      <div style={{ borderTop: `1px solid ${color.bg}`, marginTop: 18, paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: color.ink }}>Attachments</span>
          <div style={{ flex: 1 }} />
          {canEdit && (
            <>
              <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={upload.isPending}><Icon name="paperclip" size={15} /> {upload.isPending ? "Uploading…" : "Attach file"}</Button>
            </>
          )}
        </div>
        {req.attachments.length === 0 ? (
          <div style={{ fontSize: 12, color: color.faint3 }}>No attachments.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {req.attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", border: `1px solid ${color.border}`, borderRadius: 9 }}>
                <Icon name="paperclip" size={15} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.fileName}</div>
                  <div style={{ fontSize: 11, color: color.faint3 }}>{fmtSize(a.size)} · {a.uploadedAt}</div>
                </div>
                <button onClick={() => apiDownload(`/requirement-attachments/${a.id}`, a.fileName)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: color.primary, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Icon name="download" size={14} /> Download</button>
                {canEdit && <button onClick={() => removeAtt.mutate(a.id)} title="Remove attachment" style={{ display: "inline-flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "#A1282B" }}><Icon name="trash" size={14} /></button>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22 }}>
        {canEdit && (
          confirmDel ? (
            <>
              <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this requirement?</span>
              <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
              <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete requirement</button>
          )
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>{canEdit ? "Cancel" : "Close"}</Button>
        {canEdit && <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>}
      </div>
    </Modal>
  );
}

function RaiseCrModal({ projectId, reqCodes, prefill, onClose }: { projectId: string; reqCodes: string[]; prefill: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [reqCode, setReqCode] = useState(prefill || reqCodes[0] || "");
  const [impact, setImpact] = useState("Medium");
  const [sdp, setSdp] = useState("");
  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/change-requests`, { method: "POST", body: JSON.stringify({ title: title.trim(), reqCode, impact, sdp: sdp.trim() }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["requirements", projectId] }); onClose(); },
  });
  return (
    <Modal onClose={onClose} width={480} label="Raise change request">
      <DecLabel>Change</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is changing?" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <DecLabel>Requirement</DecLabel>
          <Select value={reqCode} onChange={(e) => setReqCode(e.target.value)}>
            <option value="">—</option>
            {reqCodes.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div style={{ flex: 1 }}><DecLabel>Impact</DecLabel><Select value={impact} onChange={(e) => setImpact(e.target.value)}>{CR_IMPACTS.map((i) => <option key={i}>{i}</option>)}</Select></div>
      </div>
      <DecLabel>SDP change (optional)</DecLabel>
      <Input value={sdp} onChange={(e) => setSdp(e.target.value)} placeholder="e.g. SDP-48213" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => title.trim() && create.mutate()} disabled={create.isPending || !title.trim()}>{create.isPending ? "Raising…" : "Raise CR"}</Button>
      </div>
    </Modal>
  );
}

const sectionTitleS: React.CSSProperties = { fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink };

// ---- Architecture (TOGAF ADM) ----------------------------------------------
interface AdmPhase { id: number; code: string; phase: string; focus: string; owner: string; artefact: string; status: string; }
interface ArchApproval { id: number; role: string; decision: string; decidedBy: string; decidedAt: string; note: string; }
interface ArchData { canEdit: boolean; changeType: string; phases: AdmPhase[]; approvals: ArchApproval[]; arbStatus: string; }

const CHANGE_TYPES: [string, string][] = [
  ["", "— Select change type —"], ["config", "Configuration change"], ["small-enhancement", "Small enhancement"],
  ["new-integration", "New integration"], ["new-saas", "New SaaS / vendor platform"], ["business-app", "New business application"],
  ["new-product", "New product / platform"], ["core-replacement", "Core system replacement"], ["payment", "Payment / cardholder data impact"],
  ["ai-solution", "AI solution"], ["cloud-platform", "Cloud landing zone / platform"],
];
const GOV_LEVEL: Record<string, string> = {
  config: "No formal ADM", "small-enhancement": "ADM-lite (impact assessment)", "new-integration": "Architecture review required",
  "new-saas": "Full multi-domain review (arch+security+data+vendor)", "business-app": "ADM-lite or full ADM (by criticality)",
  "new-product": "Full ADM", "core-replacement": "Full ADM (strongly recommended)", payment: "Full ADM + mandatory PCI/security review",
  "ai-solution": "Full ADM + AI/data/legal governance", "cloud-platform": "Full ADM (technology/security)",
};
const ADM_STATUSES = ["Not started", "Draft", "In progress", "In review", "Approved"];
const ADM_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: "#0B6B37", tint: "#E7F4EC" }, "In review": { ink: "#8A6300", tint: "#FBF2D7" },
  "In progress": { ink: "#0C5798", tint: "#E6EFFB" }, Draft: { ink: "#5E2E89", tint: "#F0E8F7" }, "Not started": { ink: "#56607A", tint: "#EEF1F6" },
};
const ADM_COLS = "1.6fr 1.4fr 1.1fr 1.2fr 0.9fr";

// ARB decision → label + colour, and overall board status → colour.
const ARB_DECISION: Record<string, { label: string; ink: string; tint: string }> = {
  pending: { label: "Pending", ink: "#56607A", tint: "#EEF1F6" },
  approved: { label: "Approved", ink: "#0B6B37", tint: "#E7F4EC" },
  conditions: { label: "With conditions", ink: "#0C5798", tint: "#E6EFFB" },
  rejected: { label: "Rejected", ink: "#A1282B", tint: "#FBE7E8" },
};
const ARB_OVERALL: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: "#0B6B37", tint: "#E7F4EC" }, "Approved with conditions": { ink: "#0C5798", tint: "#E6EFFB" },
  Rejected: { ink: "#A1282B", tint: "#FBE7E8" }, "In review": { ink: "#8A6300", tint: "#FBF2D7" },
  Pending: { ink: "#56607A", tint: "#EEF1F6" }, "Not started": { ink: "#56607A", tint: "#EEF1F6" },
};

function Architecture({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["architecture", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<ArchData | null> => await api<ArchData>(`/projects/${projectId}/architecture`),
  });
  const setType = useMutation({
    mutationFn: (changeType: string) => api(`/projects/${projectId}/architecture`, { method: "PATCH", body: JSON.stringify({ changeType }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["architecture", projectId] }),
  });
  const cycle = useMutation({
    mutationFn: (v: { id: number; status: string }) => api(`/adm-phases/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: v.status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["architecture", projectId] }),
  });
  const decide = useMutation({
    mutationFn: (v: { id: number; decision: string; note?: string }) => api(`/arch-approvals/${v.id}`, { method: "PATCH", body: JSON.stringify({ decision: v.decision, note: v.note ?? "" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["architecture", projectId] }),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its architecture governance." /></Card>;
  if (!data) return <Card><EmptyBlock minHeight={220} message="Loading architecture governance…" /></Card>;

  const { changeType, phases, canEdit, approvals = [], arbStatus = "Not started" } = data;
  const level = GOV_LEVEL[changeType] ?? "Architecture triage required";
  const full = level.startsWith("Full");
  const arbOverall = ARB_OVERALL[arbStatus] ?? ARB_OVERALL["Not started"];
  const signedOff = approvals.filter((a) => a.decision !== "pending").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Architecture triage, tailored TOGAF ADM &amp; phase governance.</div>
        <div style={{ flex: 1 }} />
        {canEdit && <span style={{ fontSize: 11, fontWeight: 600, color: "#5E2E89", background: "#F0E8F7", padding: "4px 10px", borderRadius: 6 }}>Chief Architect controls enabled</span>}
      </div>

      {/* triage / impact assessment */}
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={sectionTitleS}>Architecture impact assessment</div>
            <div style={{ fontSize: 12, color: color.faint2 }}>Every initiative is triaged; governance depth is tailored to change type.</div>
          </div>
          <div style={{ minWidth: 240 }}>
            <Select value={changeType} disabled={!canEdit} onChange={(e) => setType.mutate(e.target.value)}>
              {CHANGE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F5F0FA", border: "1px solid #E4D7F0", borderRadius: 10, padding: "12px 15px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#5E2E89", textTransform: "uppercase", letterSpacing: "0.04em" }}>Required governance</span>
          <span style={{ fontFamily: font.head, fontSize: 14, fontWeight: 700, color: "#3B1A5C" }}>{level}</span>
          {full && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#A1282B", background: "#FBE7E8", padding: "3px 9px", borderRadius: 6 }}>Architecture-significant</span>}
        </div>
      </Card>

      {/* ADM phase tracker */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px 13px", ...sectionTitleS }}>TOGAF ADM phase tracker</div>
        <div style={{ display: "grid", gridTemplateColumns: ADM_COLS, padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Phase</div><div>Focus</div><div>Owner</div><div>Key artefact</div><div>Status</div>
        </div>
        {phases.map((p) => {
          const sc = ADM_STATUS[p.status] ?? ADM_STATUS["Not started"];
          const next = ADM_STATUSES[(ADM_STATUSES.indexOf(p.status) + 1) % ADM_STATUSES.length];
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: ADM_COLS, alignItems: "center", padding: "12px 22px", borderBottom: "1px solid #F2F4F9" }}>
              <div style={{ fontSize: 13, color: color.text, fontWeight: 600 }}>{p.phase}</div>
              <div style={{ fontSize: 12, color: color.faint }}>{p.focus}</div>
              <div style={{ fontSize: 12, color: color.subtle }}>{p.owner}</div>
              <div style={{ fontSize: 12, color: color.faint }}>{p.artefact}</div>
              <div>
                <button onClick={() => canEdit && cycle.mutate({ id: p.id, status: next })} disabled={!canEdit || cycle.isPending}
                  title={canEdit ? "Click to advance status" : undefined}
                  style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "4px 10px", borderRadius: 6, border: "none", cursor: canEdit ? "pointer" : "default", fontFamily: "inherit" }}>{p.status}</button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Architecture Review Board — independent per-role sign-offs */}
      <Card padding={0} style={{ overflow: "hidden", marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px 6px" }}>
          <span style={{ ...sectionTitleS, flex: 1 }}>Architecture Review Board</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: arbOverall.ink, background: arbOverall.tint, padding: "5px 12px", borderRadius: 20 }}>{arbStatus}</span>
        </div>
        <div style={{ padding: "0 22px 12px", fontSize: 11.5, color: color.faint2, lineHeight: 1.45 }}>
          Each sign-off is an independent approval by an architecture role. ARB — not the PMO — owns architectural correctness; the overall verdict is the roll-up of every role's decision. <b style={{ color: color.text }}>{signedOff}/{approvals.length}</b> recorded.
        </div>
        {approvals.map((a) => {
          const dc = ARB_DECISION[a.decision] ?? ARB_DECISION.pending;
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderTop: "1px solid #F2F4F9" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{a.role}</div>
                <div style={{ fontSize: 11.5, color: color.faint3 }}>
                  {a.decision === "pending" ? "Awaiting sign-off" : `${a.decidedBy || "—"} · ${a.decidedAt || "—"}`}
                  {a.note ? ` · ${a.note}` : ""}
                </div>
              </div>
              {canEdit ? (
                <select value={a.decision} onChange={(e) => {
                  const decision = e.target.value;
                  const note = decision === "conditions" || decision === "rejected"
                    ? (window.prompt(decision === "rejected" ? "Reason for rejection (optional):" : "Conditions to attach (optional):", a.note) ?? "")
                    : "";
                  decide.mutate({ id: a.id, decision, note });
                }}
                  style={{ fontSize: 11.5, fontWeight: 700, color: dc.ink, background: dc.tint, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="conditions">With conditions</option>
                  <option value="rejected">Rejected</option>
                </select>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, color: dc.ink, background: dc.tint, padding: "4px 10px", borderRadius: 6 }}>{dc.label}</span>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ---- Detect Risks + Draft Status Report ------------------------------------
interface RiskFinding { severity: string; category: string; title: string; detail: string; framework: string; control: string; }
interface RiskReport { high: number; medium: number; low: number; findings: RiskFinding[]; }
interface StatusReport { name: string; phase: string; health: string; progress: number; budgetLine: string; tasksDone: number; tasksTotal: number; blocked: number; spillover: number; passRate: number; openDefects: number; gatesApproved: number; gatesTotal: number; dpiaLevel: string; highlights: string[]; topRisks: RiskFinding[]; }

const RISK_SEV: Record<string, { ink: string; tint: string }> = {
  High: { ink: "#A1282B", tint: "#FBE7E8" }, Medium: { ink: "#8A6300", tint: "#FBF2D7" }, Low: { ink: "#56607A", tint: "#EEF1F6" },
};
const FRAMEWORK_TINT: Record<string, { ink: string; tint: string }> = {
  "ISO 27001": { ink: "#0C5798", tint: "#E6EFFB" }, "ISO 42001": { ink: "#5E2E89", tint: "#F0E8F7" },
  GDPR: { ink: "#0B6B37", tint: "#E7F4EC" }, "PCI-DSS": { ink: "#A1282B", tint: "#FBE7E8" },
  "MITRE ATT&CK": { ink: "#8A6300", tint: "#FBF2D7" }, "PMO governance": { ink: "#56607A", tint: "#EEF1F6" },
};

function RiskRow({ r }: { r: RiskFinding }) {
  const sc = RISK_SEV[r.severity] ?? RISK_SEV.Low;
  const fc = FRAMEWORK_TINT[r.framework] ?? FRAMEWORK_TINT["PMO governance"];
  return (
    <div style={{ padding: "12px 0", borderTop: "1px solid #F2F4F9" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "2px 8px", borderRadius: 6 }}>{r.severity}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{r.title}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: color.faint3 }}>{r.category}</span>
      </div>
      <div style={{ fontSize: 12, color: color.faint, lineHeight: 1.45, marginBottom: 6 }}>{r.detail}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: fc.ink, background: fc.tint, padding: "2px 8px", borderRadius: 6 }}>{r.framework}</span>
        <span style={{ fontSize: 11, color: color.faint3, fontFamily: font.mono }}>{r.control}</span>
      </div>
    </div>
  );
}

function RisksModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["risks", projectId], retry: false, staleTime: 15_000,
    queryFn: async (): Promise<RiskReport> => (await api<RiskReport>(`/projects/${projectId}/risks`)) ?? { high: 0, medium: 0, low: 0, findings: [] },
  });
  const findings = data?.findings ?? [];
  return (
    <Modal onClose={onClose} width={560} label="Detected risks">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 12 }}>Deterministic scan of live project data — each finding maps to a standard/control.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        {(["High", "Medium", "Low"] as const).map((s) => {
          const sc = RISK_SEV[s]; const n = s === "High" ? data?.high : s === "Medium" ? data?.medium : data?.low;
          return <span key={s} style={{ fontSize: 11.5, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "4px 11px", borderRadius: 20 }}>{n ?? 0} {s}</span>;
        })}
      </div>
      {findings.length === 0 ? (
        <div style={{ padding: "26px 0", textAlign: "center", fontSize: 13, color: color.faint3 }}>No risks detected from the current project data. 🎉</div>
      ) : findings.map((r, i) => <RiskRow key={i} r={r} />)}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><Button variant="secondary" onClick={onClose}>Close</Button></div>
    </Modal>
  );
}

function StatusReportModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { data: r } = useQuery({
    queryKey: ["status-report", projectId], retry: false, staleTime: 15_000,
    queryFn: async (): Promise<StatusReport | null> => await api<StatusReport>(`/projects/${projectId}/status-report`),
  });
  const copy = () => { if (r) navigator.clipboard?.writeText(`${r.name} — status report\n\n${r.highlights.join("\n")}`).catch(() => {}); };
  return (
    <Modal onClose={onClose} width={560} label="Status report">
      {!r ? <EmptyBlock message="Generating…" minHeight={120} /> : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>{r.name}</div>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: color.subtle, background: color.bg, padding: "3px 10px", borderRadius: 20 }}>{r.health}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: color.faint3 }}>{r.phase} · {r.progress}%</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
            {[["Budget", r.budgetLine], ["Tasks", `${r.tasksDone}/${r.tasksTotal}`], ["Pass rate", `${r.passRate}%`], ["Open defects", `${r.openDefects}`]].map(([l, v]) => (
              <div key={l} style={{ background: color.bg, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10.5, color: color.faint3 }}>{l}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: color.text, fontFamily: font.mono }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: font.head, fontSize: 13, fontWeight: 600, color: color.ink, marginBottom: 6 }}>Summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
            {r.highlights.map((h, i) => <div key={i} style={{ display: "flex", gap: 7, fontSize: 12.5, color: color.text }}><span style={{ color: color.primary }}>•</span><span>{h}</span></div>)}
          </div>
          {r.topRisks.length > 0 && (
            <>
              <div style={{ fontFamily: font.head, fontSize: 13, fontWeight: 600, color: color.ink }}>Top risks</div>
              {r.topRisks.map((x, i) => <RiskRow key={i} r={x} />)}
            </>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 16 }}>
            <Button variant="secondary" onClick={copy}><Icon name="paperclip" size={15} /> Copy</Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---- Quality (test plans & defects) ----------------------------------------
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

function Quality({ projectId }: { projectId: string | null }) {
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
interface DepLink { id: string; name: string; dept: string; status: string; health: string; }
interface DepData { canEdit: boolean; dependsOn: DepLink[]; blocks: DepLink[]; inheritedRisk: boolean; ownHealth: string; effHealth: string; depRiskTitle: string; }
const STATUS_PILL: Record<string, { ink: string; tint: string; dot: string }> = {
  green: { ink: "#0B6B37", tint: "#E7F4EC", dot: "#15A34A" },
  amber: { ink: "#8A6300", tint: "#FBF2D7", dot: "#E0A100" },
  red:   { ink: "#A1282B", tint: "#FBE7E8", dot: "#D13438" },
  hold:  { ink: "#56607A", tint: "#EEF1F6", dot: "#8A93A6" },
};

function Dependencies({ projectId }: { projectId: string | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const { data } = useQuery({
    queryKey: ["dependencies", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<DepData | null> => await api<DepData>(`/projects/${projectId}/dependencies`),
  });
  const unlink = useMutation({
    mutationFn: (depId: string) => api(`/projects/${projectId}/dependencies/${depId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dependencies", projectId] }),
    onError: (e) => toastError(e),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its dependencies." /></Card>;
  if (!data) return <Card><EmptyBlock minHeight={220} message="Loading dependencies…" /></Card>;

  const { dependsOn, blocks, inheritedRisk, ownHealth, effHealth, depRiskTitle, canEdit } = data;
  const openProject = (pid: string) => navigate(`${SCREENS.project.path}?id=${pid}`);

  const column = (title: string, icon: React.ReactNode, links: DepLink[], empty: string, unlinkable = false) => (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderBottom: `1px solid ${color.bg}` }}>
        {icon}<span style={{ fontFamily: font.head, fontSize: 14, fontWeight: 600, color: color.ink }}>{title}</span>
      </div>
      {links.length === 0 ? (
        <div style={{ padding: "22px 18px", textAlign: "center", fontSize: 12.5, color: color.faint3 }}>{empty}</div>
      ) : links.map((d) => {
        const sc = STATUS_PILL[d.status] ?? STATUS_PILL.green;
        return (
          <div key={d.id} onClick={() => openProject(d.id)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 18px", borderBottom: "1px solid #F4F6FA", cursor: "pointer" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: sc.dot, flex: "none" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{d.name}</div>
              <div style={{ fontSize: 11, color: color.faint3, fontFamily: font.mono }}>{d.id} · {d.dept}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 9px", borderRadius: 6 }}>{d.health}</span>
            {unlinkable && canEdit && (
              <button onClick={(e) => { e.stopPropagation(); if (confirm(`Unlink dependency on “${d.name}”?`)) unlink.mutate(d.id); }}
                title="Remove dependency" style={{ display: "inline-flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "#A1282B", flex: "none" }}>
                <Icon name="trash" size={15} />
              </button>
            )}
          </div>
        );
      })}
    </Card>
  );

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ fontSize: 13.5, color: color.faint, marginBottom: 16 }}>Cross-project links for this project. Task &amp; epic dependencies are shown on their own tabs.</div>
      {inheritedRisk && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "#FBF6E8", border: "1px solid #F0E2BC", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <span style={{ color: "#8A6300", display: "flex", marginTop: 1 }}><Icon name="alert" size={18} /></span>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "#5A4A1F" }}>
            <b>Aggregated status: {effHealth}.</b> This project's own health is <b>{ownHealth}</b>, but it inherits risk from a dependency — {depRiskTitle}. Resolve the upstream item to clear the rollup.
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {column("Depends on", <span style={{ color: "#C98A00", display: "flex" }}><Icon name="arrowRight" size={16} /></span>, dependsOn, "No upstream dependencies.", true)}
        {column("Blocks / enables", <span style={{ color: color.primary, display: "flex", transform: "rotate(180deg)" }}><Icon name="arrowRight" size={16} /></span>, blocks, "Nothing depends on this project.")}
      </div>
      {canEdit && (
        <button onClick={() => setModal(true)} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: color.primary, background: color.surface, border: `1px solid ${color.border}`, padding: "9px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>
          <Icon name="plus" size={16} /> Link a project
        </button>
      )}
      {modal && <LinkProjectModal projectId={projectId} existing={dependsOn.map((d) => d.id)} onClose={() => setModal(false)} />}
    </div>
  );
}

function LinkProjectModal({ projectId, existing, onClose }: { projectId: string; existing: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<{ id: string; name: string }[]> => (await api<{ id: string; name: string }[]>("/projects")) ?? [],
  });
  const options = projects.filter((p) => p.id !== projectId && !existing.includes(p.id));
  const [dependsOnId, setDependsOnId] = useState("");
  const link = useMutation({
    mutationFn: () => api(`/projects/${projectId}/dependencies`, { method: "POST", body: JSON.stringify({ dependsOnId }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dependencies", projectId] }); onClose(); },
  });
  return (
    <Modal onClose={onClose} width={440} label="Link a project">
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>This project will depend on the one you choose; its risk rolls up here.</div>
      <DecLabel>Depends on</DecLabel>
      <Select value={dependsOnId} onChange={(e) => setDependsOnId(e.target.value)}>
        <option value="">{options.length ? "Select a project" : "No other projects available"}</option>
        {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => dependsOnId && link.mutate()} disabled={link.isPending || !dependsOnId}>{link.isPending ? "Linking…" : "Link project"}</Button>
      </div>
    </Modal>
  );
}

// ---- Blockers (per-project view of the portfolio blocker register) ---------
interface ProjBlocker { id: string; title: string; projectId: string; projectName: string; owner: string; status: string; description: string; }
const BLK_STATUSES = ["Active", "In progress", "Resolved", "Cancelled", "Archived"];
const BLK_STATUS_COLOR: Record<string, { ink: string; tint: string; dot: string }> = {
  Active:        { ink: "#A1282B", tint: "#FBE7E8", dot: "#D13438" },
  "In progress": { ink: "#8A6300", tint: "#FBF2D7", dot: "#E0A100" },
  Resolved:      { ink: "#0B6B37", tint: "#E7F4EC", dot: "#15A34A" },
  Cancelled:     { ink: "#56607A", tint: "#EEF1F6", dot: "#8A93A6" },
  Archived:      { ink: "#5E2E89", tint: "#F0E8F7", dot: "#7A6BB0" },
};

function ProjectBlockers({ projectId }: { projectId: string | null }) {
  const [modal, setModal] = useState(false);
  const [open, setOpen] = useState<ProjBlocker | null>(null);
  const { data } = useQuery({
    queryKey: ["project-blockers", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; blockers: ProjBlocker[] }> =>
      (await api<{ canEdit: boolean; blockers: ProjBlocker[] }>(`/projects/${projectId}/blockers`)) ?? { canEdit: false, blockers: [] },
  });
  const blockers = data?.blockers ?? [];
  const canEdit = data?.canEdit ?? false;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its blockers." /></Card>;

  const openCount = blockers.filter((b) => b.status === "Active" || b.status === "In progress").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Impediments raised against this project{openCount > 0 ? ` · ${openCount} open` : ""}.</div>
        <div style={{ flex: 1 }} />
        <Button onClick={() => setModal(true)} disabled={!canEdit} title={canEdit ? undefined : "Your role can't raise blockers (needs Edit on “Projects & tasks”)"}><Icon name="plus" size={16} /> Raise blocker</Button>
      </div>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.6fr 2.6fr 0.9fr 0.9fr", padding: "13px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>ID</div><div>Blocker</div><div>Owner</div><div>Status</div>
        </div>
        {blockers.length === 0 ? (
          <EmptyBlock message="No blockers on this project." minHeight={130} />
        ) : blockers.map((b) => {
          const sc = BLK_STATUS_COLOR[b.status] ?? BLK_STATUS_COLOR.Active;
          return (
            <div key={b.id} onClick={() => canEdit && setOpen(b)} style={{ display: "grid", gridTemplateColumns: "0.6fr 2.6fr 0.9fr 0.9fr", alignItems: "center", padding: "13px 22px", borderBottom: "1px solid #F2F4F9", cursor: canEdit ? "pointer" : "default" }}>
              <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint3 }}>{b.id}</div>
              <div style={{ paddingRight: 12, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: color.text }}>{b.title}</div>
                {b.description && <div style={{ fontSize: 11.5, color: color.faint3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{b.description}</div>}
              </div>
              <div style={{ fontSize: 12.5, color: color.textMuted }}>{b.owner}</div>
              <div><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 10px", borderRadius: 20 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />{b.status}</span></div>
            </div>
          );
        })}
      </Card>
      {modal && <ProjectBlockerModal projectId={projectId} onClose={() => setModal(false)} />}
      {open && <ProjectBlockerModal projectId={projectId} blocker={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ProjectBlockerModal({ projectId, blocker, onClose }: { projectId: string; blocker?: ProjBlocker; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(blocker?.title ?? "");
  const [description, setDescription] = useState(blocker?.description ?? "");
  const [owner, setOwner] = useState(blocker?.owner ?? "");
  const [status, setStatus] = useState(blocker?.status ?? "Active");
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project-blockers", projectId] });
    qc.invalidateQueries({ queryKey: ["blockers"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };
  const save = useMutation({
    mutationFn: () => blocker
      ? api(`/blockers/${blocker.id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim(), description: description.trim(), owner: owner.trim(), status }) })
      : api(`/blockers`, { method: "POST", body: JSON.stringify({ title: title.trim(), description: description.trim(), owner: owner.trim(), status, projectId }) }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/blockers/${blocker!.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });

  return (
    <Modal onClose={onClose} width={480} label={blocker ? `${blocker.id} · Blocker` : "Raise a blocker"}>
      <DecLabel>Title</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" style={{ marginBottom: 14 }} />
      <DecLabel>Description</DecLabel>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is blocking progress?" style={{ minHeight: 72, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Owner</DecLabel><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" /></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{BLK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {blocker && (confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this blocker?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        ))}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : blocker ? "Save changes" : "Raise blocker"}</Button>
      </div>
    </Modal>
  );
}

// ---- Vacations (team absence calendar) -------------------------------------
interface Absence { id: number; person: string; from: string; to: string; type: string; }
const ABSENCE_TYPES: [string, string, string][] = [["vacation", "Vacation", "#0F6CBD"], ["sick", "Sick", "#D13438"], ["training", "Training", "#7A3FB0"]];
const ABSENCE_COLOR: Record<string, string> = { vacation: "#0F6CBD", sick: "#D13438", training: "#7A3FB0" };
const VAC_MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WIN_START = Date.UTC(2026, 6, 1), WIN_END = Date.UTC(2026, 11, 31);
const WIN_DAYS = Math.round((WIN_END - WIN_START) / 864e5) + 1;
const vpct = (iso: string) => {
  const t = Date.parse(iso);
  return Math.max(0, Math.min(100, (t - WIN_START) / 864e5 / WIN_DAYS * 100));
};

function Vacations({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["vacations", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; absences: Absence[] }> =>
      (await api<{ canEdit: boolean; absences: Absence[] }>(`/projects/${projectId}/vacations`)) ?? { canEdit: false, absences: [] },
  });
  const [person, setPerson] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("vacation");
  const add = useMutation({
    mutationFn: () => api(`/projects/${projectId}/vacations`, { method: "POST", body: JSON.stringify({ person: person.trim(), from, to, type }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vacations", projectId] }); setPerson(""); setFrom(""); setTo(""); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/vacations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vacations", projectId] }),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its team vacations." /></Card>;
  const absences = data?.absences ?? [];
  const canEdit = data?.canEdit ?? false;
  const people = Array.from(new Set(absences.map((a) => a.person)));
  const fmtRange = (a: Absence) => `${a.from} → ${a.to}`;

  return (
    <Card>
      <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, marginBottom: 4 }}>Team vacations</div>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>Jul–Dec 2026 · absences for resources assigned to this project. Plan allocations around these.</div>

      {/* calendar */}
      <div style={{ border: `1px solid ${color.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", borderBottom: "1px solid #EEF1F6" }}>
          <div style={{ padding: "8px 14px", fontSize: 10.5, color: color.faint3, textTransform: "uppercase", fontWeight: 600 }}>Resource</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)" }}>
            {VAC_MONTHS.map((m) => <div key={m} style={{ padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#7B849A", borderLeft: "1px solid #F4F6FA" }}>{m}</div>)}
          </div>
        </div>
        {people.length === 0 ? (
          <div style={{ padding: "26px 14px", textAlign: "center", fontSize: 12.5, color: color.faint3 }}>No absences logged for this project yet.</div>
        ) : people.map((name) => (
          <div key={name} style={{ display: "grid", gridTemplateColumns: "160px 1fr", borderBottom: "1px solid #F4F6FA", alignItems: "center" }}>
            <div style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
            <div style={{ position: "relative", height: 30, backgroundImage: "linear-gradient(90deg,#F4F6FA 1px,transparent 1px)", backgroundSize: "16.666% 100%" }}>
              {absences.filter((a) => a.person === name).map((a) => {
                const left = vpct(a.from), w = Math.max(1.5, vpct(a.to) - left);
                return <div key={a.id} title={`${name} · ${a.type} · ${a.from}→${a.to}`} style={{ position: "absolute", left: `${left}%`, width: `${w}%`, top: 7, height: 16, borderRadius: 5, background: ABSENCE_COLOR[a.type] ?? "#0F6CBD", opacity: 0.9 }} />;
              })}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 14, padding: "10px 14px", flexWrap: "wrap" }}>
          {ABSENCE_TYPES.map(([, label, c]) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: color.subtle }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{label}
            </span>
          ))}
        </div>
      </div>

      {/* add absence */}
      {canEdit && (
        <div style={{ background: "#F8FAFD", border: "1px solid #EEF1F6", borderRadius: 12, padding: "14px 16px", marginTop: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: color.ink, marginBottom: 10 }}>Add an absence</div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
            <Input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Resource name" style={{ width: 180 }} />
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ border: `1px solid ${color.border2}`, borderRadius: 7, padding: "6px 9px", fontSize: 12, fontFamily: "inherit", color: color.textMuted }} />
            <span style={{ fontSize: 12, color: color.faint3 }}>to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ border: `1px solid ${color.border2}`, borderRadius: 7, padding: "6px 9px", fontSize: 12, fontFamily: "inherit", color: color.textMuted }} />
            <div style={{ width: 130 }}><Select value={type} onChange={(e) => setType(e.target.value)}>{ABSENCE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
            <Button onClick={() => { if (person.trim() && from && to) add.mutate(); }} disabled={add.isPending || !person.trim() || !from || !to}>Add</Button>
          </div>
          {absences.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              {absences.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: color.textMuted }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: ABSENCE_COLOR[a.type] ?? "#0F6CBD", flex: "none" }} />
                  <span style={{ flex: 1 }}>{a.person} · {ABSENCE_TYPES.find((t) => t[0] === a.type)?.[1] ?? a.type} <span style={{ color: color.faint3 }}>({fmtRange(a)})</span></span>
                  <button onClick={() => remove.mutate(a.id)} disabled={remove.isPending} style={{ fontSize: 11, fontWeight: 600, color: color.danger, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---- Ways of working — methodology-specific ceremonies, artifacts & roles ---
interface WowItem { label: string; detail: string; }
interface WaysOfWorkingData { methodology: string; cadence: string; summary: string; ceremonies: WowItem[]; artifacts: string[]; roles: string[]; canEdit?: boolean; }

const WOW_UPPER: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#56607A", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 9 };

function WaysOfWorking({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["wow", projectId], enabled: !!projectId, retry: false, staleTime: 60_000,
    queryFn: async (): Promise<WaysOfWorkingData | null> => {
      try { return await api<WaysOfWorkingData>(`/projects/${projectId}/ways-of-working`); } catch { return null; }
    },
  });
  const [draft, setDraft] = useState<WaysOfWorkingData | null>(null);
  const save = useMutation({
    mutationFn: (d: WaysOfWorkingData) => api(`/projects/${projectId}/ways-of-working`, {
      method: "PATCH",
      body: JSON.stringify({ cadence: d.cadence, summary: d.summary, ceremonies: d.ceremonies, artifacts: d.artifacts, roles: d.roles }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wow", projectId] }); setDraft(null); },
    onError: (e) => toast((e as Error).message, "error"),
  });

  if (!projectId || !data) return null;
  const chip = (t: string, ink: string, tint: string) => (
    <span key={t} style={{ fontSize: 11.5, fontWeight: 600, color: ink, background: tint, padding: "3px 10px", borderRadius: 20 }}>{t}</span>
  );

  if (draft) return <WowEditor draft={draft} setDraft={setDraft} onSave={() => save.mutate(draft)} onCancel={() => setDraft(null)} saving={save.isPending} />;

  return (
    <Card padding={22}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <SectionTitle>Ways of working</SectionTitle>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0C5798", background: "#E6EFFB", padding: "3px 10px", borderRadius: 20 }}>{data.methodology}</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: color.textMuted, background: color.bg, padding: "3px 10px", borderRadius: 20 }}>{data.cadence}</span>
        {data.canEdit && <button onClick={() => setDraft({ ...data, ceremonies: data.ceremonies.map((c) => ({ ...c })), artifacts: [...data.artifacts], roles: [...data.roles] })} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: color.primary, background: color.primaryTint, border: "1px solid #CFE0F4", borderRadius: 8, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit" }}><Icon name="edit" size={14} /> Edit</button>}
      </div>
      <div style={{ fontSize: 12.5, color: color.faint2, lineHeight: 1.5, marginBottom: 16 }}>{data.summary}</div>

      <div style={WOW_UPPER}>Ceremonies &amp; cadences</div>
      <div style={{ border: `1px solid ${color.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        {data.ceremonies.map((c, i) => (
          <div key={c.label + i} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "10px 13px", borderBottom: i < data.ceremonies.length - 1 ? "1px solid #F4F6FA" : "none" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0F6CBD", marginTop: 6, flex: "none" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{c.label}</div>
              <div style={{ fontSize: 12, color: color.faint2, lineHeight: 1.45 }}>{c.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={WOW_UPPER}>Key artifacts</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{data.artifacts.map((a) => chip(a, "#6A2E9E", "#F0E8F7"))}</div>
        </div>
        <div>
          <div style={WOW_UPPER}>Roles</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{data.roles.map((r) => chip(r, "#0B6B37", "#E7F4EC"))}</div>
        </div>
      </div>
    </Card>
  );
}

function WowEditor({ draft, setDraft, onSave, onCancel, saving }: {
  draft: WaysOfWorkingData; setDraft: (d: WaysOfWorkingData) => void; onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  const set = (patch: Partial<WaysOfWorkingData>) => setDraft({ ...draft, ...patch });
  const editChips = (label: string, list: string[], key: "artifacts" | "roles", ink: string, tint: string) => (
    <div>
      <div style={WOW_UPPER}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
        {list.map((t, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: ink, background: tint, padding: "3px 6px 3px 10px", borderRadius: 20 }}>
            {t}<button onClick={() => set({ [key]: list.filter((_, j) => j !== i) } as Partial<WaysOfWorkingData>)} style={{ border: "none", background: "transparent", color: ink, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
          </span>
        ))}
      </div>
      <AddChip onAdd={(v) => set({ [key]: [...list, v] } as Partial<WaysOfWorkingData>)} />
    </div>
  );
  return (
    <Card padding={22}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <SectionTitle>Edit ways of working</SectionTitle>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 14 }}>
        <div><div style={WOW_UPPER}>Cadence</div><Input value={draft.cadence} onChange={(e) => set({ cadence: e.target.value })} /></div>
        <div><div style={WOW_UPPER}>Summary</div><Input value={draft.summary} onChange={(e) => set({ summary: e.target.value })} /></div>
      </div>

      <div style={WOW_UPPER}>Ceremonies &amp; cadences</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {draft.ceremonies.map((c, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 28px", gap: 8, alignItems: "center" }}>
            <Input value={c.label} placeholder="Ceremony" onChange={(e) => set({ ceremonies: draft.ceremonies.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
            <Input value={c.detail} placeholder="What happens" onChange={(e) => set({ ceremonies: draft.ceremonies.map((x, j) => j === i ? { ...x, detail: e.target.value } : x) })} />
            <button onClick={() => set({ ceremonies: draft.ceremonies.filter((_, j) => j !== i) })} title="Remove" style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${color.border3}`, background: "#fff", color: color.faint3, cursor: "pointer", fontSize: 14 }}>×</button>
          </div>
        ))}
      </div>
      <button onClick={() => set({ ceremonies: [...draft.ceremonies, { label: "", detail: "" }] })} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.primary, background: color.primaryTint, border: "1px solid #CFE0F4", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}><Icon name="plus" size={14} /> Add ceremony</button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {editChips("Key artifacts", draft.artifacts, "artifacts", "#6A2E9E", "#F0E8F7")}
        {editChips("Roles", draft.roles, "roles", "#0B6B37", "#E7F4EC")}
      </div>
    </Card>
  );
}

function AddChip({ onAdd }: { onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  const add = () => { if (v.trim()) { onAdd(v.trim()); setV(""); } };
  return (
    <div style={{ display: "flex", gap: 7 }}>
      <Input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Add…" style={{ padding: "6px 9px", fontSize: 12 }} />
      <Button variant="secondary" onClick={add} style={{ padding: "6px 12px" }}>Add</Button>
    </div>
  );
}

// ---- Communication plan — per-stakeholder channel / type / cadence ---------
interface CommEntry { id: number; stakeholder: string; channel: string; commType: string; schedule: string; owner: string; notes: string; }
const COMM_CHANNELS = ["Email", "Teams", "Meeting", "Report", "Slack", "Call"];
const COMM_TYPES = ["Status update", "Steering", "Escalation", "Newsletter", "Review", "Ad-hoc"];
const COMM_SCHEDULES = ["Daily", "Weekly", "Bi-weekly", "Monthly", "Quarterly", "Ad-hoc"];

// Operational load impacting this project — run-the-business ops work tagged to
// it (from the Ops module) that pulls capacity off delivery. Shown only when
// there's at least one active impacting item, so it stays quiet otherwise.
interface OpsImpactRow { id: number; title: string; serviceName: string; type: string; priority: string; status: string; assignee: string; alloc: number; impactNote: string; }
function OpsImpactPanel({ projectId }: { projectId: string | null }) {
  const { data } = useQuery({
    queryKey: ["ops-impact", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ alloc: number; items: OpsImpactRow[] }> =>
      (await api<{ alloc: number; items: OpsImpactRow[] }>(`/projects/${projectId}/ops-impact`)) ?? { alloc: 0, items: [] },
  });
  const items = data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${color.bg}` }}>
        <Icon name="activity" size={17} color={color.warningAlt} />
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Operational load</div>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#8A6300", background: "#FBF2D7", borderRadius: 6, padding: "2px 8px" }}>{data?.alloc ?? 0}% capacity</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: color.faint2 }}>{items.length} item{items.length === 1 ? "" : "s"} pulling capacity off delivery</span>
      </div>
      <div>
        {items.map((i) => (
          <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", borderBottom: "1px solid #F4F6FA" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{i.title}</div>
              <div style={{ fontSize: 11, color: color.faint2, marginTop: 1 }}>
                {i.serviceName} · {i.type} · {i.assignee}{i.impactNote ? ` · ${i.impactNote}` : ""}
              </div>
            </div>
            <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.warningAlt }}>{i.alloc}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CommunicationPlan({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["comms", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; entries: CommEntry[] }> =>
      (await api<{ canEdit: boolean; entries: CommEntry[] }>(`/projects/${projectId}/comms`)) ?? { canEdit: false, entries: [] },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["comms", projectId] });
  const add = useMutation({
    mutationFn: (body: Partial<CommEntry>) => api(`/projects/${projectId}/comms`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<CommEntry> }) => api(`/comms/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/comms/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const [stakeholder, setStakeholder] = useState("");
  const [channel, setChannel] = useState(COMM_CHANNELS[0]);
  const [commType, setCommType] = useState(COMM_TYPES[0]);
  const [schedule, setSchedule] = useState(COMM_SCHEDULES[1]);
  const [owner, setOwner] = useState("");

  if (!projectId) return null;
  const entries = data?.entries ?? [];
  const canEdit = data?.canEdit ?? false;
  const GRID = canEdit ? "1.4fr 1fr 1.2fr 1fr 1fr 32px" : "1.4fr 1fr 1.2fr 1fr 1fr";

  const submit = () => {
    if (!stakeholder.trim()) return;
    add.mutate({ stakeholder: stakeholder.trim(), channel, commType, schedule, owner: owner.trim() });
    setStakeholder(""); setOwner("");
  };

  return (
    <Card padding={22}>
      <SectionTitle>Communication plan</SectionTitle>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 16 }}>Who is kept informed, through which channel and on what cadence.</div>

      <div style={{ border: `1px solid ${color.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "10px 14px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Stakeholder</div><div>Channel</div><div>Type</div><div>Schedule</div><div>Owner</div>{canEdit && <div />}
        </div>
        {entries.length === 0 ? (
          <div style={{ padding: "26px 14px", textAlign: "center", fontSize: 12.5, color: color.faint3 }}>
            {canEdit ? "No communication entries yet. Add stakeholders below." : "No communication plan defined yet."}
          </div>
        ) : entries.map((e) => (
          <CommRow key={e.id} entry={e} canEdit={canEdit} grid={GRID}
            onPatch={(body) => patch.mutate({ id: e.id, body })} onRemove={() => remove.mutate(e.id)} />
        ))}
      </div>

      {canEdit && (
        <div style={{ background: "#F8FAFD", border: "1px solid #EEF1F6", borderRadius: 12, padding: "14px 16px", marginTop: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: color.ink, marginBottom: 10 }}>Add a communication</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1.2fr 1fr", gap: 9, marginBottom: 9 }}>
            <Input value={stakeholder} onChange={(e) => setStakeholder(e.target.value)} placeholder="Stakeholder / group" />
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>{COMM_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
            <Select value={commType} onChange={(e) => setCommType(e.target.value)}>{COMM_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
            <Select value={schedule} onChange={(e) => setSchedule(e.target.value)}>{COMM_SCHEDULES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Responsible owner" style={{ flex: 1 }} />
            <Button onClick={submit} disabled={add.isPending || !stakeholder.trim()}>{add.isPending ? "Adding…" : "Add"}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// A communication-plan row. When editable, fields commit to the server on
// change (selects) / blur (text). Local state is seeded once from the entry.
function CommRow({ entry, canEdit, grid, onPatch, onRemove }: {
  entry: CommEntry; canEdit: boolean; grid: string;
  onPatch: (body: Partial<CommEntry>) => void; onRemove: () => void;
}) {
  const [stakeholder, setStakeholder] = useState(entry.stakeholder);
  const [owner, setOwner] = useState(entry.owner);
  const cellSelect: React.CSSProperties = { border: "none", background: "transparent", fontSize: 12.5, fontFamily: "inherit", color: color.text, cursor: "pointer", outline: "none", width: "100%" };
  const cellInput: React.CSSProperties = { border: "none", background: "transparent", fontSize: 12.5, fontFamily: "inherit", color: color.text, outline: "none", width: "100%" };
  if (!canEdit) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: grid, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid #F4F6FA", fontSize: 12.5, color: color.text }}>
        <div style={{ fontWeight: 600 }}>{entry.stakeholder}</div>
        <div>{entry.channel}</div><div>{entry.commType}</div><div>{entry.schedule}</div><div>{entry.owner || "—"}</div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: grid, alignItems: "center", padding: "8px 14px", borderBottom: "1px solid #F4F6FA" }}>
      <input value={stakeholder} onChange={(e) => setStakeholder(e.target.value)} onBlur={() => stakeholder !== entry.stakeholder && onPatch({ stakeholder })} style={{ ...cellInput, fontWeight: 600 }} />
      <select value={entry.channel} onChange={(e) => onPatch({ channel: e.target.value })} style={cellSelect}>{COMM_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      <select value={entry.commType} onChange={(e) => onPatch({ commType: e.target.value })} style={cellSelect}>{COMM_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      <select value={entry.schedule} onChange={(e) => onPatch({ schedule: e.target.value })} style={cellSelect}>{COMM_SCHEDULES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      <input value={owner} onChange={(e) => setOwner(e.target.value)} onBlur={() => owner !== entry.owner && onPatch({ owner })} placeholder="—" style={cellInput} />
      <button onClick={onRemove} title="Remove" style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${color.border3}`, background: "#fff", color: color.faint3, cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink, marginBottom: 12 }}>{children}</div>;
}
function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}
