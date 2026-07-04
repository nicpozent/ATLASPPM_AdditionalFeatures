import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Modal, Input } from "@/components/ui";
import { CostsModal } from "@/components/CostsModal";

const FIN_SOURCES = [
  { value: "erp", label: "ERP / Finance system" },
  { value: "manual", label: "Manual entry" },
  { value: "jira", label: "Jira (time → cost)" },
  { value: "ado", label: "Azure DevOps" },
  { value: "sdp", label: "ServiceDesk Plus" },
] as const;

interface FinRow {
  id: string; name: string;
  budget: number; spent: number; capex: number; forecast: number; variance: number; roi: number;
  laborDev: number; laborArch: number; laborInfra: number; usedPct: number;
  onTrack?: boolean;
  savings: number; infraCloud: number; devTooling: number; vendor: number;
}

function useFinancials() {
  return useQuery({
    queryKey: ["financials"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<FinRow[]> => { try { return (await api<FinRow[]>("/financials")) ?? []; } catch { return []; } },
  });
}

// Figures are in € thousands — show them as €…k (grouped), not millions.
const fmt = (v: number) => "€" + Math.round(v).toLocaleString() + "k";
const sum = (rows: FinRow[], k: keyof FinRow) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export default function Financials() {
  const { data: rows = [] } = useFinancials();
  const [source, setSource] = useState<string>("erp");
  const [editCost, setEditCost] = useState<{ id: string; name: string } | null>(null);

  const tBudget = sum(rows, "budget");
  const tSpent = sum(rows, "spent");
  const tForecast = sum(rows, "forecast");
  const tCapex = sum(rows, "capex");
  const tOpex = tBudget - tCapex;
  const tSavings = tBudget - tForecast;
  const roiPct = tBudget > 0 ? Math.round(((tSavings) / tBudget) * 100) : 0;
  const capexPct = pctOf(tCapex, tBudget);
  const opexPct = tBudget > 0 ? 100 - capexPct : 0;

  // Cost composition by source — derived from the (editable) role-owned cost lines.
  const cLaborDev = sum(rows, "laborDev"), cLaborArch = sum(rows, "laborArch"), cLaborInfra = sum(rows, "laborInfra");
  const cLabor = cLaborDev + cLaborArch + cLaborInfra;
  const cInfraCloud = sum(rows, "infraCloud"), cDevTooling = sum(rows, "devTooling"), cVendor = sum(rows, "vendor");
  const cTotal = cLabor + cInfraCloud + cDevTooling + cVendor;
  const cw = (v: number) => (cTotal > 0 ? (v / cTotal) * 100 : 0) + "%";

  const kpis: { label: string; value: string; ink: string }[] = [
    { label: "Total budget", value: fmt(tBudget), ink: color.navy },
    { label: "Spent to date", value: fmt(tSpent), ink: color.primary },
    { label: "Forecast at completion", value: fmt(tForecast), ink: color.navy },
    { label: "Savings (benefit)", value: fmt(tSavings), ink: color.successInk },
    { label: "Portfolio ROI", value: roiPct + "%", ink: color.successInk },
  ];

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.subtle }}>Budget vs actual, CapEx/OpEx split, forecast &amp; benefit tracking across the portfolio.</div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#56607A" }}>Source</span>
        <select value={source} onChange={(e) => setSource(e.target.value)} style={{
          border: `1px solid ${color.border2}`, borderRadius: 8, padding: "6px 10px", fontSize: 12.5,
          fontWeight: 600, fontFamily: "inherit", color: color.text, background: "#fff", cursor: "pointer",
        }}>
          {FIN_SOURCES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Button style={{ padding: "9px 14px" }}><Icon name="download" size={16} /> Export</Button>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 18 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, color: color.faint }}>{k.label}</div>
            <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: k.ink, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* CapEx / OpEx split */}
      <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: "20px 22px", marginBottom: 18 }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, marginBottom: 14 }}>CapEx / OpEx split</div>
        <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", marginBottom: 9, background: color.bg }}>
          <div style={{ width: `${capexPct}%`, background: "#0F6CBD" }} />
          <div style={{ width: `${opexPct}%`, background: "#7A3FB0" }} />
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          <span style={legend}><span style={{ ...swatch, background: "#0F6CBD" }} />CapEx {fmt(tCapex)} · {capexPct}%</span>
          <span style={legend}><span style={{ ...swatch, background: "#7A3FB0" }} />OpEx {fmt(tOpex)} · {opexPct}%</span>
        </div>
      </div>

      {/* Cost composition by source */}
      <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: "20px 22px", marginBottom: 18 }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, marginBottom: 14 }}>Cost composition by source</div>
        <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", marginBottom: 9, background: color.bg }}>
          <div style={{ width: cw(cLabor), background: "#0F6CBD" }} />
          <div style={{ width: cw(cInfraCloud), background: "#0E7C7B" }} />
          <div style={{ width: cw(cDevTooling), background: "#7A3FB0" }} />
          <div style={{ width: cw(cVendor), background: "#C98A00" }} />
        </div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
          <span style={legend}><span style={{ ...swatch, background: "#0F6CBD" }} />Internal labor {fmt(cLabor)} <span style={{ color: color.faint3 }}>· Dev {fmt(cLaborDev)} · Arch {fmt(cLaborArch)} · Infra {fmt(cLaborInfra)}</span></span>
          <span style={legend}><span style={{ ...swatch, background: "#0E7C7B" }} />Infra / Cloud (IaaS·PaaS·SaaS) {fmt(cInfraCloud)} <span style={{ color: color.faint3 }}>· Infra Mgr / Service Mgr</span></span>
          <span style={legend}><span style={{ ...swatch, background: "#7A3FB0" }} />Dev tooling (Lic·PaaS·SaaS) {fmt(cDevTooling)} <span style={{ color: color.faint3 }}>· Eng / Developers Mgr</span></span>
          <span style={legend}><span style={{ ...swatch, background: "#C98A00" }} />Vendor {fmt(cVendor)}</span>
        </div>
      </div>

      {/* per-project table */}
      <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, padding: "13px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Project</div><div>Budget</div><div>Spent</div><div>CapEx</div><div>Forecast</div><div>Variance</div><div style={{ textAlign: "right" }}>ROI</div>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: "56px 22px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>No financial data yet. Connect a finance source to populate budgets and actuals.</div>
        ) : rows.map((f) => {
          const usedPct = f.usedPct ?? pctOf(f.spent, f.budget);
          const barColor = usedPct > 100 ? color.danger : usedPct > 85 ? color.warning : color.success;
          const varColor = f.variance < 0 ? color.dangerInk : color.successInk;
          const mono = { fontFamily: font.mono, fontSize: 12.5, color: color.textMuted };
          return (
            <div key={f.id} onClick={() => setEditCost({ id: f.id, name: f.name })} title="Edit cost lines" style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", padding: "13px 22px", borderBottom: "1px solid #F2F4F9", cursor: "pointer" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: color.text }}><span style={{ color: color.successInk, display: "flex" }}><Icon name="coins" size={14} /></span><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span></div>
                <div style={{ fontSize: 10.5, color: color.faint3, marginTop: 3 }}>Labor: Dev {fmt(f.laborDev)} · Arch {fmt(f.laborArch)} · Infra {fmt(f.laborInfra)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
                  <div style={{ flex: 1, height: 5, background: color.bg, borderRadius: 3, overflow: "hidden", maxWidth: 120 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, usedPct)}%`, background: barColor }} />
                  </div>
                  <span style={{ fontSize: 10.5, color: color.faint3 }}>{usedPct}% used</span>
                </div>
              </div>
              <div style={mono}>{fmt(f.budget)}</div>
              <div style={mono}>{fmt(f.spent)}</div>
              <div style={mono}>{fmt(f.capex)}</div>
              <div style={mono}>{fmt(f.forecast)}</div>
              <div style={{ fontFamily: font.mono, fontSize: 12.5, fontWeight: 700, color: varColor }}>{fmt(f.variance)}</div>
              <div style={{ textAlign: "right", fontFamily: font.mono, fontSize: 12.5, fontWeight: 700, color: color.successInk }}>{f.roi}%</div>
            </div>
          );
        })}
      </div>

      {editCost && <CostsModal scope="projects" id={editCost.id} name={editCost.name} onClose={() => setEditCost(null)} />}
    </div>
  );
}

const cols = "1.8fr 0.8fr 0.8fr 0.8fr 0.9fr 0.9fr 0.8fr";
const legend: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: color.textMuted };
const swatch: React.CSSProperties = { width: 10, height: 10, borderRadius: 3, flex: "none" };
