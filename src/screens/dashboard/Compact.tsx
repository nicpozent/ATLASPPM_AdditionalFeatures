import { color, font } from "@/theme";
import { Card, ProgressBar, statusDot } from "@/components/ui";
import { KPI_DEFS, PIPELINE_STAGES, type DashboardData } from "./data";

const fmtBudget = (v: number) => "€" + (v / 1000).toFixed(1) + "M";
const HEALTH_INK: Record<string, string> = { green: "#0B6B37", amber: "#8A6300", red: "#A1282B", hold: "#4A5266" };

export function Compact({ d, onProject }: { d: DashboardData; onProject: (id: string) => void }) {
  const pipeMax = Math.max(1, ...PIPELINE_STAGES.map((s) => d.pipeline[s.key]?.count ?? 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* metric chips */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {KPI_DEFS.map((def) => {
          const k = d.kpis[def.key];
          return (
            <div key={def.key} style={{ display: "flex", alignItems: "center", gap: 9, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 10, padding: "8px 14px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: def.color }} />
              <span style={{ fontSize: 12.5, color: color.faint }}>{def.label}</span>
              <span style={{ fontFamily: font.head, fontSize: 16, fontWeight: 700, color: k ? color.ink : color.faint3 }}>{k?.value ?? "—"}</span>
              {k && <span style={{ fontSize: 11, fontWeight: 700, color: k.good ? "#0B6B37" : "#A1282B" }}>{k.delta}</span>}
            </div>
          );
        })}
      </div>

      {/* dense table */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "24px 2.2fr 1fr 0.8fr 0.8fr 1fr 0.8fr", padding: "10px 18px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div /><div>Project</div><div>Owner</div><div>Method</div><div>Health</div><div>Progress</div><div style={{ textAlign: "right" }}>Budget</div>
        </div>
        {d.projects.length === 0 ? (
          <div style={{ padding: "36px 18px", textAlign: "center", color: color.faint3, fontSize: 13 }}>No projects to show.</div>
        ) : d.projects.map((p) => (
          <div key={p.id} onClick={() => onProject(p.id)} style={{ display: "grid", gridTemplateColumns: "24px 2.2fr 1fr 0.8fr 0.8fr 1fr 0.8fr", alignItems: "center", padding: "9px 18px", borderBottom: "1px solid #F4F6FA", cursor: "pointer", fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot(p.status) }} />
            <span style={{ fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 10 }}>{p.name}</span>
            <span style={{ color: color.subtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.owner}</span>
            <span style={{ fontSize: 11.5, color: color.subtle }}>{p.methodology}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: HEALTH_INK[p.status] }}>{p.health}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 7, paddingRight: 14 }}>
              <ProgressBar pct={p.progress} fill={statusDot(p.status)} height={5} />
              <span style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 700, color: color.subtle }}>{p.progress}%</span>
            </div>
            <span style={{ textAlign: "right", fontFamily: font.mono, fontSize: 12, color: color.textMuted }}>{fmtBudget(p.budget)}</span>
          </div>
        ))}
      </Card>

      {/* bottom two-up */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card padding="16px 18px">
          <div style={{ fontFamily: font.head, fontSize: 14, fontWeight: 600, color: color.ink, marginBottom: 12 }}>Demand pipeline</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {PIPELINE_STAGES.map((s) => {
              const count = d.pipeline[s.key]?.count ?? 0;
              return (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12.5, color: color.textMuted, width: 88 }}>{s.label}</span>
                  <ProgressBar pct={(count / pipeMax) * 100} fill={s.color} height={7} />
                  <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.ink, width: 20, textAlign: "right" }}>{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card padding="16px 18px">
          <div style={{ fontFamily: font.head, fontSize: 14, fontWeight: 600, color: color.ink, marginBottom: 12 }}>Needs attention</div>
          {d.attention.length === 0 ? (
            <div style={{ fontSize: 12.5, color: color.faint3 }}>Nothing needs attention.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {d.attention.map((a) => (
                <div key={a.id} onClick={() => onProject(a.id)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.severity === "red" ? "#D13438" : "#E0A100", flex: "none" }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
