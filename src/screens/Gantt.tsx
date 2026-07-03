import { useState } from "react";
import { color, font } from "@/theme";
import { Icon } from "@/components/Icon";
import { Button, Input, Select } from "@/components/ui";
import { Overlay } from "./Demands";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const VIEW_TABS = [["schedule", "Schedule"], ["resources", "Resource allocation"], ["sprints", "Sprints"]] as const;
type ViewId = (typeof VIEW_TABS)[number][0];

interface Milestone { id: string; label: string; date: string; month: number; }

export default function Gantt() {
  const [scope, setScope] = useState<"project" | "program">("project");
  const [view, setView] = useState<ViewId>("schedule");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [modal, setModal] = useState(false);

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* scope toggle */}
      <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2, marginBottom: 14 }}>
        {(["project", "program"] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: scope === s ? "#fff" : "transparent", color: scope === s ? color.primary : "#6A7488", boxShadow: scope === s ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>{s === "project" ? "Project timeline" : "Program timeline"}</button>
        ))}
      </div>

      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 22px", borderBottom: `1px solid ${color.bg}`, flexWrap: "wrap" }}>
          {scope === "program"
            ? <span style={{ width: 42, height: 42, borderRadius: 11, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="folders" size={20} /></span>
            : <span style={{ width: 11, height: 11, borderRadius: "50%", background: color.faint3 }} />}
          <div>
            <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>{scope === "program" ? "Program timeline" : "Project timeline"}</div>
            <div style={{ fontSize: 12, color: color.faint2 }}>{scope === "program" ? "Project timelines aggregated · select a program" : "Select a project to view its phases, milestones & dependencies"}</div>
          </div>
          <div style={{ flex: 1 }} />
          <select style={selectStyle}><option>{scope === "program" ? "No programs yet" : "No projects yet"}</option></select>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: color.subtle, flexWrap: "wrap" }}>
            <Legend swatch={<span style={{ width: 14, height: 10, borderRadius: 3, background: "#0F6CBD" }} />}>Complete</Legend>
            <Legend swatch={<span style={{ width: 14, height: 10, borderRadius: 3, background: "#DCEAF8", border: "1px solid #0F6CBD" }} />}>Planned</Legend>
            <Legend swatch={<span style={{ width: 10, height: 10, background: "#E0A100", transform: "rotate(45deg)" }} />}>Milestone</Legend>
            <Legend swatch={<span style={{ width: 2, height: 13, background: "#D13438" }} />}>Today</Legend>
          </div>
        </div>

        {/* view tabs */}
        <div style={{ display: "flex", gap: 0, padding: "0 22px", borderBottom: `1px solid ${color.bg}`, background: "#FBFCFE" }}>
          {VIEW_TABS.map(([vid, label]) => {
            const active = view === vid;
            return <button key={vid} onClick={() => setView(vid)} style={{ padding: "11px 16px", marginRight: 6, border: "none", borderBottom: active ? "2.5px solid #0F6CBD" : "2.5px solid transparent", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", color: active ? color.primary : "#6A7488" }}>{label}</button>;
          })}
        </div>

        {view === "schedule" ? (
          <div style={{ display: "flex" }}>
            {/* left labels */}
            <div style={{ width: 286, flex: "none", borderRight: `1px solid ${color.bg}` }}>
              <div style={{ height: 38, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>Phase / Workstream</div>
              <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 22px", fontSize: 12.5, color: color.faint3, textAlign: "center" }}>No phases scheduled yet.</div>
              <div style={{ height: 72, display: "flex", alignItems: "center", gap: 8, padding: "0 22px", fontSize: 11, fontWeight: 700, color: color.faint, letterSpacing: "0.04em", textTransform: "uppercase", borderTop: `1px solid ${color.bg}`, background: "#FBFCFE" }}>
                Milestones
                <button onClick={() => setModal(true)} style={{ fontSize: 10, fontWeight: 700, color: color.primary, background: color.primaryTint, border: "1px solid #CFE0F4", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", textTransform: "none", letterSpacing: 0 }}>+ Add</button>
              </div>
            </div>
            {/* right grid */}
            <div style={{ flex: 1, minWidth: 560, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", height: 38, borderBottom: `1px solid ${color.bg}` }}>
                {MONTHS.map((m) => <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, color: color.faint, fontWeight: 600, borderRight: "1px solid #F4F6FA" }}>{m}</div>)}
              </div>
              <div style={{ position: "relative", minHeight: 200, backgroundImage: "linear-gradient(90deg,#F2F4F9 1px,transparent 1px)", backgroundSize: "8.3333% 100%" }}>
                <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "#D13438", left: `${(new Date().getMonth() + 0.5) / 12 * 100}%`, zIndex: 5 }}>
                  <span style={{ position: "absolute", top: -1, left: -18, fontSize: 9, fontWeight: 700, color: "#fff", background: "#D13438", padding: "1px 5px", borderRadius: 4 }}>NOW</span>
                </div>
              </div>
              <div style={{ height: 72, position: "relative", borderTop: `1px solid ${color.bg}`, background: "#FBFCFE" }}>
                {milestones.map((ms) => (
                  <div key={ms.id} style={{ position: "absolute", top: 0, left: `${(ms.month + 0.5) / 12 * 100}%`, transform: "translateX(-50%)", width: 90, textAlign: "center" }}>
                    <span style={{ display: "block", width: 16, height: 16, background: "#E0A100", transform: "rotate(45deg)", margin: "10px auto 0", border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,0.22)" }} />
                    <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: color.text, whiteSpace: "nowrap", textAlign: "center", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis" }}>{ms.label}</span>
                    <span style={{ display: "block", fontSize: 9, color: color.faint3, textAlign: "center" }}>{ms.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, fontSize: 13, color: color.faint3, textAlign: "center" }}>
            {view === "resources" ? "No resource allocation data yet." : "No sprints defined yet."}
          </div>
        )}
      </div>

      {modal && (
        <AddMilestoneModal
          onClose={() => setModal(false)}
          onAdd={(m) => { setMilestones((l) => [...l, m]); setModal(false); }}
        />
      )}
    </div>
  );
}

function AddMilestoneModal({ onClose, onAdd }: { onClose: () => void; onAdd: (m: Milestone) => void }) {
  const [label, setLabel] = useState("");
  const [month, setMonth] = useState(new Date().getMonth());
  const submit = () => {
    if (!label.trim()) return;
    onAdd({ id: "MS-" + Math.floor(Math.random() * 9999), label: label.trim(), month, date: MONTHS[month] });
  };
  return (
    <Overlay onClose={onClose} width={420}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 4 }}>Add milestone</div>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>Place a key date on the timeline.</div>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", marginBottom: 5 }}>Milestone</label>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. MVP go-live" />
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", margin: "12px 0 5px" }}>Month</label>
      <Select value={month} onChange={(e) => setMonth(+e.target.value)}>
        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
      </Select>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} style={{ padding: "10px 18px" }}>Add milestone</Button>
      </div>
    </Overlay>
  );
}

function Legend({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{swatch}{children}</span>;
}
const selectStyle: React.CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", color: color.primary, background: "#fff", cursor: "pointer" };
