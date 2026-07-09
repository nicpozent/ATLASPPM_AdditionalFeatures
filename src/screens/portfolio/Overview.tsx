import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Card, EmptyBlock, ProgressBar } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { SCREENS } from "@/nav";

// Overall portfolio — Programs, Products, Projects and Releases in one place,
// filterable by category. Reuses the existing list endpoints (empty by default).
type Cat = "all" | "project" | "program" | "product" | "release";
const CATS: { key: Cat; label: string; icon: string }[] = [
  { key: "all", label: "Everything", icon: "layers" },
  { key: "project", label: "Projects", icon: "folder" },
  { key: "program", label: "Programs", icon: "folders" },
  { key: "product", label: "Products", icon: "box" },
  { key: "release", label: "Releases", icon: "rocket" },
];
const TYPE_META: Record<string, { label: string; ink: string; tint: string; icon: string }> = {
  project: { label: "Project", ink: "#7A3FB0", tint: color.accentTint, icon: "folder" },
  program: { label: "Program", ink: color.primaryDark, tint: color.primaryTint2, icon: "folders" },
  product: { label: "Product", ink: color.successInk, tint: color.successTint, icon: "box" },
  release: { label: "Release", ink: color.warningInk, tint: color.warningTint, icon: "rocket" },
};

// Traffic-light + free-text status → a pill colour.
function statusPill(s: string): { ink: string; tint: string; label: string } {
  const k = (s || "").toLowerCase();
  if (k === "green" || k.includes("track") || k === "deployed" || k === "active") return { ink: color.successInk, tint: color.successTint, label: s || "On track" };
  if (k === "amber" || k.includes("risk") || k === "in progress" || k === "planned") return { ink: color.warningInk, tint: color.warningTint, label: s };
  if (k === "red" || k.includes("critical")) return { ink: color.dangerInk, tint: color.dangerTint, label: s };
  if (k === "hold" || k.includes("hold") || k === "cancelled") return { ink: color.subtle, tint: color.bg, label: s };
  if (k === "completed") return { ink: color.primaryDark, tint: color.primaryTint2, label: s };
  return { ink: color.subtle, tint: color.bg, label: s || "—" };
}

interface Item { type: Cat; id: string; name: string; owner: string; dept: string; status: string; progress: number | null; start: string; end: string }

// The subset of fields the four list endpoints share that this view reads.
// Optional because each entity type populates a slightly different set.
interface PortfolioRow {
  id: string; name: string; owner?: string; dept?: string; status?: string;
  progress?: number | null; startDate?: string; target?: string; due?: string;
  endDate?: string; date?: string; archived?: boolean;
}

function useAll<T>(path: string, key: string) {
  return useQuery({ queryKey: [key], retry: false, staleTime: 30_000, queryFn: async (): Promise<T[]> => (await api<T[]>(path)) ?? [] });
}

export default function PortfolioOverview() {
  const navigate = useNavigate();
  const [cat, setCat] = useState<Cat>("all");
  const projects = useAll<PortfolioRow>("/projects", "projects");
  const programs = useAll<PortfolioRow>("/programs", "programs");
  const products = useAll<PortfolioRow>("/products", "products");
  const releases = useAll<PortfolioRow>("/releases", "releases");

  const items: Item[] = useMemo(() => {
    const P = (projects.data ?? []).filter((p) => !p.archived).map((p): Item => ({ type: "project", id: p.id, name: p.name, owner: p.owner ?? "", dept: p.dept ?? "", status: p.status ?? "", progress: p.progress ?? 0, start: p.startDate ?? "", end: p.target ?? p.due ?? "" }));
    const G = (programs.data ?? []).filter((p) => !p.archived).map((p): Item => ({ type: "program", id: p.id, name: p.name, owner: p.owner ?? "", dept: p.dept ?? "", status: p.status ?? "", progress: p.progress ?? null, start: p.startDate ?? "", end: p.endDate ?? "" }));
    const R = (products.data ?? []).map((p): Item => ({ type: "product", id: p.id, name: p.name, owner: p.owner ?? "", dept: p.dept ?? "", status: p.status ?? "", progress: null, start: p.startDate ?? "", end: p.endDate ?? "" }));
    const L = (releases.data ?? []).filter((r) => !r.archived).map((r): Item => ({ type: "release", id: r.id, name: r.name, owner: r.owner ?? "", dept: "", status: r.status ?? "", progress: r.progress ?? null, start: "", end: r.date ?? "" }));
    return [...P, ...G, ...R, ...L];
  }, [projects.data, programs.data, products.data, releases.data]);

  const counts = useMemo(() => ({
    all: items.length,
    project: items.filter((i) => i.type === "project").length,
    program: items.filter((i) => i.type === "program").length,
    product: items.filter((i) => i.type === "product").length,
    release: items.filter((i) => i.type === "release").length,
  }), [items]);

  const shown = cat === "all" ? items : items.filter((i) => i.type === cat);
  const open = (i: Item) => {
    if (i.type === "project") navigate(`${SCREENS.project.path}?id=${i.id}`);
    else if (i.type === "program") navigate(SCREENS.programs.path);
    else if (i.type === "product") navigate(SCREENS.products.path);
    else navigate(SCREENS.releases.path);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {CATS.map((c) => {
          const active = cat === c.key;
          const n = counts[c.key];
          return (
            <button key={c.key} onClick={() => setCat(c.key)} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", padding: "7px 13px", borderRadius: 9, border: `1px solid ${active ? color.primary : color.border}`, background: active ? color.primary : "#fff", color: active ? "#fff" : color.textMuted }}>
              <Icon name={c.icon} size={14} /> {c.label}
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: font.mono, background: active ? "rgba(255,255,255,0.22)" : color.bg, borderRadius: 20, padding: "0 7px" }}>{n}</span>
            </button>
          );
        })}
      </div>

      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2.4fr 1.2fr 1fr 1.2fr 0.9fr", padding: "13px 22px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Type</div><div>Name</div><div>Owner</div><div>Status</div><div>Timeline</div><div>Progress</div>
        </div>
        {shown.length === 0 ? (
          <EmptyBlock minHeight={220} message={items.length === 0 ? "Nothing in the portfolio yet — create a project, program, product or release." : "No items in this category."} />
        ) : shown.map((i) => {
          const tm = TYPE_META[i.type];
          const sp = statusPill(i.status);
          return (
            <div key={`${i.type}-${i.id}`} style={{ display: "grid", gridTemplateColumns: "1.2fr 2.4fr 1.2fr 1fr 1.2fr 0.9fr", alignItems: "center", padding: "13px 22px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
              <div><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: tm.ink, background: tm.tint, padding: "3px 9px", borderRadius: 20 }}><Icon name={tm.icon} size={12} /> {tm.label}</span></div>
              <div style={{ minWidth: 0 }}>
                <button onClick={() => open(i)} style={{ fontSize: 13.5, fontWeight: 600, color: color.primary, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{i.name}</button>
                <div style={{ fontSize: 11, color: color.faint3, fontFamily: font.mono }}>{i.id}{i.dept ? ` · ${i.dept}` : ""}</div>
              </div>
              <div style={{ fontSize: 12.5, color: color.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.owner || "—"}</div>
              <div><span style={{ fontSize: 10.5, fontWeight: 700, color: sp.ink, background: sp.tint, padding: "2px 9px", borderRadius: 20 }}>{sp.label}</span></div>
              <div style={{ fontSize: 11.5, color: color.faint, fontFamily: font.mono }}>{i.start || "—"}{i.end ? ` → ${i.end}` : ""}</div>
              <div>
                {i.progress === null ? <span style={{ fontSize: 12, color: color.faint3 }}>—</span> : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ProgressBar pct={i.progress} height={6} />
                    <span style={{ fontFamily: font.head, fontSize: 12, fontWeight: 700, color: color.ink }}>{i.progress}%</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
