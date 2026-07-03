import { useState } from "react";
import { color, font, radius } from "@/theme";
import { Icon } from "@/components/Icon";
import { EmptyBlock } from "@/components/ui";

// ---- Report catalogue — structural chrome ----
interface ReportType { name: string; desc: string; icon: string }
const REPORT_TYPES: ReportType[] = [
  { name: "Portfolio status report", desc: "Health, budget & milestones across all projects", icon: "layers" },
  { name: "Demand funnel report", desc: "Intake, scoring & stage conversion", icon: "inbox" },
  { name: "Blocker & risk report", desc: "Active impediments and RAID exposure", icon: "alert" },
  { name: "Resource & capacity report", desc: "Allocation & utilisation by team", icon: "users" },
  { name: "Audit & compliance report", desc: "Access, changes & sign-offs", icon: "shield" },
];

interface Fmt { key: string; label: string; icon: string; tint: string; ink: string }
const FORMATS: Fmt[] = [
  { key: "pptx", label: "PPTX", icon: "barChart", tint: "#FBEDE6", ink: "#C24A1F" },
  { key: "pdf", label: "PDF", icon: "book", tint: "#FCEDED", ink: "#C0303A" },
  { key: "xlsx", label: "Excel", icon: "sheet", tint: "#E7F4EC", ink: "#0B6B37" },
  { key: "html", label: "HTML", icon: "globe", tint: "#E6EFFB", ink: color.primary },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Reports() {
  const [month, setMonth] = useState("Jul");

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ background: "linear-gradient(115deg,#11163A,#0F6CBD)", borderRadius: radius.xxl, padding: "22px 26px", marginBottom: 22, color: "#fff" }}>
        <div style={{ fontFamily: font.head, fontSize: 19, fontWeight: 600 }}>Pull a report</div>
        <div style={{ fontSize: 13.5, color: "#C9D6EE", marginTop: 4 }}>Generate branded reports (Birgma · Biltema) in PPTX, PDF, Excel or HTML.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
        {REPORT_TYPES.map((r) => (
          <div key={r.name} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: 19 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
              <span style={{ width: 42, height: 42, borderRadius: 11, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Icon name={r.icon} size={20} />
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: color.ink }}>{r.name}</div>
                <div style={{ fontSize: 12.5, color: color.faint2 }}>{r.desc}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", border: `1px solid ${color.border}`, background: "#fff", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = color.primary; e.currentTarget.style.background = "#F6FAFE"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = color.border; e.currentTarget.style.background = "#fff"; }}
                >
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: f.tint, color: f.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={f.icon} size={15} />
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: color.textMuted }}>{f.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly project report */}
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xxl, marginTop: 22, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid #EEF1F6", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>Monthly project report</div>
            <div style={{ fontSize: 12.5, color: color.faint2 }}>Blockers, completed &amp; in-progress work — per project, per month</div>
          </div>
          <select disabled style={{ ...selStyle, color: color.faint3 }}>
            <option>All projects</option>
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value)} style={selStyle}>
            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "8px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
            <Icon name="download" size={16} /> Export
          </button>
        </div>
        <div style={{ padding: "20px 22px" }}>
          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13, marginBottom: 18 }}>
            {[
              { label: "Completed", ink: "#0B6B37" },
              { label: "In progress", ink: color.primary },
              { label: "Velocity", ink: color.ink },
              { label: "Milestones hit", ink: color.ink },
            ].map((k) => (
              <div key={k.label} style={{ background: color.surfaceAlt, border: "1px solid #EEF1F6", borderRadius: radius.xl, padding: 14 }}>
                <div style={{ fontSize: 11.5, color: color.faint }}>{k.label}</div>
                <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: k.ink }}>—</div>
              </div>
            ))}
          </div>
          {/* work split bar */}
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginBottom: 6, background: "#EEF1F6" }} />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            {[["Completed", "#15A34A"], ["In progress", color.primary], ["Planned", "#C7CEDB"]].map(([lbl, c]) => (
              <span key={lbl} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.textMuted }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: c }} />{lbl}
              </span>
            ))}
          </div>
          {/* two columns: tasks + blockers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0B6B37", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>Completed this month</div>
              <EmptyBlock message="No completed work for this period" minHeight={72} />
              <div style={{ fontSize: 11, fontWeight: 700, color: color.primaryDark, letterSpacing: "0.05em", textTransform: "uppercase", margin: "14px 0 10px" }}>In progress</div>
              <EmptyBlock message="Nothing in progress" minHeight={72} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#A1282B", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>Open blockers</div>
              <EmptyBlock message="No open blockers" minHeight={72} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0B6B37", letterSpacing: "0.05em", textTransform: "uppercase", margin: "14px 0 10px" }}>Resolved this month</div>
              <EmptyBlock message="Nothing resolved this period" minHeight={72} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const selStyle: React.CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", color: color.text, background: "#fff", cursor: "pointer" };
