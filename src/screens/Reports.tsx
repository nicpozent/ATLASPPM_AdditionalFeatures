import { useState } from "react";
import { color, font, radius } from "@/theme";
import { Icon } from "@/components/Icon";
import { api } from "@/api";
import { toast } from "@/components/Toast";
import { DEPARTMENTS } from "@/departments";

// ============================================================================
//  Reports — branded (Birgma · Biltema) exports built from live portfolio data.
//  Each report type is composed from the real API data into a titled table, then
//  rendered to the chosen format: HTML (download), PDF (print-ready window),
//  Excel (CSV) or a print-ready one-pager for slides. No fabricated content —
//  an empty portfolio yields an empty report with its headers intact.
// ============================================================================
interface ReportType { key: string; name: string; desc: string; icon: string }
const REPORT_TYPES: ReportType[] = [
  { key: "portfolio", name: "Portfolio status report", desc: "Health, budget & milestones across all projects", icon: "layers" },
  { key: "demand", name: "Demand funnel report", desc: "Intake, scoring & stage conversion", icon: "inbox" },
  { key: "blocker", name: "Blocker & risk report", desc: "Active impediments and RAID exposure", icon: "alert" },
  { key: "resource", name: "Resource & capacity report", desc: "Allocation & utilisation by team", icon: "users" },
  { key: "deptspend", name: "Allocation & expenditure by department", desc: "Headcount, utilisation & spend per owning department", icon: "building" },
  { key: "audit", name: "Audit & compliance report", desc: "Access, changes & sign-offs", icon: "shield" },
];

interface Fmt { key: string; label: string; icon: string; tint: string; ink: string }
const FORMATS: Fmt[] = [
  { key: "pptx", label: "Slides", icon: "barChart", tint: "#FBEDE6", ink: "#C24A1F" },
  { key: "pdf", label: "PDF", icon: "book", tint: "#FCEDED", ink: "#C0303A" },
  { key: "xlsx", label: "Excel", icon: "sheet", tint: "#E7F4EC", ink: "#0B6B37" },
  { key: "html", label: "HTML", icon: "globe", tint: "#E6EFFB", ink: color.primary },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATUS_LABEL: Record<string, string> = { green: "On track", amber: "At risk", red: "Critical", hold: "On hold", completed: "Completed" };
const STAGE_LABEL: Record<string, string> = { draft: "Draft", backlog: "Backlog", approved: "Approved", progress: "In progress", hold: "On hold" };

interface Report { title: string; columns: string[]; rows: string[][]; summary: string; }

interface RProject { id: string; name: string; dept: string; owner: string; methodology: string; status: string; health: string; progress: number; budget: number; spent: number; target: string }
interface RDemand { id: string; title: string; stage: string; priority: string; value: number; effort: number; requester: string; dept: string; date: string }
interface RBlocker { id: string; title: string; projectName: string; owner: string; status: string }
interface RResource { name: string; role: string; dept: string; opsPct: number; projectPct: number; productPct: number; over: boolean }
interface RProgram { id: string; dept: string; spent: number }
interface RAudit { at: string; actor: string; role: string; category: string; action: string; target: string }

// Compose a report from live API data. Errors bubble to the caller's toast.
async function buildReport(type: string): Promise<Report> {
  switch (type) {
    case "portfolio": {
      const ps = (await api<RProject[]>("/projects")) ?? [];
      return {
        title: "Portfolio status report",
        columns: ["ID", "Project", "Department", "Owner", "Method", "Health", "Progress", "Budget (€k)", "Spent (€k)", "Target"],
        rows: ps.map((p) => [p.id, p.name, p.dept, p.owner, p.methodology, STATUS_LABEL[p.status] ?? p.health, `${p.progress}%`, String(p.budget), String(p.spent), p.target || "TBD"]),
        summary: `${ps.length} active projects · ${ps.filter((p) => p.status === "green").length} on track · ${ps.filter((p) => p.status === "red" || p.status === "amber").length} need attention`,
      };
    }
    case "demand": {
      const ds = (await api<RDemand[]>("/demands")) ?? [];
      const byStage = (s: string) => ds.filter((d) => d.stage === s).length;
      return {
        title: "Demand funnel report",
        columns: ["ID", "Title", "Stage", "Priority", "Value", "Effort", "Requester", "Department", "Date"],
        rows: ds.map((d) => [d.id, d.title, STAGE_LABEL[d.stage] ?? d.stage, d.priority, String(d.value), String(d.effort), d.requester, d.dept, d.date]),
        summary: `${ds.length} demands · Draft ${byStage("draft")} · Backlog ${byStage("backlog")} · Approved ${byStage("approved")} · In progress ${byStage("progress")}`,
      };
    }
    case "blocker": {
      const bs = (await api<RBlocker[]>("/blockers")) ?? [];
      return {
        title: "Blocker & risk report",
        columns: ["ID", "Blocker", "Project", "Owner", "Status"],
        rows: bs.map((b) => [b.id, b.title, b.projectName, b.owner, b.status]),
        summary: `${bs.length} blockers · ${bs.filter((b) => b.status === "Active").length} active · ${bs.filter((b) => b.status === "Resolved").length} resolved`,
      };
    }
    case "resource": {
      const rs = (await api<RResource[]>("/resources")) ?? [];
      return {
        title: "Resource & capacity report",
        columns: ["Name", "Role", "Department", "Operations %", "Project %", "Product %", "Utilisation %", "Over-allocated"],
        rows: rs.map((r) => [r.name, r.role, r.dept, String(r.opsPct), String(r.projectPct), String(r.productPct), String(r.opsPct + r.projectPct + r.productPct), r.over ? "Yes" : "No"]),
        summary: `${rs.length} people · ${rs.filter((r) => r.over).length} over 100% allocated`,
      };
    }
    case "deptspend": {
      const [rs, ps, pgs] = await Promise.all([
        api<RResource[]>("/resources").then((x) => x ?? []),
        api<RProject[]>("/projects").then((x) => x ?? []),
        api<RProgram[]>("/programs").then((x) => x ?? []),
      ]);
      // Union of departments seen across resources, projects and programs.
      const depts = Array.from(new Set([
        ...DEPARTMENTS,
        ...rs.map((r) => r.dept), ...ps.map((p) => p.dept), ...pgs.map((p) => p.dept),
      ].map((d) => (d || "").trim()).filter(Boolean)));
      const rows = depts.map((d) => {
        const people = rs.filter((r) => r.dept === d);
        const avgUtil = people.length ? Math.round(people.reduce((s, r) => s + r.opsPct + r.projectPct + r.productPct, 0) / people.length) : 0;
        const projSpend = ps.filter((p) => p.dept === d).reduce((s, p) => s + (p.spent || 0), 0);
        const pgmSpend = pgs.filter((p) => p.dept === d).reduce((s, p) => s + (p.spent || 0), 0);
        return { d, people: people.length, avgUtil, projSpend, pgmSpend, total: projSpend + pgmSpend };
      }).filter((r) => r.people > 0 || r.total > 0);
      const totalSpend = rows.reduce((s, r) => s + r.total, 0);
      const totalPeople = rows.reduce((s, r) => s + r.people, 0);
      return {
        title: "Allocation & expenditure by department",
        columns: ["Department", "People", "Avg utilisation %", "Project spend (€k)", "Program spend (€k)", "Total expenditure (€k)"],
        rows: rows.map((r) => [r.d, String(r.people), String(r.avgUtil), r.projSpend.toLocaleString(), r.pgmSpend.toLocaleString(), r.total.toLocaleString()]),
        summary: `${rows.length} departments · ${totalPeople} people · €${totalSpend.toLocaleString()}k total expenditure`,
      };
    }
    case "audit": {
      const es = (await api<RAudit[]>("/audit")) ?? [];
      return {
        title: "Audit & compliance report",
        columns: ["Timestamp", "Actor", "Role", "Category", "Action", "Target"],
        rows: es.map((e) => [e.at, e.actor, e.role, e.category, e.action, e.target]),
        summary: `${es.length} recorded events`,
      };
    }
    default:
      return { title: "Report", columns: [], rows: [], summary: "" };
  }
}

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function reportHtml(r: Report, slides: boolean): string {
  const today = new Date().toISOString().slice(0, 10);
  const head = `<div style="background:linear-gradient(115deg,#11163A,#0F6CBD);color:#fff;padding:26px 30px;border-radius:14px;margin-bottom:22px">
    <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.8">Birgma · Biltema — Atlas PPM</div>
    <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;margin:6px 0 4px">${esc(r.title)}</div>
    <div style="font-size:13px;opacity:.9">${esc(r.summary)} · Generated ${today}</div></div>`;
  const table = r.rows.length === 0
    ? `<p style="color:#6A7488;font-size:14px">No data for this report yet.</p>`
    : `<table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr>${r.columns.map((c) => `<th style="text-align:left;padding:9px 10px;background:#EEF3FB;color:#11163A;border-bottom:2px solid #0F6CBD">${esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${r.rows.map((row, i) => `<tr style="background:${i % 2 ? "#F8FAFD" : "#fff"}">${row.map((cell) => `<td style="padding:8px 10px;border-bottom:1px solid #EEF1F6;color:#26324A">${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;
  const body = `<div style="font-family:'Public Sans',Arial,sans-serif;max-width:${slides ? 1024 : 900}px;margin:0 auto;padding:28px;color:#141A3C">${head}${table}
    <div style="margin-top:26px;font-size:11px;color:#8A93A6">Atlas PPM · confidential · Birgma Group</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title></head><body style="margin:0;background:#F4F6FB">${body}</body></html>`;
}

function reportCsv(r: Report): string {
  const q = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  return [r.columns.map(q).join(","), ...r.rows.map((row) => row.map(q).join(","))].join("\r\n");
}

function download(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// A real, editable PowerPoint deck — a branded title slide plus the report's
// table (auto-paginated). pptxgenjs is loaded lazily so it stays out of the
// main bundle. Colours mirror reportHtml's branding.
async function reportPptx(r: Report, base: string) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";           // 13.33 × 7.5in (16:9)
  pptx.author = "Atlas PPM";
  pptx.company = "Birgma · Biltema";
  pptx.title = r.title;
  const today = new Date().toISOString().slice(0, 10);

  const cover = pptx.addSlide();
  cover.background = { color: "11163A" };
  cover.addText("BIRGMA · BILTEMA — ATLAS PPM", { x: 0.6, y: 1.7, fontSize: 12, color: "9FB4E6", charSpacing: 3 });
  cover.addText(r.title, { x: 0.6, y: 2.15, w: 12, fontSize: 34, bold: true, color: "FFFFFF", fontFace: "Georgia" });
  cover.addText(`${r.summary} · Generated ${today}`, { x: 0.6, y: 3.4, w: 12, fontSize: 14, color: "C9D6EE" });

  const s = pptx.addSlide();
  s.background = { color: "F4F6FB" };
  s.addText(r.title, { x: 0.4, y: 0.3, fontSize: 18, bold: true, color: "11163A" });
  if (r.rows.length === 0) {
    s.addText("No data for this report yet.", { x: 0.4, y: 1.3, fontSize: 14, color: "6A7488" });
  } else {
    const header = r.columns.map((c) => ({ text: c, options: { bold: true, color: "FFFFFF", fill: { color: "0F6CBD" } } }));
    const rows = r.rows.map((row) => row.map((cell) => ({ text: String(cell ?? ""), options: { color: "26324A" } })));
    s.addTable([header, ...rows], {
      x: 0.4, y: 0.9, w: 12.5, fontSize: 10, valign: "middle", color: "26324A",
      border: { type: "solid", color: "E6EBF3", pt: 1 }, autoPage: true, autoPageRepeatHeader: true,
      autoPageLineWeight: -0.5, newSlideStartY: 0.5,
    });
  }
  s.addText("Atlas PPM · confidential · Birgma Group", { x: 0.4, y: 7.05, fontSize: 9, color: "8A93A6" });

  await pptx.writeFile({ fileName: `${base}.pptx` });
}

async function exportReport(type: string, fmt: string) {
  const r = await buildReport(type);
  const base = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (fmt === "xlsx") { download(`${base}.csv`, "text/csv;charset=utf-8", reportCsv(r)); return; }
  if (fmt === "pptx") { await reportPptx(r, base); return; }
  const html = reportHtml(r, false);
  if (fmt === "html") { download(`${base}.html`, "text/html;charset=utf-8", html); return; }
  if (fmt === "pdf") {
    const w = window.open("", "_blank");
    if (!w) { download(`${base}.html`, "text/html;charset=utf-8", html); return; }
    w.document.write(html); w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }
}

export default function Reports() {
  const [month, setMonth] = useState("Jul");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (type: string, fmt: string) => {
    const key = `${type}:${fmt}`;
    setBusy(key);
    try { await exportReport(type, fmt); toast(`Report generated (${fmt.toUpperCase()}).`, "info"); }
    catch (e) { toast(`Couldn't generate the report: ${(e as Error).message}`, "error"); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ background: "linear-gradient(115deg,#11163A,#0F6CBD)", borderRadius: radius.xxl, padding: "22px 26px", marginBottom: 22, color: "#fff" }}>
        <div style={{ fontFamily: font.head, fontSize: 19, fontWeight: 600 }}>Pull a report</div>
        <div style={{ fontSize: 13.5, color: "#C9D6EE", marginTop: 4 }}>Generate branded reports (Birgma · Biltema) from live portfolio data — Slides, PDF, Excel or HTML.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
        {REPORT_TYPES.map((r) => (
          <div key={r.key} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: 19 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
              <span style={{ width: 42, height: 42, borderRadius: 11, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Icon name={r.icon} size={20} />
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: color.ink }}>{r.name}</div>
                <div style={{ fontSize: 12.5, color: color.faint2 }}>{r.desc}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
              {FORMATS.map((f) => {
                const key = `${r.key}:${f.key}`;
                const loading = busy === key;
                return (
                  <button
                    key={f.key}
                    onClick={() => run(r.key, f.key)}
                    disabled={!!busy}
                    title={`Generate ${r.name} as ${f.label}`}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", border: `1px solid ${color.border}`, background: loading ? "#F6FAFE" : "#fff", borderRadius: 9, cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy && !loading ? 0.6 : 1 }}
                    onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.borderColor = color.primary; e.currentTarget.style.background = "#F6FAFE"; } }}
                    onMouseLeave={(e) => { if (!busy) { e.currentTarget.style.borderColor = color.border; e.currentTarget.style.background = "#fff"; } }}
                  >
                    <span style={{ width: 26, height: 26, borderRadius: 7, background: f.tint, color: f.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name={loading ? "sync" : f.icon} size={15} />
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: color.textMuted }}>{loading ? "…" : f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly project report */}
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xxl, marginTop: 22, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid #EEF1F6", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>Monthly portfolio report</div>
            <div style={{ fontSize: 12.5, color: color.faint2 }}>Projects, blockers &amp; demand pipeline — a single-file snapshot</div>
          </div>
          <select value={month} onChange={(e) => setMonth(e.target.value)} style={selStyle}>
            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={() => run("portfolio", "html")} disabled={!!busy} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "8px 13px", borderRadius: 8, cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.7 : 1 }}>
            <Icon name="download" size={16} /> Export snapshot
          </button>
        </div>
        <div style={{ padding: "20px 22px", fontSize: 13, color: color.faint2 }}>
          Pick a report type above and a format to download or print it. Reports are generated from the current live data — an empty portfolio produces an empty report with its column headers intact.
        </div>
      </div>
    </div>
  );
}

const selStyle: React.CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", color: color.text, background: "#fff", cursor: "pointer" };
