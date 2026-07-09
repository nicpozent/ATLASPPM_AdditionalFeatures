import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { color, font, chart } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/ui";
import { Sparkline, HealthDonut, BudgetChart, Gauge } from "./charts";
import {
  WIDGET_DEFS, DEFAULT_WIDGETS, PIPELINE_STAGES, HEALTH_SEGMENTS,
  type WidgetDef, type DashboardData,
} from "./data";

const LS_KEY = "atlas.customDashboard";
interface Placed { uid: string; key: string; }

function loadWidgets(): Placed[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_WIDGETS.map((key, i) => ({ uid: `w${i}`, key }));
}

// A widget body rendered in its empty state (values arrive from `d` once wired).
function WidgetBody({ wkey, d }: { wkey: string; d: DashboardData }) {
  const empty = (msg: string) => <div style={{ fontSize: 12.5, color: color.faint3, padding: "6px 0" }}>{msg}</div>;
  const kpiTile = (label: string, key: string) => {
    const k = d.kpis[key];
    return (
      <div>
        <div style={{ fontFamily: font.head, fontSize: 28, fontWeight: 700, color: k ? color.ink : color.faint3, lineHeight: 1 }}>{k?.value ?? "—"}</div>
        <div style={{ fontSize: 12, color: color.faint2, marginTop: 5 }}>{label}</div>
      </div>
    );
  };
  switch (wkey) {
    case "health": return <div style={{ display: "flex", justifyContent: "center" }}><HealthDonut segments={HEALTH_SEGMENTS.map((s) => ({ value: d.health[s.key]?.value ?? 0, color: s.color }))} size={130} thickness={20} /></div>;
    case "budget": return <div style={{ display: "flex", justifyContent: "center" }}><BudgetChart months={d.budget?.months ?? []} planned={d.budget?.planned ?? []} actual={d.budget?.actual ?? []} max={d.budget?.max ?? 1} width={380} /></div>;
    case "kpi-active": return kpiTile("Active projects", "active");
    case "kpi-ontrack": return kpiTile("On track", "ontrack");
    case "kpi-risk": return kpiTile("At risk / critical", "risk");
    case "kpi-demands": return kpiTile("Pending demands", "demands");
    case "kpi-budget": return kpiTile("Budget utilised", "budget");
    case "health-trend": return (
      <div>
        <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: color.faint3 }}>—</div>
        <div style={{ display: "flex", justifyContent: "center" }}><Sparkline points={d.kpis.ontrack?.spark ?? []} stroke={chart.onTrack} width={180} height={40} /></div>
        <div style={{ fontSize: 11, color: color.faint3, marginTop: 4 }}>On-track % · last 8 months</div>
      </div>
    );
    case "ontime": return <div style={{ textAlign: "center" }}><Gauge pct={null} stroke={chart.onTrack} /><div style={{ fontSize: 12, color: color.faint2, marginTop: 8 }}>Milestones delivered on time</div></div>;
    case "risk": return (
      <div style={{ display: "flex", gap: 8 }}>
        {[["Risks", "#8A6300", color.warningTint], ["Issues", "#A1282B", color.dangerTint], ["Assump.", "#0C5798", color.primaryTint2], ["Deps", "#5E2E89", color.accentTint]].map(([label, ink, tint]) => (
          <div key={label} style={{ flex: 1, textAlign: "center", background: tint, borderRadius: 10, padding: "10px 4px" }}>
            <div style={{ fontFamily: font.head, fontSize: 22, fontWeight: 700, color: ink }}>0</div>
            <div style={{ fontSize: 10.5, color: ink }}>{label}</div>
          </div>
        ))}
      </div>
    );
    case "pipeline": {
      const max = Math.max(1, ...PIPELINE_STAGES.map((s) => d.pipeline[s.key]?.count ?? 0));
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {PIPELINE_STAGES.map((s) => {
            const c = d.pipeline[s.key]?.count ?? 0;
            return (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: color.textMuted, width: 78 }}>{s.label}</span>
                <ProgressBar pct={(c / max) * 100} fill={s.color} height={7} />
                <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.ink, width: 18, textAlign: "right" }}>{c}</span>
              </div>
            );
          })}
        </div>
      );
    }
    case "projects": return d.projects.length ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {d.projects.slice(0, 5).map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: { green: "#15A34A", amber: "#E0A100", red: "#D13438", hold: "#8A93A6" }[p.status] }} />
            <span style={{ flex: 1, fontWeight: 600, color: color.text }}>{p.name}</span>
            <span style={{ fontFamily: font.mono, color: color.subtle }}>{p.progress}%</span>
          </div>
        ))}
      </div>
    ) : empty("No active projects yet.");
    case "attention": return d.attention.length ? empty("") : empty("Nothing needs attention.");
    case "mytasks": return d.tasks.length ? empty("") : empty("No tasks assigned.");
    case "activity": return d.activity.length ? empty("") : empty("No recent activity.");
    case "milestones": return empty("No upcoming milestones.");
    case "deps": return empty("No projects inheriting risk.");
    case "epics": return empty("No epics yet.");
    case "burndown": return <div style={{ display: "flex", justifyContent: "center" }}><Sparkline points={[]} stroke={color.primary} width={180} height={44} /></div>;
    case "blockers": return empty("No blockers logged.");
    case "capacity": return empty("No resource allocation data.");
    case "by-method": return empty("No project data yet.");
    case "by-phase": return empty("No project data yet.");
    case "spend-div": return empty("No spend recorded.");
    case "budget-table": return empty("No budget data yet.");
    default: return empty("Widget");
  }
}

export function Custom({ d }: { d: DashboardData }) {
  const [widgets, setWidgets] = useState<Placed[]>(loadWidgets);
  const [helpOpen, setHelpOpen] = useState(false);
  const drag = useRef<{ kind: "add" | "move"; key?: string; uid?: string } | null>(null);
  const seq = useRef(0); // monotonic counter for stable, unique widget ids

  // Persist the layout server-side (so it follows the user across devices) and to
  // localStorage as an offline fallback.
  const persist = useCallback((list: Placed[]) => {
    setWidgets(list);
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
    api("/dashboard/custom", { method: "PUT", body: JSON.stringify({ widgets: JSON.stringify(list) }) }).catch(() => { /* offline: localStorage holds it */ });
  }, []);

  // On mount, prefer the server-saved layout (overrides the localStorage/default
  // seed). Silent on failure — the local seed already rendered.
  useEffect(() => {
    let live = true;
    api<{ widgets: string }>("/dashboard/custom").then((r) => {
      if (!live || !r?.widgets) return;
      try {
        const saved = JSON.parse(r.widgets);
        if (Array.isArray(saved)) setWidgets(saved);
      } catch { /* ignore malformed */ }
    }).catch(() => { /* keep local seed */ });
    return () => { live = false; };
  }, []);

  const groups = useMemo(() => {
    const cats: { cat: string; items: WidgetDef[] }[] = [];
    WIDGET_DEFS.forEach((w) => {
      let g = cats.find((c) => c.cat === w.cat);
      if (!g) { g = { cat: w.cat, items: [] }; cats.push(g); }
      g.items.push(w);
    });
    return cats;
  }, []);
  const defOf = (key: string) => WIDGET_DEFS.find((w) => w.key === key);

  const addWidget = (key: string) => persist([...widgets, { uid: `w-${key}-${seq.current++}`, key }]);
  const removeWidget = (uid: string) => persist(widgets.filter((w) => w.uid !== uid));
  const allowDrop = (e: React.DragEvent) => { e.preventDefault(); try { e.dataTransfer.dropEffect = drag.current?.kind === "move" ? "move" : "copy"; } catch { /* */ } };
  const dropOnCanvas = (e: React.DragEvent) => { e.preventDefault(); const dd = drag.current; drag.current = null; if (dd?.kind === "add" && dd.key) addWidget(dd.key); };
  const dropOnWidget = (targetUid: string) => (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); const dd = drag.current; drag.current = null; if (!dd) return;
    const list = [...widgets];
    if (dd.kind === "add" && dd.key) { const i = list.findIndex((x) => x.uid === targetUid); list.splice(i < 0 ? list.length : i, 0, { uid: `w${Date.now()}`, key: dd.key }); }
    else if (dd.kind === "move" && dd.uid) { const from = list.findIndex((x) => x.uid === dd.uid); const to = list.findIndex((x) => x.uid === targetUid); if (from > -1 && to > -1 && from !== to) { const [m] = list.splice(from, 1); list.splice(to, 0, m); } }
    persist(list);
  };

  const btn = (label: string, onClick: () => void, kind: "ghost" | "danger" = "ghost") => (
    <button onClick={onClick} style={{
      fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
      color: kind === "danger" ? "#A1282B" : color.textMuted, background: kind === "danger" ? color.dangerTint : "#fff",
      border: kind === "danger" ? "none" : `1px solid ${color.border2}`,
    }}>{label}</button>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 248px", gap: 18, alignItems: "start" }}>
      {/* canvas */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button onClick={() => setHelpOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: color.primary, background: color.primaryTint, border: `1px solid ${color.primaryTint2}`, padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}><Icon name="help" size={16} /> How it works</button>
          <div style={{ flex: 1 }} />
          {btn("Reset", () => persist(DEFAULT_WIDGETS.map((key, i) => ({ uid: `w${i}`, key }))))}
          {btn("Clear all", () => persist([]), "danger")}
        </div>

        {helpOpen && (
          <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink, marginBottom: 10 }}>Building your own dashboard</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {[
                ["1", <><b style={{ color: color.text }}>Drag</b> a widget from the palette on the right onto the canvas.</>],
                ["2", <><b style={{ color: color.text }}>Reorder</b> by dragging a placed widget onto another. <b style={{ color: color.text }}>Remove</b> with the × on its header.</>],
                ["3", <><b style={{ color: color.text }}>Reset</b> restores the default set; <b style={{ color: color.text }}>Clear all</b> empties the canvas. Your layout is saved to this view.</>],
              ].map(([n, txt]) => (
                <div key={n as string} style={{ display: "flex", gap: 11 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: color.primaryTint, color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontFamily: font.head, flex: "none" }}>{n}</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, color: color.subtle }}>{txt}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {widgets.length === 0 ? (
          <div onDragOver={allowDrop} onDrop={dropOnCanvas} style={{ border: `2px dashed #C7D2E2`, borderRadius: 16, padding: "60px 20px", textAlign: "center", background: color.surfaceAlt }}>
            <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.faint, marginBottom: 5 }}>Your dashboard is empty</div>
            <div style={{ fontSize: 13, color: color.faint3 }}>Drag widgets from the palette, or click one to add it.</div>
          </div>
        ) : (
          <div onDragOver={allowDrop} onDrop={dropOnCanvas} style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, minHeight: 120 }}>
            {widgets.map((w) => {
              const def = defOf(w.key);
              if (!def) return null;
              return (
                <div key={w.uid} draggable onDragStart={(e) => { drag.current = { kind: "move", uid: w.uid }; try { e.dataTransfer.effectAllowed = "move"; } catch { /* */ } }} onDragOver={allowDrop} onDrop={dropOnWidget(w.uid)}
                  style={{ gridColumn: `span ${def.span}`, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: `1px solid ${color.bg}`, cursor: "grab" }}>
                    <span style={{ display: "flex", color: color.faint3 }}><Icon name="gripDots" size={13} /></span>
                    <span style={{ flex: 1, fontFamily: font.head, fontSize: 13.5, fontWeight: 600, color: color.ink }}>{def.title}</span>
                    <button onClick={() => removeWidget(w.uid)} title="Remove" style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${color.border3}`, background: color.surface, color: color.faint3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, lineHeight: 1 }}>×</button>
                  </div>
                  <div style={{ padding: 14, flex: 1 }}><WidgetBody wkey={w.key} d={d} /></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* palette */}
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 15, position: "sticky", top: 0 }}>
        <div style={{ fontFamily: font.head, fontSize: 13.5, fontWeight: 600, color: color.ink, marginBottom: 3 }}>Widget palette</div>
        <div style={{ fontSize: 11.5, color: color.faint3, marginBottom: 13 }}>Drag onto the canvas →</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 560, overflowY: "auto" }}>
          {groups.map((g) => (
            <div key={g.cat}>
              <div style={{ fontSize: 10, fontWeight: 700, color: color.faint3, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>{g.cat}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {g.items.map((w) => (
                  <div key={w.key} draggable onClick={() => addWidget(w.key)}
                    onDragStart={(e) => { drag.current = { kind: "add", key: w.key }; try { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", w.key); } catch { /* */ } }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", border: `1px solid ${color.border}`, borderRadius: 10, cursor: "grab", background: color.surfaceAlt }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: color.primaryTint, color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name={w.icon} size={16} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.title}</div>
                      <div style={{ fontSize: 10.5, color: color.faint3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.desc}</div>
                    </div>
                    <span style={{ color: "#C2C8D4", display: "flex" }}><Icon name="plus" size={16} /></span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
