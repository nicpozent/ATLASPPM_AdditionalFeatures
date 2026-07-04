import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, ProgressBar, Button } from "@/components/ui";
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
  { label: "To Do", color: "#8A93A6" }, { label: "In Progress", color: "#0F6CBD" },
  { label: "In Review", color: "#E0A100" }, { label: "Done", color: "#15A34A" }, { label: "Blocked", color: "#D13438" },
];
const RAID_TYPES = ["Risks", "Issues", "Assumptions", "Dependencies"];

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

      {tab === "overview" && <Overview />}
      {tab === "tasks" && <Tasks />}
      {tab === "governance" && <Governance projectId={id} />}
      {tab === "raid" && <Raid />}
      {tab === "comments" && <Comments />}
      {["epics", "requirements", "quality", "architecture", "security", "dependencies", "vacations", "artifacts"].includes(tab) && (
        <Card><EmptyBlock minHeight={220} message={`${TABS.find((t) => t[0] === tab)?.[1]} will appear here once the project is loaded from the API.`} /></Card>
      )}
    </div>
  );
}

function Overview() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Card padding="18px 22px">
          <SectionTitle>People &amp; roles</SectionTitle>
          <EmptyBlock message="No people assigned yet." minHeight={70} />
        </Card>
        {/* AI assist (structural chrome) */}
        <div style={{ background: "linear-gradient(120deg,#0F1B3D,#123B7A)", border: "1px solid #14264F", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.12)", color: "#8EC5FF", fontSize: 14 }}>✦</span>
            <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: "#fff" }}>Atlas AI assist</div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#8EC5FF", background: "rgba(142,197,255,0.16)", padding: "2px 8px", borderRadius: 20, letterSpacing: "0.04em" }}>BETA</span>
          </div>
          <div style={{ fontSize: 12.5, color: "#AEBEDC", lineHeight: 1.5, marginBottom: 14 }}>Draft an executive status report or scan this project for delivery risks — generated from live project data.</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#0F1B3D", background: "#fff", border: "none", padding: "10px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>✦ Draft status report</button>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.22)", padding: "10px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>◆ Detect risks</button>
          </div>
        </div>
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

function Tasks() {
  const [view, setView] = useState<"board" | "list">("board");
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2 }}>
          {(["board", "list"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "6px 15px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", textTransform: "capitalize", background: view === v ? "#fff" : "transparent", color: view === v ? color.primary : "#6A7488", boxShadow: view === v ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>{v}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Button><Icon name="plus" size={16} /> New task</Button>
      </div>
      {view === "board" ? (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", overflowX: "auto", paddingBottom: 8 }}>
          {BOARD_COLS.map((c) => (
            <div key={c.label} style={{ width: 250, flex: "none", background: "#F4F6FA", border: `1px solid ${color.border}`, borderRadius: 14, padding: "13px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13, padding: "0 3px" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: c.color }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: color.text }}>{c.label}</span>
                <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.faint, background: "#fff", border: `1px solid ${color.border}`, padding: "0 7px", borderRadius: 20 }}>0</span>
              </div>
              <div style={{ fontSize: 12, color: color.faint3, textAlign: "center", padding: "18px 6px" }}>No tasks</div>
            </div>
          ))}
        </div>
      ) : (
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.8fr 2.4fr 1fr 1fr 0.8fr 0.8fr", padding: "13px 20px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
            <div>ID</div><div>Task</div><div>Assignee</div><div>Sprint</div><div>Priority</div><div>Status</div>
          </div>
          <EmptyBlock message="No tasks yet." minHeight={140} />
        </Card>
      )}
    </div>
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

      {/* decision log (structural) */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px 13px", fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Decision log</div>
        <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1.6fr 2fr 1fr 0.8fr 0.9fr", padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>ID</div><div>Decision</div><div>Rationale</div><div>Owner</div><div>Date</div><div>Status</div>
        </div>
        <EmptyBlock message="No decisions logged yet." minHeight={120} />
      </Card>
    </div>
  );
}

function Raid() {
  const [type, setType] = useState(RAID_TYPES[0]);
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: "14px 20px 0" }}>
        {RAID_TYPES.map((t) => (
          <button key={t} onClick={() => setType(t)} style={{ padding: "8px 14px", border: "none", borderBottom: type === t ? "2.5px solid #0F6CBD" : "2.5px solid transparent", background: "none", cursor: "pointer", fontSize: 13, fontWeight: type === t ? 700 : 500, color: type === t ? color.primary : "#6A7488", fontFamily: "inherit" }}>{t}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "0.7fr 2.4fr 1fr 0.8fr 0.8fr", padding: "13px 20px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderTop: `1px solid ${color.bg}`, borderBottom: `1px solid ${color.bg}` }}>
        <div>ID</div><div>Description</div><div>Owner</div><div>Impact</div><div>Status</div>
      </div>
      <EmptyBlock message={`No ${type.toLowerCase()} logged yet.`} minHeight={140} />
    </Card>
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
