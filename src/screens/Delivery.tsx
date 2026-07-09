import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Card, EmptyBlock } from "@/components/ui";

// ---- data ----------------------------------------------------------------
type Period = "weekly" | "monthly" | "quarterly" | "half" | "yearly";

type DeliveryStats = {
  completed: number; inProgress: number; planned: number;
  velocity: number; velTrend: string; onTime: number;
  blockersCleared: number; blockersOpen: number; milestones: number;
  budgetBurn: string; spendPct: number; satisfaction: string;
  costPerDeliverable: string; valuePerEuro: string;
};

// Empty by default (no backend) — renders zeroed KPIs inside the real layout.
function useDelivery() {
  return useQuery({
    queryKey: ["delivery"], retry: false, staleTime: 60000,
    queryFn: async () => {
      try { return (await api<Partial<Record<Period, DeliveryStats>>>("/delivery")) ?? {}; }
      catch { return {}; }
    },
  });
}

type SpilloverSummary = { total: number; projects: number; byProject: { id: string; name: string; count: number }[] };
function useSpillover() {
  return useQuery({
    queryKey: ["spillover-summary"], retry: false, staleTime: 30000,
    queryFn: async (): Promise<SpilloverSummary> =>
      (await api<SpilloverSummary>("/spillover")) ?? { total: 0, projects: 0, byProject: [] },
  });
}

type OpItem = { id: number; severity: string; status: string; type: string; projectId: string | null; projectName: string | null };
function useOperational() {
  return useQuery({
    queryKey: ["operational-all"], retry: false, staleTime: 30000,
    queryFn: async (): Promise<OpItem[]> => (await api<OpItem[]>("/operational")) ?? [],
  });
}
const opActive = (s: string) => s === "Open" || s === "In progress";

const PERIODS: { key: Period; label: string; report: string }[] = [
  { key: "weekly", label: "Weekly", report: "This week" },
  { key: "monthly", label: "Monthly", report: "This month" },
  { key: "quarterly", label: "Quarterly", report: "This quarter" },
  { key: "half", label: "Half-year", report: "This half-year" },
  { key: "yearly", label: "Yearly", report: "Year to date" },
];

const dash = "—";
const num = (v: number | undefined) => (v == null ? dash : String(v));
const pct = (part: number | undefined, total: number) =>
  total > 0 && part != null ? Math.round((part / total) * 100) : 0;

// ---- pill tab helpers ----------------------------------------------------
function pillBar(children: React.ReactNode) {
  return (
    <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2, flexWrap: "wrap" }}>
      {children}
    </div>
  );
}
function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 15px", borderRadius: 8, border: "none", cursor: "pointer",
      fontSize: 13, fontWeight: 600, fontFamily: "inherit",
      background: active ? "#fff" : "transparent", color: active ? color.primary : "#565F73",
      boxShadow: active ? "0 1px 3px rgba(20,26,60,0.12)" : "none",
    }}>{children}</button>
  );
}

function StatCard({ label, value, sub, valueColor = color.navy }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; valueColor?: string;
}) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 17 }}>
      <div style={{ fontSize: 12, color: color.faint }}>{label}</div>
      <div style={{ fontFamily: font.head, fontSize: 30, fontWeight: 700, color: valueColor, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: color.faint3, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function Delivery() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [view, setView] = useState<"delivery" | "cfo">("delivery");
  const { data = {} } = useDelivery();
  const { data: spill } = useSpillover();
  const { data: ops = [] } = useOperational();
  const opsActiveItems = ops.filter((o) => opActive(o.status));
  const opsHigh = opsActiveItems.filter((o) => o.severity === "Critical" || o.severity === "High").length;
  const opsProjects = new Set(opsActiveItems.map((o) => o.projectId).filter(Boolean)).size;

  const meta = PERIODS.find((p) => p.key === period)!;
  const dd = data[period];
  const total = dd ? dd.completed + dd.inProgress + dd.planned : 0;
  const completedPct = pct(dd?.completed, total);
  const inProgressPct = pct(dd?.inProgress, total);
  const plannedPct = pct(dd?.planned, total);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* period tab bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {pillBar(PERIODS.map((p) => (
          <PillBtn key={p.key} active={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</PillBtn>
        )))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: color.faint }}>
          Reporting period · <b style={{ color: color.text }}>{meta.report}</b>
        </div>
      </div>

      {/* view tabs */}
      <div style={{ marginBottom: 18 }}>
        {pillBar((["delivery", "cfo"] as const).map((v) => (
          <PillBtn key={v} active={view === v} onClick={() => setView(v)}>{v === "delivery" ? "Delivery" : "CFO view"}</PillBtn>
        )))}
      </div>

      {view === "cfo" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, alignItems: "start", marginBottom: 18 }}>
          <Card>
            <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, marginBottom: 2 }}>Deliverables vs spend over time</div>
            <div style={{ fontSize: 12, color: color.faint2, marginBottom: 14 }}>Cumulative items delivered against cumulative cost — {meta.report}</div>
            <EmptyBlock message="No delivery data for this period yet." minHeight={220} />
            <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.textMuted }}>
                <span style={{ width: 16, height: 3, borderRadius: 2, background: "#15A34A" }} />Deliverables (cumulative)
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.textMuted }}>
                <span style={{ width: 16, height: 0, borderTop: "2px dashed #C24A1F" }} />Spend €M (cumulative)
              </span>
            </div>
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 17 }}>
              <div style={{ fontSize: 12, color: color.faint }}>Cost per deliverable</div>
              <div style={{ fontFamily: font.head, fontSize: 28, fontWeight: 700, color: color.navy, marginTop: 4 }}>{dd?.costPerDeliverable ?? dash}</div>
              <div style={{ fontSize: 11.5, color: color.faint3, marginTop: 3 }}>vs prior period</div>
            </div>
            <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 17 }}>
              <div style={{ fontSize: 12, color: color.faint }}>Spend to date</div>
              <div style={{ fontFamily: font.head, fontSize: 28, fontWeight: 700, color: color.navy, marginTop: 4 }}>{dd?.budgetBurn ?? dash}</div>
              <div style={{ fontSize: 11.5, color: color.faint3, marginTop: 3 }}>{dd ? `${dd.spendPct}% of plan` : "— of plan"}</div>
            </div>
            <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 17 }}>
              <div style={{ fontSize: 12, color: color.faint }}>Value delivered / € spent</div>
              <div style={{ fontFamily: font.head, fontSize: 28, fontWeight: 700, color: color.successInk, marginTop: 4 }}>{dd?.valuePerEuro ?? dash}</div>
              <div style={{ fontSize: 11.5, color: color.faint3, marginTop: 3 }}>Benefit-to-cost ratio</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* KPI band */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
            <StatCard label="Tasks completed" value={num(dd?.completed)} valueColor={color.successInk} sub={`${completedPct}% of period scope`} />
            <StatCard label="In progress" value={num(dd?.inProgress)} valueColor={color.primary} sub={`${inProgressPct}% active now`} />
            <StatCard label="On-time delivery" value={dd ? `${dd.onTime}%` : dash} sub={`Milestones hit: ${num(dd?.milestones)}`} />
            <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 17 }}>
              <div style={{ fontSize: 12, color: color.faint }}>Velocity</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 4 }}>
                <span style={{ fontFamily: font.head, fontSize: 30, fontWeight: 700, color: color.navy }}>{num(dd?.velocity)}</span>
                {dd?.velTrend && <span style={{ fontSize: 12, fontWeight: 700, color: color.successInk }}>{dd.velTrend}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: color.faint3, marginTop: 3 }}>pts / sprint avg</div>
            </div>
          </div>

          {/* Sprint spillover — live across the portfolio (tasks past their baseline). */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: (spill?.total ?? 0) > 0 ? "#FDF8E9" : color.surface, border: `1px solid ${(spill?.total ?? 0) > 0 ? "#F0E4B8" : color.border}`, borderRadius: 14, padding: "14px 18px", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, flex: "none" }}>
              <span style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: (spill?.total ?? 0) > 0 ? "#8A6300" : color.ink }}>{spill?.total ?? 0}</span>
              <span style={{ fontSize: 12.5, color: color.faint }}>tasks spilled over{spill && spill.projects > 0 ? ` · ${spill.projects} project${spill.projects === 1 ? "" : "s"}` : ""}</span>
            </div>
            <div style={{ flex: 1, minWidth: 200, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(spill?.byProject ?? []).slice(0, 5).map((p) => (
                <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#8A6300", background: "#FBF2D7", border: "1px solid #F0E4B8", borderRadius: 20, padding: "3px 11px" }}>
                  {p.name} <span style={{ fontFamily: font.mono, fontWeight: 700 }}>{p.count}</span>
                </span>
              ))}
              {(!spill || spill.total === 0) && <span style={{ fontSize: 12, color: color.faint3 }}>No tasks are past their baselined sprint.</span>}
            </div>
          </div>

          {/* Operational deviations — active ops work impacting delivery, portfolio-wide. */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: opsHigh > 0 ? "#FDEEEF" : color.surface, border: `1px solid ${opsHigh > 0 ? "#F3C9CB" : color.border}`, borderRadius: 14, padding: "14px 18px", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, flex: "none" }}>
              <span style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: opsHigh > 0 ? "#A1282B" : color.ink }}>{opsActiveItems.length}</span>
              <span style={{ fontSize: 12.5, color: color.faint }}>active operational item{opsActiveItems.length === 1 ? "" : "s"}{opsProjects > 0 ? ` · ${opsProjects} project${opsProjects === 1 ? "" : "s"}` : ""}</span>
            </div>
            <div style={{ flex: 1, minWidth: 200, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {opsHigh > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#A1282B", background: "#FBE7E8", border: "1px solid #F3C9CB", borderRadius: 20, padding: "3px 11px" }}>{opsHigh} high / critical</span>}
              {["Incident", "Change", "Maintenance"].map((t) => {
                const n = opsActiveItems.filter((o) => o.type === t).length;
                return n > 0 ? <span key={t} style={{ fontSize: 11.5, fontWeight: 600, color: color.textMuted, background: color.bg, borderRadius: 20, padding: "3px 11px" }}>{t} <span style={{ fontFamily: font.mono, fontWeight: 700 }}>{n}</span></span> : null;
              })}
              {opsActiveItems.length === 0 && <span style={{ fontSize: 12, color: color.faint3 }}>No active operational items affecting delivery.</span>}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* work breakdown */}
              <Card>
                <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, marginBottom: 4 }}>Work breakdown</div>
                <div style={{ fontSize: 12, color: color.faint2, marginBottom: 16 }}>Completed vs in-progress vs planned — {meta.report}</div>
                <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", marginBottom: 14, background: color.bg }}>
                  <div style={{ width: `${completedPct}%`, background: "#15A34A" }} />
                  <div style={{ width: `${inProgressPct}%`, background: "#0F6CBD" }} />
                  <div style={{ width: `${plannedPct}%`, background: "#C7CEDB" }} />
                </div>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                  {[
                    ["#15A34A", "Completed", dd?.completed],
                    ["#0F6CBD", "In progress", dd?.inProgress],
                    ["#C7CEDB", "Planned", dd?.planned],
                  ].map(([c, lbl, v]) => (
                    <span key={lbl as string} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: color.textMuted }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: c as string }} />{lbl} · {num(v as number | undefined)}
                    </span>
                  ))}
                </div>
              </Card>
              {/* throughput */}
              <Card>
                <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, marginBottom: 2 }}>Throughput &amp; capacity</div>
                <div style={{ fontSize: 12, color: color.faint2, marginBottom: 12 }}>Items delivered (bars) vs allocated resources (line) over time</div>
                <EmptyBlock message="No throughput data for this period yet." minHeight={160} />
                <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.textMuted }}>
                    <span style={{ width: 12, height: 10, borderRadius: 2, background: "#0F6CBD" }} />Throughput
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.textMuted }}>
                    <span style={{ width: 16, height: 3, borderRadius: 2, background: "#E0A100" }} />Allocated resources
                  </span>
                </div>
              </Card>
            </div>
            {/* right rail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Card padding={19}>
                <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, marginBottom: 13 }}>Blockers</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1, textAlign: "center", background: "#E7F4EC", borderRadius: 11, padding: "13px 4px" }}>
                    <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: color.successInk }}>{num(dd?.blockersCleared)}</div>
                    <div style={{ fontSize: 11, color: color.successInk }}>Cleared</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", background: "#FBE7E8", borderRadius: 11, padding: "13px 4px" }}>
                    <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: color.dangerInk }}>{num(dd?.blockersOpen)}</div>
                    <div style={{ fontSize: 11, color: color.dangerInk }}>Still open</div>
                  </div>
                </div>
              </Card>
              <Card padding={19}>
                <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, marginBottom: 13 }}>Budget</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: color.navy }}>{dd?.budgetBurn ?? dash}</span>
                  <span style={{ fontSize: 12, color: color.faint2 }}>spent · {dd ? `${dd.spendPct}%` : dash}</span>
                </div>
                <div style={{ height: 8, background: color.bg, borderRadius: 5, overflow: "hidden", marginTop: 10 }}>
                  <div style={{ height: "100%", width: `${dd?.spendPct ?? 0}%`, background: "#E0A100" }} />
                </div>
              </Card>
              <Card padding={19}>
                <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, marginBottom: 6 }}>Stakeholder sentiment</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                  <span style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: color.navy }}>{dd?.satisfaction ?? dash}</span>
                  <span style={{ fontSize: 12, color: color.faint2 }}>/ 5.0 avg</span>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
