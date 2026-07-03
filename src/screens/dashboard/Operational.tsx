import { color, font } from "@/theme";
import { Card } from "@/components/ui";
import { KPI_DEFS, type DashboardData } from "./data";

const STATUS_COLORS: Record<string, { dot: string; ink: string; tint: string }> = {
  "In progress": { dot: "#0F6CBD", ink: "#0C5798", tint: "#E6EFFB" },
  "To do":       { dot: "#8A93A6", ink: "#4A5266", tint: "#EEF1F6" },
  "In review":   { dot: "#E0A100", ink: "#8A6300", tint: "#FBF2D7" },
  "Done":        { dot: "#15A34A", ink: "#0B6B37", tint: "#E7F4EC" },
  "Blocked":     { dot: "#D13438", ink: "#A1282B", tint: "#FBE7E8" },
};

export function Operational({ d, onProject }: { d: DashboardData; onProject: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPI strip */}
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: "6px 8px", display: "flex", alignItems: "stretch" }}>
        {KPI_DEFS.map((def, i) => {
          const k = d.kpis[def.key];
          return (
            <div key={def.key} style={{ flex: 1, padding: "13px 18px", borderRight: i < KPI_DEFS.length - 1 ? "1px solid #F2F4F9" : "none", display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11.5, color: color.faint }}>{def.label}</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: k ? color.ink : color.faint3 }}>{k?.value ?? "—"}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: k ? (k.good ? "#0B6B37" : "#A1282B") : color.faint3 }}>{k?.delta ?? ""}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* my tasks */}
          <Card padding={0} style={{ overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 13px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>My tasks · current sprint</div>
                <div style={{ fontSize: 12, color: color.faint2 }}>Assigned to you</div>
              </div>
            </div>
            {d.tasks.length === 0 ? (
              <div style={{ padding: "34px 20px", textAlign: "center", color: color.faint3, fontSize: 13, borderTop: "1px solid #F2F4F9" }}>No tasks assigned to you.</div>
            ) : d.tasks.map((t, i) => {
              const sc = STATUS_COLORS[t.status] ?? STATUS_COLORS["To do"];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid #F2F4F9" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot, flex: "none" }} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                  <span style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono }}>{t.sprint}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 10px", borderRadius: 20 }}>{t.status}</span>
                </div>
              );
            })}
          </Card>

          {/* approvals */}
          <Card padding="18px 20px">
            <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink, marginBottom: 14 }}>Awaiting your approval</div>
            {d.approvals.length === 0 ? (
              <div style={{ fontSize: 13, color: color.faint3, padding: "6px 0" }}>Nothing is awaiting your approval.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {d.approvals.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, border: `1px solid ${color.bg}`, borderRadius: 11, padding: "12px 14px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{a.title}</div>
                      <div style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono }}>{a.id} · {a.requester} · {a.dept}</div>
                    </div>
                    <div style={{ display: "flex", gap: 7 }}>
                      <button style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#15A34A", border: "none", padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Approve</button>
                      <button style={{ fontSize: 12, fontWeight: 600, color: color.faint, background: "#fff", border: `1px solid ${color.border2}`, padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card padding="18px 19px">
            <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink, marginBottom: 13 }}>My projects</div>
            {d.projects.length === 0 ? (
              <div style={{ fontSize: 13, color: color.faint3, padding: "6px 0" }}>No projects assigned.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {d.projects.slice(0, 5).map((p) => (
                  <div key={p.id} onClick={() => onProject(p.id)} style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer", padding: "5px 0" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: { green: "#15A34A", amber: "#E0A100", red: "#D13438", hold: "#8A93A6" }[p.status], flex: "none" }} />
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div></div>
                    <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.subtle }}>{p.progress}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card padding="18px 19px">
            <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink, marginBottom: 13 }}>Recent activity</div>
            {d.activity.length === 0 ? (
              <div style={{ fontSize: 13, color: color.faint3, padding: "6px 0" }}>No recent activity.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {d.activity.map((ev, i) => (
                  <div key={i} style={{ display: "flex", gap: 11 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: ev.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none", fontFamily: font.head }}>{ev.initials}</div>
                    <div style={{ flex: 1, lineHeight: 1.4 }}><div style={{ fontSize: 13, color: color.textMuted }}><b style={{ color: color.text }}>{ev.who}</b> {ev.action}</div><div style={{ fontSize: 11.5, color: color.faint3, marginTop: 1 }}>{ev.time}</div></div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
