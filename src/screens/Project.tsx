import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, ProgressBar } from "@/components/ui";
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

const GATES = [
  "G0 · Concept / Mandate", "G1 · Initiation", "G2 · Plan & Design",
  "G3 · Build ready", "G4 · Release readiness", "G5 · Close & benefits",
];
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
            <button style={secBtn}><Icon name="download" size={16} /> Status PPTX</button>
            <button style={primaryBtn} onClick={() => navigate(SCREENS.gantt.path)}><Icon name="gantt" size={16} /> Timeline</button>
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
      {tab === "governance" && <Governance />}
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
        <button style={primaryBtn}><Icon name="plus" size={16} /> New task</button>
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

function Governance() {
  return (
    <Card padding={22}>
      <SectionTitle>Stage gates · G0–G5</SectionTitle>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>Phase-gate governance across the project lifecycle.</div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
        {GATES.map((g, i) => (
          <div key={g} style={{ flex: "1 0 180px", border: `1px solid ${color.border}`, borderRadius: 12, padding: "14px 15px", background: color.surfaceAlt }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: color.bg, color: color.faint, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.head, fontWeight: 700, fontSize: 12 }}>{`G${i}`}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: color.text }}>{g.split(" · ")[1]}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: color.faint3, background: color.bg, padding: "2px 9px", borderRadius: 20 }}>Not started</span>
          </div>
        ))}
      </div>
    </Card>
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
        <button style={{ ...primaryBtn, alignSelf: "flex-end" }} onClick={() => setText("")}>Comment</button>
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
const secBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: color.textMuted, background: "#fff", border: `1px solid ${color.border2}`, padding: "9px 14px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "10px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" };
