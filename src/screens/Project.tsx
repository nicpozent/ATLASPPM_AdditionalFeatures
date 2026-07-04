import { useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api, apiUpload, apiDownload } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, ProgressBar, Button, Modal, Input, Select, Textarea } from "@/components/ui";
import { SCREENS } from "@/nav";

// ---- data (empty until API exists) -----------------------------------------
interface ProjectDetail {
  id: string; name: string; dept: string; owner: string; methodology: string;
  status: string; health: string; progress: number; phase: string;
  budget: number; spent: number; due: string;
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
  ["overview", "Overview"], ["tasks", "Tasks"], ["epics", "Epics"], ["requirements", "Requirements"],
  ["quality", "Quality"], ["governance", "Governance"], ["architecture", "Architecture"],
  ["security", "Security & Privacy"], ["dependencies", "Dependencies"], ["vacations", "Vacations"],
  ["artifacts", "Artifacts"], ["raid", "RAID Log"], ["comments", "Comments"],
] as const;
type TabId = (typeof TABS)[number][0];

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

export default function Project() {
  const [params] = useSearchParams();
  const id = params.get("id");
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("overview");
  const { data: p } = useProject(id);

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
          <Meta label="Target"><span style={{ fontSize: 15, fontWeight: 600, color: color.text }}>{dash(p?.due)}</span></Meta>
        </div>
      </Card>

      {/* tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${color.border3}`, marginBottom: 20, overflowX: "auto" }}>
        {TABS.map(([tid, label]) => {
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
      {tab === "governance" && <Governance projectId={id} />}
      {tab === "raid" && <Raid projectId={id} />}
      {tab === "security" && <Security projectId={id} />}
      {tab === "epics" && <Epics projectId={id} />}
      {tab === "artifacts" && <Artifacts projectId={id} />}
      {tab === "requirements" && <Requirements projectId={id} />}
      {tab === "architecture" && <Architecture projectId={id} />}
      {tab === "quality" && <Quality projectId={id} />}
      {tab === "dependencies" && <Dependencies projectId={id} />}
      {tab === "vacations" && <Vacations projectId={id} />}
      {tab === "comments" && <Comments />}
    </div>
  );
}

function Overview({ projectId }: { projectId: string | null }) {
  const [modal, setModal] = useState<null | "risks" | "report">(null);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <PeopleRoles projectId={projectId} />
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
        <Card padding={22}><SectionTitle>Summary</SectionTitle><EmptyBlock message="No project summary yet." minHeight={70} /></Card>
        <Card padding={22}><SectionTitle>Epic progress</SectionTitle><EmptyBlock message="No epics tracked yet." minHeight={80} /></Card>
        <Card padding={22}><SectionTitle>Stakeholder matrix · power / interest</SectionTitle><EmptyBlock message="No stakeholders mapped yet." minHeight={120} /></Card>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments", projectId] }),
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

interface Task { id: number; code: string; name: string; epic: string; assignee: string; status: string; sprint: string; baseline: string; priority: string; }

function Tasks({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"board" | "table">("board");
  const [modal, setModal] = useState(false);
  const dragId = useRef<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["tasks", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; tasks: Task[] }> =>
      (await api<{ canEdit: boolean; tasks: Task[] }>(`/projects/${projectId}/tasks`)) ?? { canEdit: false, tasks: [] },
  });
  const move = useMutation({
    mutationFn: (v: { id: number; status: string }) => api(`/tasks/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: v.status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });

  const tasks = data?.tasks ?? [];
  const canEdit = data?.canEdit ?? false;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its tasks." /></Card>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2 }}>
          {(["board", "table"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "6px 15px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", textTransform: "capitalize", background: view === v ? "#fff" : "transparent", color: view === v ? color.primary : "#6A7488", boxShadow: view === v ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>{v}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {canEdit && <Button onClick={() => setModal(true)}><Icon name="plus" size={16} /> New task</Button>}
      </div>

      {view === "board" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, alignItems: "start" }}>
          {BOARD_COLS.map((c) => {
            const cards = tasks.filter((t) => t.status === c.label);
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
                        style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 11, padding: 12, cursor: canEdit ? "grab" : "default", boxShadow: "0 1px 2px rgba(20,26,60,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                          <span style={{ fontFamily: font.mono, fontSize: 10, color: color.faint3 }}>{t.code}</span>
                          <span style={{ flex: 1 }} />
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: pr.ink, background: pr.tint, padding: "1px 6px", borderRadius: 20 }}>{t.priority}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: color.text, lineHeight: 1.35, marginBottom: 9 }}>{t.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: color.faint }}>
                          <span style={{ fontFamily: font.mono }}>{t.sprint || "—"}</span>
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
          {tasks.length === 0 ? (
            <EmptyBlock message="No tasks yet." minHeight={140} />
          ) : tasks.map((t) => {
            const col = BOARD_COLS.find((c) => c.label === t.status) ?? BOARD_COLS[0];
            return (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 0.9fr 0.9fr 0.9fr 1fr", alignItems: "center", padding: "14px 22px", borderBottom: "1px solid #F2F4F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3, flex: "none" }}>{t.code}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                </div>
                <div style={{ fontSize: 12.5, color: color.subtle }}>{t.epic || "—"}</div>
                <div style={{ fontSize: 13, color: color.textMuted }}>{t.assignee}</div>
                <div style={{ fontSize: 12, color: color.faint, fontFamily: font.mono }}>{t.sprint || "—"}</div>
                <div style={{ fontSize: 12, color: color.faint, fontFamily: font.mono }}>{t.baseline || "—"}</div>
                <div><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: col.ink, background: col.tint, padding: "3px 10px", borderRadius: 20 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: col.color }} />{t.status}</span></div>
              </div>
            );
          })}
        </Card>
      )}

      {modal && <NewTaskModal projectId={projectId} onClose={() => setModal(false)} />}
    </div>
  );
}

function NewTaskModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [epic, setEpic] = useState("");
  const [assignee, setAssignee] = useState("");
  const [sprint, setSprint] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("To Do");

  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify({ name: name.trim(), epic: epic.trim(), assignee: assignee.trim(), sprint: sprint.trim(), baseline: sprint.trim(), priority, status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks", projectId] }); onClose(); },
  });
  const submit = () => { if (name.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={480} label="New task">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Add a task to this project's board.</div>
      <DecLabel>Task</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="What needs doing?" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Epic</DecLabel><Input value={epic} onChange={(e) => setEpic(e.target.value)} placeholder="Epic / feature" /></div>
        <div style={{ flex: 1 }}><DecLabel>Assignee</DecLabel><Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Assignee" /></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Sprint</DecLabel><Input value={sprint} onChange={(e) => setSprint(e.target.value)} placeholder="e.g. PI2 · S5" /></div>
        <div style={{ flex: 1 }}>
          <DecLabel>Priority</DecLabel>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>{TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
        </div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>{BOARD_COLS.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}</Select>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !name.trim()}>{create.isPending ? "Adding…" : "Add task"}</Button>
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
                  <button key={c.id} onClick={() => canGovern && toggle.mutate({ critId: c.id, met: !c.met })} disabled={!canGovern || toggle.isPending}
                    style={{ display: "flex", alignItems: "flex-start", gap: 7, textAlign: "left", background: "none", border: "none", padding: 0, cursor: canGovern ? "pointer" : "default", fontFamily: "inherit" }}>
                    <span style={{ flex: "none", width: 14, height: 14, borderRadius: 4, marginTop: 1, background: c.met ? "#15A34A" : "transparent", border: c.met ? "none" : `1.5px solid ${color.border2}`, color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.met ? "✓" : ""}</span>
                    <span style={{ fontSize: 11.5, color: color.text, lineHeight: 1.35 }}>{c.label}</span>
                  </button>
                ))}
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

interface Decision { code: string; title: string; context: string; decision: string; owner: string; date: string; status: string; }
const DEC_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: "#0B6B37", tint: "#E7F4EC" },
  Proposed: { ink: "#0C5798", tint: "#E6EFFB" },
  Rejected: { ink: "#A1282B", tint: "#FBE7E8" },
};
const DEC_COLS = "0.7fr 1.6fr 2fr 1fr 0.8fr 0.9fr";

function DecisionLog({ projectId, canGovern }: { projectId: string | null; canGovern: boolean }) {
  const [modal, setModal] = useState(false);
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
          <div key={d.code} style={{ display: "grid", gridTemplateColumns: DEC_COLS, alignItems: "flex-start", padding: "13px 22px", borderBottom: "1px solid #F2F4F9" }}>
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
    </Card>
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

interface RaidItem { id: number; type: string; title: string; owner: string; status: string; }
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
          return (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "0.9fr 3fr 1fr 1fr", alignItems: "start", padding: "14px 22px", borderBottom: "1px solid #F2F4F9" }}>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: tc.ink, background: tc.tint, padding: "3px 10px", borderRadius: 6 }}>{r.type}</span></div>
              <div style={{ fontSize: 13.5, color: color.text, fontWeight: 500 }}>{r.title}</div>
              <div style={{ fontSize: 13, color: color.subtle }}>{r.owner}</div>
              <div><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 10px", borderRadius: 20 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />{r.status}</span></div>
            </div>
          );
        })}
      </Card>
      {modal && <RaidModal projectId={projectId} onClose={() => setModal(false)} />}
    </>
  );
}

function RaidModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState(RAID_TYPES[0]);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState(RAID_STATUSES[0]);

  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/raid`, { method: "POST", body: JSON.stringify({ type, title: title.trim(), owner: owner.trim(), status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["raid", projectId] }); onClose(); },
  });
  const submit = () => { if (title.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={480} label="New RAID item">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Log a risk, issue, assumption or dependency against this project.</div>
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
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !title.trim()}>{create.isPending ? "Adding…" : "Add item"}</Button>
      </div>
    </Modal>
  );
}

function Comments() {
  const [text, setText] = useState("");
  return (
    <Card padding={22}>
      <SectionTitle>Discussion</SectionTitle>
      <EmptyBlock message="No comments yet. Start the conversation below." minHeight={90} />
      <div style={{ display: "flex", gap: 10, marginTop: 12, borderTop: `1px solid ${color.bg}`, paddingTop: 16 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" style={{ flex: 1, minHeight: 44, resize: "vertical", border: `1px solid ${color.border2}`, borderRadius: 9, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", color: color.text, outline: "none" }} />
        <Button style={{ alignSelf: "flex-end" }} onClick={() => setText("")}>Comment</Button>
      </div>
    </Card>
  );
}

// ---- Security, privacy & compliance ---------------------------------------
interface SecProfile {
  classification: string; residency: string; subjects: string; retention: string;
  personalData: boolean; specialCategory: boolean; automatedDecisions: boolean; cardholderData: boolean;
  gdpr: boolean; pci: boolean; iso: boolean; aiAct: boolean; soc2: boolean; nis2: boolean;
}
interface SecControl { id: number; code: string; control: string; framework: string; evidence: string; owner: string; status: string; }
interface SecData { canEdit: boolean; profile: SecProfile; controls: SecControl[]; }

const CLASS_OPTS = ["Public", "Internal", "Confidential", "Restricted"];
const RESIDENCY_OPTS = ["EU / EEA", "Global", "On-prem only"];
const FRAMEWORK_OPTS = ["ISO 27001", "GDPR", "PCI-DSS", "SOC 2", "NIS2", "EU AI Act"];
const CTL_STATUSES = ["Planned", "Partial", "Implemented"];
const CTL_STATUS: Record<string, { ink: string; tint: string }> = {
  Implemented: { ink: "#0B6B37", tint: "#E7F4EC" },
  Partial:     { ink: "#8A6300", tint: "#FBF2D7" },
  Planned:     { ink: "#56607A", tint: "#EEF1F6" },
};
const SEC_FLAGS: { key: keyof SecProfile; label: string; desc: string }[] = [
  { key: "gdpr", label: "GDPR", desc: "Personal data of EU/EEA data subjects" },
  { key: "pci", label: "PCI-DSS", desc: "Cardholder data in scope" },
  { key: "iso", label: "ISO 27001", desc: "ISMS Annex A controls apply" },
  { key: "aiAct", label: "EU AI Act", desc: "Automated recommendation model" },
  { key: "soc2", label: "SOC 2", desc: "Vendor assurance for SaaS components" },
  { key: "nis2", label: "NIS2", desc: "Essential-entity operational resilience" },
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

      {/* security review gates (structural; follow-up) */}
      <Card padding={0} style={{ overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "15px 22px", borderBottom: `1px solid ${color.bg}`, fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>Security review gates</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1.3fr 0.9fr 1fr", padding: "11px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Gate</div><div>Owner</div><div>Date</div><div>Status</div>
        </div>
        <EmptyBlock message="No security review gates scheduled yet." minHeight={110} />
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
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: SEC_COLS, alignItems: "center", padding: "12px 22px", borderBottom: "1px solid #F5F7FA" }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, color: color.faint3 }}>{c.code}</div>
              <div style={{ fontSize: 12.5, color: color.text, fontWeight: 600 }}>{c.control}</div>
              <div style={{ fontSize: 11.5, color: color.subtle }}>{c.framework}</div>
              <div style={{ fontSize: 11.5, color: "#7B849A", lineHeight: 1.4 }}>{c.evidence}</div>
              <div style={{ fontSize: 11.5, color: color.subtle }}>{c.owner}</div>
              <div>
                <button onClick={() => canEdit && cycle.mutate({ id: c.id, status: nextStatus })} disabled={!canEdit || cycle.isPending}
                  title={canEdit ? "Click to change status" : undefined}
                  style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "5px 10px", borderRadius: 20, border: "none", cursor: canEdit ? "pointer" : "default", fontFamily: "inherit" }}>{c.status}</button>
              </div>
            </div>
          );
        })}
      </Card>

      {addOpen && <AddControlModal projectId={projectId} onClose={() => setAddOpen(false)} />}
    </div>
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

  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/security/controls`, { method: "POST", body: JSON.stringify({ control: control.trim(), framework, evidence: evidence.trim(), owner: owner.trim(), status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security", projectId] }); onClose(); },
  });
  const submit = () => { if (control.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={500} label="Add a control">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Record a control and its evidence in the register.</div>
      <DecLabel>Control</DecLabel>
      <Input value={control} onChange={(e) => setControl(e.target.value)} placeholder="e.g. A.8.24 Use of cryptography" style={{ marginBottom: 14 }} />
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
interface EpicItem { id: number; name: string; stories: number; done: number; pct: number; status: string; dependsOn: string; }
const EPIC_STATUS: Record<string, { ink: string; tint: string; bar: string }> = {
  Complete:      { ink: "#0B6B37", tint: "#E7F4EC", bar: "#15A34A" },
  "In progress": { ink: "#0C5798", tint: "#E6EFFB", bar: "#0F6CBD" },
  Upcoming:      { ink: "#56607A", tint: "#EEF1F6", bar: "#8A93A6" },
  "At risk":     { ink: "#8A6300", tint: "#FBF2D7", bar: "#E0A100" },
};
const EPIC_STATUSES = ["Complete", "In progress", "Upcoming", "At risk"];

function Epics({ projectId }: { projectId: string | null }) {
  const [modal, setModal] = useState(false);
  const { data } = useQuery({
    queryKey: ["epics", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; epics: EpicItem[] }> =>
      (await api<{ canEdit: boolean; epics: EpicItem[] }>(`/projects/${projectId}/epics`)) ?? { canEdit: false, epics: [] },
  });
  const epics = data?.epics ?? [];
  const canEdit = data?.canEdit ?? false;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its epics." /></Card>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Epics group the delivery stories for this project.</div>
        <div style={{ flex: 1 }} />
        {canEdit && <Button onClick={() => setModal(true)}><Icon name="plus" size={16} /> New epic</Button>}
      </div>
      {epics.length === 0 ? (
        <Card><EmptyBlock minHeight={180} message="No epics yet." /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {epics.map((e) => {
            const sc = EPIC_STATUS[e.status] ?? EPIC_STATUS.Upcoming;
            return (
              <div key={e.id} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 20 }}>
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
                  <Icon name="link" size={14} /><span>{e.dependsOn ? `↳ after ${e.dependsOn}` : "No dependencies"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal && <NewEpicModal projectId={projectId} onClose={() => setModal(false)} />}
    </div>
  );
}

function NewEpicModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [stories, setStories] = useState("");
  const [done, setDone] = useState("");
  const [status, setStatus] = useState("Upcoming");
  const [dependsOn, setDependsOn] = useState("");

  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/epics`, { method: "POST", body: JSON.stringify({ name: name.trim(), stories: Number(stories) || 0, done: Number(done) || 0, status, dependsOn: dependsOn.trim() }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epics", projectId] }); onClose(); },
  });
  const submit = () => { if (name.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={460} label="New epic">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Group a set of delivery stories under an epic.</div>
      <DecLabel>Epic name</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Checkout & Payments" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Stories</DecLabel><Input type="number" value={stories} onChange={(e) => setStories(e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>Done</DecLabel><Input type="number" value={done} onChange={(e) => setDone(e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>{EPIC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        </div>
      </div>
      <DecLabel>Depends on</DecLabel>
      <Input value={dependsOn} onChange={(e) => setDependsOn(e.target.value)} placeholder="Another epic (optional)" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !name.trim()}>{create.isPending ? "Adding…" : "Add epic"}</Button>
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
        {canEdit && <Button onClick={() => setModal(true)}><Icon name="plus" size={16} /> New artifact</Button>}
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

  return (
    <Modal onClose={onClose} width={560} label={artifact.name}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: color.faint3 }}>{artifact.type} · Owner {artifact.owner}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 11px", borderRadius: 20 }}>{artifact.status}</span>
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
interface Requirement { id: number; code: string; title: string; type: string; priority: string; status: string; epic: string; story: string; test: string; testStatus: string; release: string; verified: boolean; }
interface ChangeRequest { id: number; code: string; title: string; reqCode: string; impact: string; sdp: string; status: string; raisedBy: string; date: string; }
interface ReqData { canEdit: boolean; stats: { total: number; approved: number; coverage: number; verified: number }; requirements: Requirement[]; changeRequests: ChangeRequest[]; }

const REQ_TYPES = ["Functional", "Non-functional", "Compliance"];
const REQ_STATUSES = ["Draft", "In review", "Approved"];
const REQ_PRIORITIES = ["Critical", "High", "Medium", "Low"];
const TEST_RESULTS = ["Not run", "In test", "Passed", "Failed"];
const CR_IMPACTS = ["Low", "Medium", "High"];
const REQ_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: "#0B6B37", tint: "#E7F4EC" }, "In review": { ink: "#0C5798", tint: "#E6EFFB" }, Draft: { ink: "#56607A", tint: "#EEF1F6" },
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
  const [crFor, setCrFor] = useState<string | null>(null); // req code prefill, or "" for blank
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
                <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{r.title}</div>
                <div style={{ fontSize: 11, color: color.faint3, fontFamily: font.mono }}>{r.code} · {r.type} · {r.priority}</div>
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
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: CR_COLS, alignItems: "center", padding: "13px 22px", borderBottom: "1px solid #F2F4F9" }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, color: color.faint3 }}>{c.code}</div>
              <div style={{ fontSize: 13, color: color.text, fontWeight: 600 }}>{c.title}</div>
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
      {crFor !== null && <RaiseCrModal projectId={projectId} reqCodes={requirements.map((r) => r.code)} prefill={crFor} onClose={() => setCrFor(null)} />}
    </div>
  );
}

function NewRequirementModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", type: REQ_TYPES[0], priority: "Medium", status: "Draft", epic: "", story: "", test: "", release: "" });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/requirements`, { method: "POST", body: JSON.stringify({ ...f, title: f.title.trim() }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["requirements", projectId] }); onClose(); },
  });
  return (
    <Modal onClose={onClose} width={520} label="New requirement">
      <DecLabel>Requirement</DecLabel>
      <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="What must the solution do?" style={{ marginBottom: 14 }} />
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
interface ArchData { canEdit: boolean; changeType: string; phases: AdmPhase[]; }

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

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its architecture governance." /></Card>;
  if (!data) return <Card><EmptyBlock minHeight={220} message="Loading architecture governance…" /></Card>;

  const { changeType, phases, canEdit } = data;
  const level = GOV_LEVEL[changeType] ?? "Architecture triage required";
  const full = level.startsWith("Full");

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
interface TestPlan { id: number; name: string; cases: number; passed: number; failed: number; blocked: number; notRun: number; execPct: number; }
interface Defect { id: number; code: string; title: string; severity: string; owner: string; status: string; test: string; }
interface QualityData { canEdit: boolean; totals: { cases: number; coverage: number; passRate: number; failed: number; openDefects: number }; plans: TestPlan[]; defects: Defect[]; }

const QUALITY_SOURCES: [string, string][] = [["jira", "Jira / Xray"], ["ado", "Azure Test Plans"], ["sdp", "ServiceDesk Plus"], ["manual", "Manual"]];
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
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: color.text }}>{p.name}</span>
                <span style={{ fontSize: 11.5, color: color.faint }}>{p.cases} cases · {p.execPct}% executed</span>
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
            <div key={d.id} style={{ display: "grid", gridTemplateColumns: DEF_COLS, alignItems: "center", padding: "13px 22px", borderBottom: "1px solid #F2F4F9" }}>
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

      {planModal && <NewPlanModal projectId={projectId} onClose={() => setPlanModal(false)} />}
      {defectModal && <NewDefectModal projectId={projectId} onClose={() => setDefectModal(false)} />}
    </div>
  );
}

function NewPlanModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", cases: "", passed: "", failed: "", blocked: "" });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/test-plans`, { method: "POST", body: JSON.stringify({ name: f.name.trim(), cases: Number(f.cases) || 0, passed: Number(f.passed) || 0, failed: Number(f.failed) || 0, blocked: Number(f.blocked) || 0 }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quality", projectId] }); onClose(); },
  });
  return (
    <Modal onClose={onClose} width={480} label="New test plan">
      <DecLabel>Plan name</DecLabel>
      <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Checkout regression" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Cases</DecLabel><Input type="number" value={f.cases} onChange={(e) => set("cases", e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>Passed</DecLabel><Input type="number" value={f.passed} onChange={(e) => set("passed", e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>Failed</DecLabel><Input type="number" value={f.failed} onChange={(e) => set("failed", e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>Blocked</DecLabel><Input type="number" value={f.blocked} onChange={(e) => set("blocked", e.target.value)} placeholder="0" /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => f.name.trim() && create.mutate()} disabled={create.isPending || !f.name.trim()}>{create.isPending ? "Adding…" : "Add plan"}</Button>
      </div>
    </Modal>
  );
}

function NewDefectModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", severity: "Medium", owner: "", status: "Open", test: "" });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/defects`, { method: "POST", body: JSON.stringify({ ...f, title: f.title.trim() }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quality", projectId] }); onClose(); },
  });
  return (
    <Modal onClose={onClose} width={480} label="Log defect">
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
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => f.title.trim() && create.mutate()} disabled={create.isPending || !f.title.trim()}>{create.isPending ? "Logging…" : "Log defect"}</Button>
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
  const [modal, setModal] = useState(false);
  const { data } = useQuery({
    queryKey: ["dependencies", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<DepData | null> => await api<DepData>(`/projects/${projectId}/dependencies`),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its dependencies." /></Card>;
  if (!data) return <Card><EmptyBlock minHeight={220} message="Loading dependencies…" /></Card>;

  const { dependsOn, blocks, inheritedRisk, ownHealth, effHealth, depRiskTitle, canEdit } = data;
  const openProject = (pid: string) => navigate(`${SCREENS.project.path}?id=${pid}`);

  const column = (title: string, icon: React.ReactNode, links: DepLink[], empty: string) => (
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
        {column("Depends on", <span style={{ color: "#C98A00", display: "flex" }}><Icon name="arrowRight" size={16} /></span>, dependsOn, "No upstream dependencies.")}
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
