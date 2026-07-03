import { useState } from "react";
import { color, font, radius } from "@/theme";
import { Card, EmptyBlock } from "@/components/ui";

// ---------------------------------------------------------------------------
// My Team — built 1:1 from the prototype (design/Atlas PPM.dc.html, lines
// 2853-2909). Members and their skill levels sync from Entra ID / groups
// (data), so the skills matrix and vacation calendar render their real
// structure with empty states until members load.
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 7, padding: "7px 10px", fontSize: 12.5, fontFamily: "inherit", color: color.text, background: "#fff" };

export default function Teams() {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 13.5, color: color.subtle, marginBottom: 16 }}>
        Your team — members from Entra ID / groups. Edit skill levels (0–4) for your people; changes are audited.
      </div>

      {/* skills matrix */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", minWidth: 760, padding: "14px 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.03em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
            <div>Member</div>
            <div style={{ textAlign: "center" }}>Skill levels (0–4)</div>
          </div>
          <EmptyBlock message="No team members yet — members sync from Entra ID / groups." />
        </div>
        <div style={{ display: "flex", gap: 14, padding: "13px 22px", flexWrap: "wrap", borderTop: `1px solid ${color.bg}` }}>
          <span style={{ fontSize: 11, color: color.faint3 }}>Scale:</span>
          <span style={{ fontSize: 11, color: "#566077" }}>0 None · 1–2 Working · 3 Proficient · 4 Expert</span>
        </div>
      </Card>

      {/* vacation calendar */}
      <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, margin: "22px 0 12px" }}>Team vacation calendar</div>
      <div style={{ fontSize: 12.5, color: color.faint, marginBottom: 12 }}>Jul–Dec 2026 · absences for your team. Plan allocations around these.</div>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <EmptyBlock message="No absences recorded yet." />
      </Card>

      {/* add absence */}
      <div style={{ background: color.surfaceAlt, border: `1px solid ${color.bg}`, borderRadius: 12, padding: "14px 16px", marginTop: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: color.ink, marginBottom: 10 }}>Add an absence</div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
          <select style={{ ...inputStyle, cursor: "pointer" }}><option value="">Select resource…</option></select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...inputStyle, color: color.textMuted }} />
          <span style={{ fontSize: 12, color: color.faint3 }}>to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inputStyle, color: color.textMuted }} />
          <select style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="vacation">Vacation</option><option value="sick">Sick</option><option value="training">Training</option>
          </select>
          <button style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "8px 14px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
        </div>
        <div style={{ fontSize: 12, color: color.faint3, marginTop: 12 }}>No absences added yet.</div>
      </div>

      {/* consolidated calendar */}
      <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, margin: "26px 0 12px" }}>Consolidated vacation calendar</div>
      <div style={{ fontSize: 12.5, color: color.faint, marginBottom: 12 }}>All resources across the portfolio — visible to PMO & Project Managers.</div>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <EmptyBlock message="No absences recorded across the portfolio yet." />
      </Card>
    </div>
  );
}
