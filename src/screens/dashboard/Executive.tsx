import { color, font, chart, radius } from "@/theme";
import { Icon } from "@/components/Icon";
import { Card, ProgressBar, HealthPill, statusDot } from "@/components/ui";
import { Sparkline, HealthDonut, BudgetChart } from "./charts";
import { PiSummaryCard } from "./PiSummaryCard";
import {
  KPI_DEFS, HEALTH_SEGMENTS, PIPELINE_STAGES, type DashboardData,
} from "./data";

const fmtBudget = (v: number) => "€" + (v / 1000).toFixed(1) + "M";

export function Executive({ d, onProject, onPortfolio }: {
  d: DashboardData; onProject: (id: string) => void; onPortfolio: () => void;
}) {
  const healthTotal = HEALTH_SEGMENTS.reduce((s, seg) => s + (d.health[seg.key]?.value ?? 0), 0);
  const pipeMax = Math.max(1, ...PIPELINE_STAGES.map((s) => d.pipeline[s.key]?.count ?? 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
        {KPI_DEFS.map((def) => {
          const k = d.kpis[def.key];
          return (
            <div key={def.key} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: "16px 17px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 12, color: color.faint, fontWeight: 500 }}>{def.label}</div>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: def.color }} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }}>
                <div style={{ fontFamily: font.head, fontSize: 30, fontWeight: 700, color: k ? color.ink : color.faint3, lineHeight: 1, letterSpacing: "-0.02em" }}>{k?.value ?? "—"}</div>
                <Sparkline points={k?.spark ?? []} stroke={def.color} />
              </div>
              <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: k ? (k.good ? "#0B6B37" : "#A1282B") : color.faint3, background: k ? (k.good ? color.successTint : color.dangerTint) : color.bg, padding: "1px 7px", borderRadius: 20 }}>{k?.delta ?? "—"}</span>
                <span style={{ fontSize: 11.5, color: color.faint3 }}>vs last month</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* main two-column */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 372px", gap: 18, alignItems: "start" }}>
        {/* left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 18 }}>
            {/* health */}
            <Card>
              <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink, marginBottom: 2 }}>Portfolio health</div>
              <div style={{ fontSize: 12, color: color.faint2, marginBottom: 14 }}>Traffic-light status · {healthTotal} active</div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <HealthDonut segments={HEALTH_SEGMENTS.map((s) => ({ value: d.health[s.key]?.value ?? 0, color: s.color }))} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {HEALTH_SEGMENTS.map((s) => (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                    <span style={{ flex: 1, fontSize: 13, color: color.textMuted }}>{s.label}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: color.ink }}>{d.health[s.key]?.value ?? 0}</span>
                  </div>
                ))}
              </div>
            </Card>
            {/* budget */}
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Budget burn</div>
                <div style={{ fontSize: 12, color: color.faint2 }}>€ thousands · YTD</div>
              </div>
              <div style={{ fontSize: 12, color: color.faint2, marginBottom: 8 }}>Planned vs actual spend across the portfolio</div>
              <div style={{ display: "flex", gap: 18, marginBottom: 8 }}>
                <div><div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: d.budget ? color.ink : color.faint3, lineHeight: 1 }}>{d.budget?.allocated ?? "—"}</div><div style={{ fontSize: 11.5, color: color.faint2, marginTop: 3 }}>Allocated</div></div>
                <div><div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: d.budget ? color.primary : color.faint3, lineHeight: 1 }}>{d.budget?.spent ?? "—"}</div><div style={{ fontSize: 11.5, color: color.faint2, marginTop: 3 }}>Spent{d.budget ? ` · ${d.budget.spentPct}%` : ""}</div></div>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <BudgetChart months={d.budget?.months ?? []} planned={d.budget?.planned ?? []} actual={d.budget?.actual ?? []} max={d.budget?.max ?? 1} />
              </div>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.subtle }}><span style={{ width: 18, height: 3, borderRadius: 2, background: color.primary }} />Actual</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.subtle }}><span style={{ width: 18, height: 0, borderTop: `2px dashed ${chart.planned}` }} />Planned</span>
              </div>
            </Card>
          </div>

          {/* active projects table */}
          <Card padding={0} style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "17px 20px 13px" }}>
              <div>
                <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Active projects</div>
                <div style={{ fontSize: 12, color: color.faint2 }}>Live status across all divisions</div>
              </div>
              <button onClick={onPortfolio} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: color.primary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>View portfolio <Icon name="arrowRight" size={14} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.7fr 0.8fr 0.7fr 1.1fr 0.8fr", padding: "0 20px 9px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
              <div>Project</div><div>Method</div><div>Health</div><div>Progress</div><div style={{ textAlign: "right" }}>Budget</div>
            </div>
            {d.projects.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: color.faint3, fontSize: 13 }}>No active projects yet.</div>
            ) : d.projects.slice(0, 6).map((p) => (
              <div key={p.id} onClick={() => onProject(p.id)} style={{ display: "grid", gridTemplateColumns: "1.7fr 0.8fr 0.7fr 1.1fr 0.8fr", alignItems: "center", padding: "13px 20px`, borderBottom: `1px solid ${color.surfaceAlt}`, cursor: `pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusDot(p.status), flex: "none" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono }}>{p.id} · {p.dept}</div>
                  </div>
                </div>
                <div><span style={{ fontSize: 11.5, fontWeight: 600, color: color.textMuted, background: color.bg, padding: "3px 9px", borderRadius: 6 }}>{p.methodology}</span></div>
                <div><HealthPill status={p.status} label={p.health} /></div>
                <div style={{ paddingRight: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ProgressBar pct={p.progress} fill={statusDot(p.status)} />
                    <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.textMuted, width: 34, textAlign: "right" }}>{p.progress}%</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontFamily: font.mono, fontSize: 12.5, color: color.textMuted }}>{fmtBudget(p.budget)}</div>
              </div>
            ))}
          </Card>
        </div>

        {/* right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card padding="18px 19px">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
              <span style={{ color: chart.critical, display: "flex" }}><Icon name="alert" size={18} /></span>
              <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Needs attention</div>
            </div>
            {d.attention.length === 0 ? (
              <div style={{ fontSize: 13, color: color.faint3, padding: "10px 0" }}>Nothing needs attention right now.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {d.attention.map((a) => (
                  <div key={a.id} onClick={() => onProject(a.id)} style={{ border: `1px solid ${color.dangerBorder}`, background: a.severity === "red" ? color.dangerTint : color.surfaceAlt, borderRadius: 11, padding: "11px 12px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.severity === "red" ? chart.critical : chart.atRisk }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: color.text, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#7A6063" }}>{a.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card padding="18px 19px">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
              <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Demand pipeline</div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: color.accent, background: color.accentTint, padding: "2px 9px", borderRadius: 20 }}>
                {PIPELINE_STAGES.reduce((s, st) => s + (d.pipeline[st.key]?.count ?? 0), 0)} open
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {PIPELINE_STAGES.map((s) => {
                const count = d.pipeline[s.key]?.count ?? 0;
                return (
                  <div key={s.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 12.5, color: color.textMuted, fontWeight: 500 }}>{s.label}</span>
                      <span style={{ fontFamily: font.mono, fontSize: 12.5, fontWeight: 700, color: color.ink }}>{count}</span>
                    </div>
                    <ProgressBar pct={(count / pipeMax) * 100} fill={s.color} height={8} />
                  </div>
                );
              })}
            </div>
          </Card>

          <PiSummaryCard />

          <Card padding="18px 19px">
            <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink, marginBottom: 13 }}>Recent activity</div>
            {d.activity.length === 0 ? (
              <div style={{ fontSize: 13, color: color.faint3, padding: "8px 0" }}>No recent activity.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {d.activity.map((ev, i) => (
                  <div key={i} style={{ display: "flex", gap: 11 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: ev.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none", fontFamily: font.head }}>{ev.initials}</div>
                    <div style={{ flex: 1, lineHeight: 1.4 }}>
                      <div style={{ fontSize: 13, color: color.textMuted }}><b style={{ color: color.text }}>{ev.who}</b> {ev.action}</div>
                      <div style={{ fontSize: 11.5, color: color.faint3, marginTop: 1 }}>{ev.time}</div>
                    </div>
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
