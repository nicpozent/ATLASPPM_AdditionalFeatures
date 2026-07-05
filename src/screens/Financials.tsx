import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Input, Modal } from "@/components/ui";
import { toast } from "@/components/Toast";
import { CostsModal, type CostScope } from "@/components/CostsModal";

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
  roiManual?: boolean; scope?: string;
}
interface FinancialsData { scope: string; canEditRoi: boolean; rows: FinRow[]; roiAutoNote: string; roiManualNote: string; }

type FinScope = "project" | "program" | "product";
const SCOPE_TABS: { key: FinScope; label: string; costScope: CostScope }[] = [
  { key: "project", label: "Projects", costScope: "projects" },
  { key: "program", label: "Programs", costScope: "programs" },
  { key: "product", label: "Products", costScope: "products" },
];

function useFinancials(scope: FinScope) {
  return useQuery({
    queryKey: ["financials", scope], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<FinancialsData> => {
      try { return (await api<FinancialsData>(`/financials?scope=${scope}`)) ?? { scope, canEditRoi: false, rows: [], roiAutoNote: "", roiManualNote: "" }; }
      catch { return { scope, canEditRoi: false, rows: [], roiAutoNote: "", roiManualNote: "" }; }
    },
  });
}

// Figures are in € thousands — show them as €…k (grouped), not millions.
const fmt = (v: number) => "€" + Math.round(v).toLocaleString() + "k";
const sum = (rows: FinRow[], k: keyof FinRow) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export default function Financials() {
  const [scope, setScope] = useState<FinScope>("project");
  const { data } = useFinancials(scope);
  const rows = data?.rows ?? [];
  const costScope = SCOPE_TABS.find((t) => t.key === scope)!.costScope;
  const [source, setSource] = useState<string>("erp");
  const [editCost, setEditCost] = useState<{ id: string; name: string } | null>(null);
  const [editRoi, setEditRoi] = useState<FinRow | null>(null);
  const [roiInfo, setRoiInfo] = useState(false);

  const tBudget = sum(rows, "budget");
  const tSpent = sum(rows, "spent");
  const tForecast = sum(rows, "forecast");
  const tCapex = sum(rows, "capex");
  const tOpex = tBudget - tCapex;
  const tBenefit = sum(rows, "savings"); // the savings/benefit line = expected benefit
  const tInvestment = tForecast > 0 ? tForecast : tBudget;
  const roiPct = tInvestment > 0 ? Math.round(((tBenefit - tInvestment) / tInvestment) * 100) : 0;
  const capexPct = pctOf(tCapex, tBudget);
  const opexPct = tBudget > 0 ? 100 - capexPct : 0;

  // Cost composition by source — derived from the (editable) role-owned cost lines.
  const cLaborDev = sum(rows, "laborDev"), cLaborArch = sum(rows, "laborArch"), cLaborInfra = sum(rows, "laborInfra");
  const cLabor = cLaborDev + cLaborArch + cLaborInfra;
  const cInfraCloud = sum(rows, "infraCloud"), cDevTooling = sum(rows, "devTooling"), cVendor = sum(rows, "vendor");
  const cTotal = cLabor + cInfraCloud + cDevTooling + cVendor;
  const cw = (v: number) => (cTotal > 0 ? (v / cTotal) * 100 : 0) + "%";

  const roiLabel = scope === "project" ? "Portfolio ROI" : scope === "program" ? "Programs ROI" : "Products ROI";
  const kpis: { label: string; value: string; ink: string }[] = [
    { label: "Total budget", value: fmt(tBudget), ink: color.navy },
    { label: "Spent to date", value: fmt(tSpent), ink: color.primary },
    { label: "Forecast at completion", value: fmt(tForecast), ink: color.navy },
    { label: "Benefit", value: fmt(tBenefit), ink: color.successInk },
    { label: roiLabel, value: roiPct + "%", ink: roiPct >= 0 ? color.successInk : color.dangerInk },
  ];

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* scope tabs — overall figures for the selected object type */}
      <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2, marginBottom: 14 }}>
        {SCOPE_TABS.map((t) => (
          <button key={t.key} onClick={() => setScope(t.key)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: scope === t.key ? "#fff" : "transparent", color: scope === t.key ? color.primary : "#6A7488", boxShadow: scope === t.key ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>{t.label}</button>
        ))}
      </div>

      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.subtle }}>Budget vs actual, CapEx/OpEx split, forecast at completion &amp; benefit — click a row to edit its cost lines (spent &amp; forecast).</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setRoiInfo(true)} title="How ROI is calculated" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: color.primary, background: color.primaryTint, border: "1px solid #CFE0F4", borderRadius: 8, padding: "6px 11px", cursor: "pointer", fontFamily: "inherit" }}><Icon name="help" size={14} /> ROI method</button>
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
          <div>{SCOPE_TABS.find((t) => t.key === scope)!.label.replace(/s$/, "")}</div><div>Budget</div><div>Spent</div><div>CapEx</div><div>Forecast</div><div>Variance</div><div style={{ textAlign: "right" }}>ROI</div>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: "56px 22px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>No financial data yet. Connect a finance source or add cost lines to populate budgets and actuals.</div>
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
              <div style={{ textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}
                onClick={(e) => { if (data?.canEditRoi) { e.stopPropagation(); setEditRoi(f); } }}
                title={data?.canEditRoi ? "Set / clear a manual ROI" : undefined}>
                {f.roiManual && <span style={{ fontSize: 9, fontWeight: 700, color: "#8A6300", background: "#FBF2D7", borderRadius: 4, padding: "1px 5px", textTransform: "uppercase" }}>Manual</span>}
                <span style={{ fontFamily: font.mono, fontSize: 12.5, fontWeight: 700, color: f.roi >= 0 ? color.successInk : color.dangerInk, cursor: data?.canEditRoi ? "pointer" : "default" }}>{f.roi}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {editCost && <CostsModal scope={costScope} id={editCost.id} name={editCost.name} onClose={() => setEditCost(null)} />}
      {editRoi && <RoiModal scope={scope} row={editRoi} onClose={() => setEditRoi(null)} />}
      {roiInfo && (
        <Modal onClose={() => setRoiInfo(false)} width={520} label="How ROI is calculated">
          <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, marginBottom: 12 }}>How ROI is calculated</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0C5798", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Automatic</div>
          <div style={{ fontSize: 13, color: color.text, lineHeight: 1.55, marginBottom: 16 }}>{data?.roiAutoNote || "ROI = (Benefit − Investment) / Investment × 100."}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8A6300", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Manual</div>
          <div style={{ fontSize: 13, color: color.text, lineHeight: 1.55 }}>{data?.roiManualNote || "A manual value overrides the automatic figure."}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}><Button onClick={() => setRoiInfo(false)}>Got it</Button></div>
        </Modal>
      )}
    </div>
  );
}

// Set or clear a manual ROI override for one entity.
function RoiModal({ scope, row, onClose }: { scope: FinScope; row: FinRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(row.roiManual ? String(row.roi) : "");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["financials"] });
  const set = useMutation({
    mutationFn: (v: number | null) => api(`/financials/${scope}/${row.id}/roi`, { method: "PATCH", body: JSON.stringify({ value: v }) }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toast((e as Error).message, "error"),
  });
  return (
    <Modal onClose={onClose} width={420} label={`ROI · ${row.name}`}>
      <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, marginBottom: 6 }}>Manual ROI · {row.name}</div>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 14 }}>Automatic ROI is <strong>{row.roiManual ? "overridden" : `${row.roi}%`}</strong>. Enter a value to override it, or clear it to return to automatic (benefit vs forecast).</div>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", marginBottom: 5 }}>Manual ROI %</label>
      <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 18" style={{ width: 140, fontFamily: font.mono }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={() => set.mutate(null)} disabled={set.isPending}>Use automatic</Button>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => value.trim() !== "" && set.mutate(Number(value))} disabled={set.isPending || value.trim() === ""}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

const cols = "1.8fr 0.8fr 0.8fr 0.8fr 0.9fr 0.9fr 0.8fr";
const legend: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: color.textMuted };
const swatch: React.CSSProperties = { width: 10, height: 10, borderRadius: 3, flex: "none" };
