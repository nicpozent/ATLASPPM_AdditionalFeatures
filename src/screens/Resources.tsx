import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { Icon } from "@/components/Icon";
import { api } from "@/api";

// ---------------------------------------------------------------------------
// Structural chrome constants (lifted from the prototype's resource builder).
// These define the tab / period / matrix scaffolding — not demo data.
// ---------------------------------------------------------------------------
type ResTab = "capacity" | "byproject" | "byproduct" | "skills";
const RES_TABS: { id: ResTab; label: string }[] = [
  { id: "capacity", label: "By person" },
  { id: "byproject", label: "By project" },
  { id: "byproduct", label: "By product" },
  { id: "skills", label: "Skills matrix" },
];
const PERIODS: { id: string; label: string }[] = [
  { id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" }, { id: "half", label: "Half-year" }, { id: "year", label: "Year" },
];
// Competency dimensions that define the skills-matrix columns.
const SKILLS = ["React", ".NET", "SQL", "Azure", "Security", "UX", "Data Eng", "PM"];

interface Resource {
  name: string; role: string; dept: string; initials: string; color: string;
  opsPct: number; projectPct: number; productPct: number; over?: boolean;
}
function useResources() {
  return useQuery({
    queryKey: ["resources"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Resource[]> => {
      try { return (await api<Resource[]>("/resources")) ?? []; } catch { return []; }
    },
  });
}

const CAP_COLS = "1.7fr 0.6fr 0.6fr 0.6fr 1.1fr 0.6fr 0.6fr";

export default function Resources() {
  const [tab, setTab] = useState<ResTab>("capacity");
  const [period, setPeriod] = useState("week");
  const [person, setPerson] = useState("all");
  const [proj, setProj] = useState("all");
  const { data: resources = [] } = useResources();

  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? "Week";
  const overCount = resources.filter((r) => r.over).length;

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* view tabs + sync badge + over-allocation flag */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2 }}>
          {RES_TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                background: active ? "#fff" : "transparent", color: active ? color.primary : "#6A7488", boxShadow: active ? "0 1px 3px rgba(20,26,60,0.12)" : "none",
              }}>{t.label}</button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#0B6B37", background: "#E7F4EC", padding: "3px 8px", borderRadius: 5, letterSpacing: "0.04em" }}>SYNCED</span>
          <span style={{ fontSize: 12, color: color.faint2 }}>from Entra ID &amp; project allocations</span>
        </div>
        <div style={{ flex: 1 }} />
        {overCount > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "#FBE7E8", padding: "6px 12px", borderRadius: 8 }}>
            <Icon name="alert" size={16} /> {overCount} over-allocated
          </span>
        )}
      </div>

      {/* period selector + filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#56607A" }}>Period:</span>
        <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${color.border3}`, borderRadius: 10, padding: 3, gap: 2, flexWrap: "wrap" }}>
          {PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                padding: "6px 13px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
                background: active ? color.primary : "transparent", color: active ? "#fff" : "#6A7488",
              }}>{p.label}</button>
            );
          })}
        </div>
        <span style={{ fontSize: 12, color: color.faint3 }}>
          Utilisation = Ops % + Project % + Product % · over 100% flags over-allocation. Project % is set in By Project; Product % in By Product.
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#56607A" }}>Filter</span>
        <select value={person} onChange={(e) => setPerson(e.target.value)} style={selectStyle}>
          <option value="all">All people</option>
          {resources.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        {tab === "byproject" && (
          <select value={proj} onChange={(e) => setProj(e.target.value)} style={selectStyle}>
            <option value="all">All projects</option>
          </select>
        )}
      </div>

      {tab === "capacity" && <ByPersonTab resources={resources} periodLabel={periodLabel} />}
      {tab === "byproject" && (
        <EmptyPanel icon="users" title="No project allocations"
          message="People allocated to projects (synced from Entra ID and project info) will appear here, grouped by project with per-person allocation inputs." />
      )}
      {tab === "byproduct" && (
        <EmptyPanel icon="box" title="No product allocations"
          message="Allocate team members to products to plan capacity against the product portfolio." />
      )}
      {tab === "skills" && <SkillsMatrix />}
    </div>
  );
}

// --- BY PERSON: allocation-vs-capacity table ------------------------------
function ByPersonTab({ resources, periodLabel }: { resources: Resource[]; periodLabel: string }) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: CAP_COLS, padding: "13px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
        <div>Resource</div><div>Ops %</div><div>Project %</div><div>Product %</div>
        <div>Utilisation ({periodLabel})</div><div>Allocated</div><div style={{ textAlign: "right" }}>Free</div>
      </div>
      {resources.length === 0 ? (
        <div style={{ padding: "56px 22px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>
          No people synced yet. Resources appear here once directory sync (Entra ID) and project allocations are configured.
        </div>
      ) : resources.map((r) => {
        const util = r.opsPct + r.projectPct + r.productPct;
        const over = util > 100;
        const utilColor = over ? "#D13438" : util >= 85 ? "#E0A100" : "#15A34A";
        return (
          <div key={r.name} style={{ display: "grid", gridTemplateColumns: CAP_COLS, alignItems: "center", padding: "14px 22px", borderBottom: "1px solid #F2F4F9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: r.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: font.head, flex: "none" }}>{r.initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{r.name}</span>
                  {over && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#D13438", background: "#FBE7E8", borderRadius: 5, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}><Icon name="alert" size={14} /> +{util - 100}%</span>}
                </div>
                <div style={{ fontSize: 11.5, color: color.faint3 }}>{r.role} · {r.dept}</div>
              </div>
            </div>
            <div><span style={{ fontFamily: font.mono, fontSize: 12.5, color: color.text }}>{r.opsPct}%</span></div>
            <div><span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: color.primary }}>{r.projectPct}%</span></div>
            <div><span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: "#0E7C7B" }}>{r.productPct}%</span></div>
            <div style={{ paddingRight: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ flex: 1, height: 8, background: color.bg, borderRadius: 4, overflow: "hidden", display: "flex" }}>
                  <div style={{ height: "100%", width: `${Math.min(r.opsPct, 100)}%`, background: "#C7CEDB" }} />
                  <div style={{ height: "100%", width: `${Math.min(r.projectPct, Math.max(0, 100 - r.opsPct))}%`, background: utilColor }} />
                  <div style={{ height: "100%", width: `${Math.min(r.productPct, Math.max(0, 100 - r.opsPct - r.projectPct))}%`, background: "#0E7C7B" }} />
                </div>
                <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: utilColor, width: 42, textAlign: "right" }}>{util}%</span>
              </div>
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 12.5, fontWeight: 700, color: color.text }}>—</div>
            <div style={{ textAlign: "right", fontFamily: font.mono, fontSize: 12.5, color: color.textMuted }}>—</div>
          </div>
        );
      })}
    </div>
  );
}

// --- SKILLS MATRIX --------------------------------------------------------
function SkillsMatrix() {
  const gridCols = `200px repeat(${SKILLS.length},1fr)`;
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "16px 22px 13px" }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Skills &amp; competency matrix</div>
        <div style={{ fontSize: 12, color: color.faint2 }}>Proficiency 0–4 per person · informs allocation &amp; gaps</div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, minWidth: 760, padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.03em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Person</div>
          {SKILLS.map((s) => <div key={s} style={{ textAlign: "center" }}>{s}</div>)}
        </div>
        <div style={{ minWidth: 760, padding: "48px 22px", textAlign: "center", color: color.faint3, fontSize: 13 }}>
          No people synced yet. Competency levels appear here once the team roster loads from the directory.
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, padding: "13px 22px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: color.faint3 }}>Scale:</span>
        <span style={{ fontSize: 11, color: "#566077" }}>0 None</span>
        <span style={{ fontSize: 11, color: "#566077" }}>1–2 Working</span>
        <span style={{ fontSize: 11, color: "#566077" }}>3 Proficient</span>
        <span style={{ fontSize: 11, color: "#566077" }}>4 Expert</span>
      </div>
    </div>
  );
}

// --- Shared empty panel for By project / By product ------------------------
function EmptyPanel({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, padding: "56px 24px", textAlign: "center" }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
        <Icon name={icon} size={22} />
      </div>
      <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>{title}</div>
      <div style={{ fontSize: 13, color: color.faint2, marginTop: 4, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>{message}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  border: `1px solid ${color.border2}`, borderRadius: 8, padding: "6px 10px", fontSize: 12.5,
  fontWeight: 600, fontFamily: "inherit", color: color.text, background: "#fff", cursor: "pointer",
};
