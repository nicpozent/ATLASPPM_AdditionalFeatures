import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";

const STAGES = [
  { key: "draft",    label: "Draft",       color: "#8A93A6" },
  { key: "backlog",  label: "Backlog",     color: "#0F6CBD" },
  { key: "approved", label: "Approved",    color: "#15A34A" },
  { key: "progress", label: "In Progress", color: "#7A3FB0" },
  { key: "hold",     label: "On Hold",     color: "#E0A100" },
] as const;
type StageKey = (typeof STAGES)[number]["key"];

const PRIORITY = {
  High:     { ink: "#8A6300", tint: "#FBF2D7" },
  Medium:   { ink: "#0C5798", tint: "#E6EFFB" },
  Critical: { ink: "#A1282B", tint: "#FBE7E8" },
  Low:      { ink: "#566077", tint: "#EEF0F4" },
} as const;

interface Demand {
  id: string; title: string; stage: StageKey; priority: keyof typeof PRIORITY;
  value: number; effort: number; requester: string; dept: string; date: string;
}

function useDemands() {
  return useQuery({
    queryKey: ["demands"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Demand[]> => { try { return (await api<Demand[]>("/demands")) ?? []; } catch { return []; } },
  });
}

function Meter({ n, color: c }: { n: number; color: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < n ? c : "#E4E8F0" }} />
      ))}
    </span>
  );
}

export default function Demands() {
  const { data: fetched = [] } = useDemands();
  const [local, setLocal] = useState<Demand[]>([]);
  const [modal, setModal] = useState(false);
  const demands = [...local, ...fetched];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.subtle }}>Intake scored on <b style={{ color: color.primary }}>value</b> vs <b style={{ color: "#C98A00" }}>effort</b> · drag to advance through the funnel</div>
        <div style={{ flex: 1 }} />
        <button style={secBtn}><Icon name="search" size={16} /> Filter</button>
        <button style={primaryBtn} onClick={() => setModal(true)}><Icon name="plus" size={16} /> New demand</button>
      </div>

      <div style={{ display: "flex", gap: 15, alignItems: "flex-start", overflowX: "auto", paddingBottom: 12 }}>
        {STAGES.map((s) => {
          const items = demands.filter((d) => d.stage === s.key);
          return (
            <div key={s.key} style={{ width: 280, flex: "none", background: "#F4F6FA", border: `1px solid ${color.border}`, borderRadius: 14, padding: "13px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13, padding: "0 3px" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: color.text }}>{s.label}</span>
                <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.faint, background: "#fff", border: `1px solid ${color.border}`, padding: "0 7px", borderRadius: 20 }}>{items.length}</span>
                <div style={{ flex: 1 }} />
                <span onClick={() => setModal(true)} style={{ color: color.faint3, display: "flex", cursor: "pointer" }}><Icon name="plus" size={16} /></span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.length === 0 ? (
                  <div style={{ fontSize: 12, color: color.faint3, textAlign: "center", padding: "20px 6px" }}>No demands</div>
                ) : items.map((d) => {
                  const pr = PRIORITY[d.priority];
                  return (
                    <div key={d.id} style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 11, padding: "13px 13px 11px", boxShadow: "0 1px 2px rgba(20,26,60,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                        <span style={{ fontFamily: font.mono, fontSize: 11, color: color.faint3 }}>{d.id}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: pr.ink, background: pr.tint, padding: "2px 8px", borderRadius: 20 }}>{d.priority}</span>
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text, lineHeight: 1.32, marginBottom: 10 }}>{d.title}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 10.5, color: color.faint3, textTransform: "uppercase" }}>Value</span><Meter n={d.value} color="#0F6CBD" /></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 10.5, color: color.faint3, textTransform: "uppercase" }}>Effort</span><Meter n={d.effort} color="#C98A00" /></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #F2F4F9", paddingTop: 9 }}>
                        <span style={{ fontSize: 11.5, color: color.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{d.requester} · {d.dept}</span>
                        <span style={{ fontSize: 11, color: color.faint3 }}>{d.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {modal && <NewDemandModal onClose={() => setModal(false)} onCreate={(d) => { setLocal((l) => [d, ...l]); setModal(false); }} />}
    </div>
  );
}

function NewDemandModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: Demand) => void }) {
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState("");
  const [priority, setPriority] = useState<keyof typeof PRIORITY>("Medium");
  const [value, setValue] = useState(3);
  const [effort, setEffort] = useState(3);
  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      id: "DM-" + Math.floor(300 + Math.random() * 699), title: title.trim(), stage: "draft",
      priority, value, effort, requester: "You", dept: dept.trim() || "Unassigned",
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    });
  };
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 4 }}>New demand</div>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>Score the request on value and effort; it enters the funnel as a draft.</div>
      <Lbl>Title</Lbl>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short description of the demand" style={inputStyle} />
      <Lbl>Department</Lbl>
      <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Requesting department" style={inputStyle} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><Lbl>Value (1–5)</Lbl><input type="number" min={1} max={5} value={value} onChange={(e) => setValue(Math.max(1, Math.min(5, +e.target.value)))} style={inputStyle} /></div>
        <div><Lbl>Effort (1–5)</Lbl><input type="number" min={1} max={5} value={effort} onChange={(e) => setEffort(Math.max(1, Math.min(5, +e.target.value)))} style={inputStyle} /></div>
      </div>
      <Lbl>Priority</Lbl>
      <select value={priority} onChange={(e) => setPriority(e.target.value as keyof typeof PRIORITY)} style={inputStyle}>
        {Object.keys(PRIORITY).map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={secBtn}>Cancel</button>
        <button onClick={submit} style={primaryBtn}>Create demand</button>
      </div>
    </Overlay>
  );
}

// Shared modal overlay
export function Overlay({ children, onClose, width = 460 }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(17,22,58,0.42)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: color.surface, borderRadius: 16, padding: 24, boxShadow: "0 24px 60px rgba(17,22,58,0.3)" }}>
        {children}
      </div>
    </div>
  );
}
function Lbl({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", margin: "12px 0 5px" }}>{children}</label>;
}
const inputStyle: React.CSSProperties = { width: "100%", border: `1px solid ${color.border2}`, borderRadius: 9, padding: "10px 11px", fontSize: 13, fontFamily: "inherit", color: color.text, background: "#fff", outline: "none" };
const secBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: color.textMuted, background: "#fff", border: `1px solid ${color.border2}`, padding: "9px 14px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "10px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" };
