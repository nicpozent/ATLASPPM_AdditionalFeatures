import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { Icon } from "@/components/Icon";
import { api, apiDownload } from "@/api";
import { usePermissions } from "@/components/usePermissions";
import { toast, toastError } from "@/components/Toast";

// ---------------------------------------------------------------------------
// Structural chrome constants (lifted from the prototype's resource builder).
// These define the tab / period / matrix scaffolding — not demo data.
// ---------------------------------------------------------------------------
type ResTab = "capacity" | "byproject" | "byproduct" | "availability" | "skills";
const RES_TABS: { id: ResTab; label: string }[] = [
  { id: "capacity", label: "By person" },
  { id: "byproject", label: "By project" },
  { id: "byproduct", label: "By product" },
  { id: "availability", label: "Availability" },
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
interface AllocRow {
  memberId: number | null; name: string; title: string; alloc: number;
  allocHours?: number; startDate?: string; endDate?: string;
  extAlloc?: number; extHours?: number; extStartDate?: string; extEndDate?: string;
}
interface AllocPatch { alloc?: number; allocHours?: number; startDate?: string; endDate?: string }
interface ByProject { id: string; name: string; canEdit: boolean; members: AllocRow[] }
interface ByProduct { id: string; name: string; members: AllocRow[] }

// Live queries — allocations change on the Products/Team panels, so refresh on
// mount, on focus, and on a light interval so this screen stays current.
const LIVE = { retry: false, staleTime: 0, refetchOnMount: "always" as const, refetchOnWindowFocus: true, refetchInterval: 30_000 };

function useResources() {
  return useQuery({
    queryKey: ["resources"], ...LIVE,
    queryFn: async (): Promise<Resource[]> => {
      try { return (await api<Resource[]>("/resources")) ?? []; } catch { return []; }
    },
  });
}
function useByProject() {
  return useQuery({
    queryKey: ["resources-by-project"], ...LIVE,
    queryFn: async (): Promise<ByProject[]> => {
      try { return (await api<ByProject[]>("/resources/by-project")) ?? []; } catch { return []; }
    },
  });
}
function useByProduct() {
  return useQuery({
    queryKey: ["resources-by-product"], ...LIVE,
    queryFn: async (): Promise<ByProduct[]> => {
      try { return (await api<ByProduct[]>("/resources/by-product")) ?? []; } catch { return []; }
    },
  });
}
interface Unonboarded { name: string; projects: string[] }
function useUnonboarded() {
  return useQuery({
    queryKey: ["resources-unonboarded"], ...LIVE,
    queryFn: async (): Promise<Unonboarded[]> => {
      try { return (await api<Unonboarded[]>("/resources/unonboarded")) ?? []; } catch { return []; }
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
  const { data: byProject = [] } = useByProject();
  const { data: byProduct = [] } = useByProduct();
  const { data: unonboarded = [] } = useUnonboarded();

  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? "Week";
  const overCount = resources.filter((r) => r.over).length;

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {unonboarded.length > 0 && <UnonboardedPanel people={unonboarded} />}
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
        <button
          onClick={() => { const y = new Date().getFullYear(); apiDownload(`/resources/allocation-report.xlsx?period=${period}&from=${y}-01-01&to=${y}-12-31`, `atlas-allocation-${period}.xlsx`); }}
          title={`Download this year's allocation as a colour-graded Excel, bucketed by ${period}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.primary, background: "#fff", border: `1px solid ${color.border2}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>
          <Icon name="download" size={15} /> Export .xlsx
        </button>
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
            {byProject.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {tab === "capacity" && <ByPersonTab resources={resources} periodLabel={periodLabel} person={person} />}
      {tab === "byproject" && <ByProjectTab projects={byProject.filter((p) => proj === "all" || p.id === proj)} person={person} />}
      {tab === "byproduct" && <ByProductTab products={byProduct} person={person} />}
      {tab === "availability" && <AvailabilityTab />}
      {tab === "skills" && <SkillsMatrix />}
    </div>
  );
}

// --- BY PERSON: allocation-vs-capacity table ------------------------------
function ByPersonTab({ resources, periodLabel, person }: { resources: Resource[]; periodLabel: string; person: string }) {
  const shown = person === "all" ? resources : resources.filter((r) => r.name === person);
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: CAP_COLS, padding: "13px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
        <div>Resource</div><div>Ops %</div><div>Project %</div><div>Product %</div>
        <div>Utilisation ({periodLabel})</div><div>Allocated</div><div style={{ textAlign: "right" }}>Free</div>
      </div>
      {shown.length === 0 ? (
        <div style={{ padding: "56px 22px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>
          No people allocated yet. People appear here once they're allocated to a project or product, or synced from Entra ID.
        </div>
      ) : shown.map((r) => {
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
            <div style={{ fontFamily: font.mono, fontSize: 12.5, fontWeight: 700, color: color.text }}>{util}%</div>
            <div style={{ textAlign: "right", fontFamily: font.mono, fontSize: 12.5, color: over ? "#A1282B" : color.textMuted }}>{Math.max(0, 100 - util)}%</div>
          </div>
        );
      })}
    </div>
  );
}

// --- BY PROJECT: projects with their assigned members + editable allocation --
function ByProjectTab({ projects, person }: { projects: ByProject[]; person: string }) {
  const qc = useQueryClient();
  const setAlloc = useMutation({
    mutationFn: ({ memberId, patch }: { memberId: number; patch: AllocPatch }) =>
      api(`/resources/project-members/${memberId}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources-by-project"] });
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
  });
  const shown = projects
    .map((p) => ({ ...p, members: person === "all" ? p.members : p.members.filter((m) => m.name === person) }))
    .filter((p) => p.members.length > 0);
  if (shown.length === 0) {
    return <EmptyPanel icon="users" title="No project allocations"
      message="Attach a team to a project (Portfolio → project → Team) and the people appear here, grouped by project. Set each person's allocation % below." />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {shown.map((p) => (
        <AllocGroup key={p.id} title={p.name} members={p.members} canEdit={p.canEdit}
          onSet={(memberId, patch) => setAlloc.mutate({ memberId, patch })} />
      ))}
    </div>
  );
}

// --- BY PRODUCT: products with their allocated members (read-only here) -------
function ByProductTab({ products, person }: { products: ByProduct[]; person: string }) {
  const shown = products
    .map((p) => ({ ...p, members: person === "all" ? p.members : p.members.filter((m) => m.name === person) }))
    .filter((p) => p.members.length > 0);
  if (shown.length === 0) {
    return <EmptyPanel icon="box" title="No product allocations"
      message="Allocate team members to a product (Products → product → Team) to plan capacity against the product portfolio. Allocations appear here." />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {shown.map((p) => <AllocGroup key={p.id} title={p.name} members={p.members} canEdit={false} />)}
    </div>
  );
}

// Shared card: a titled group of people with their allocation, editable inline
// (% or weekly hours + a date window) when canEdit and the member has an id.
function AllocGroup({ title, members, canEdit, onSet }: {
  title: string; members: AllocRow[]; canEdit: boolean; onSet?: (memberId: number, patch: AllocPatch) => void;
}) {
  const total = members.reduce((s, m) => s + m.alloc, 0);
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${color.bg}` }}>
        <span style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>{title}</span>
        <span style={{ fontSize: 12, color: color.faint2 }}>{members.length} {members.length === 1 ? "person" : "people"} · {total}% allocated</span>
      </div>
      {members.map((m, i) => (
        <AllocMemberRow key={(m.memberId ?? m.name) + String(i)} m={m} canEdit={canEdit} onSet={onSet} />
      ))}
    </div>
  );
}

function AllocMemberRow({ m, canEdit, onSet }: { m: AllocRow; canEdit: boolean; onSet?: (memberId: number, patch: AllocPatch) => void }) {
  const editable = canEdit && !!onSet && m.memberId != null;
  const [open, setOpen] = useState(false);
  const range = m.startDate || m.endDate ? `${m.startDate || "?"} → ${m.endDate || "?"}` : "open-ended";
  return (
    <div style={{ padding: "12px 20px", borderBottom: "1px solid #F2F4F9" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 120px", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{m.name}</div>
          <div style={{ fontSize: 11.5, color: color.faint3 }}>{m.title || "Team member"} · {range}{m.allocHours ? ` · ${m.allocHours}h/wk` : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ flex: 1, height: 8, background: color.bg, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(m.alloc, 100)}%`, background: m.alloc > 100 ? "#D13438" : color.primary, borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          {editable ? (
            <input type="number" min={0} max={100} defaultValue={m.alloc}
              onBlur={(e) => { const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)); if (v !== m.alloc) onSet!(m.memberId!, { alloc: v, allocHours: 0 }); }}
              style={{ width: 70, textAlign: "right", border: `1px solid ${color.border2}`, borderRadius: 8, padding: "6px 8px", fontFamily: font.mono, fontSize: 12.5, color: color.text }} />
          ) : (
            <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: color.textMuted }}>{m.alloc}%</span>
          )}
          {editable && (
            <button onClick={() => setOpen((v) => !v)} title="Edit hours & dates" aria-label="Edit hours & dates"
              style={{ background: "none", border: "none", cursor: "pointer", color: open ? color.primary : color.faint3, padding: 2 }}>
              <Icon name="calendar" size={15} />
            </button>
          )}
        </div>
      </div>
      {open && editable && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, padding: "10px 12px", background: color.surfaceAlt, border: `1px solid ${color.border2}`, borderRadius: 10 }}>
          <label style={{ fontSize: 11, color: color.faint2 }}>Weekly hours (40 = 100%)
            <input type="number" min={0} max={80} defaultValue={m.allocHours || ""} placeholder="—"
              onBlur={(e) => { const h = Math.max(0, Number(e.target.value) || 0); onSet!(m.memberId!, { allocHours: h }); }}
              style={{ display: "block", width: 90, marginTop: 3, border: `1px solid ${color.border2}`, borderRadius: 8, padding: "6px 8px", fontFamily: font.mono, fontSize: 12.5 }} />
          </label>
          <label style={{ fontSize: 11, color: color.faint2 }}>From
            <input type="date" defaultValue={m.startDate || ""} onBlur={(e) => onSet!(m.memberId!, { startDate: e.target.value })}
              style={{ display: "block", marginTop: 3, border: `1px solid ${color.border2}`, borderRadius: 8, padding: "6px 8px", fontSize: 12.5 }} />
          </label>
          <label style={{ fontSize: 11, color: color.faint2 }}>Until
            <input type="date" defaultValue={m.endDate || ""} onBlur={(e) => onSet!(m.memberId!, { endDate: e.target.value })}
              style={{ display: "block", marginTop: 3, border: `1px solid ${color.border2}`, borderRadius: 8, padding: "6px 8px", fontSize: 12.5 }} />
          </label>
        </div>
      )}
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

// --- Not-onboarded assignees (imported from Jira, not in the directory) ------
function UnonboardedPanel({ people }: { people: Unonboarded[] }) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canOnboard = can("cap-users-roles", "E");
  const onboard = useMutation({
    mutationFn: (name: string) => api("/resources/onboard", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: (_r, name) => {
      toast(`${name} onboarded`, "info");
      qc.invalidateQueries({ queryKey: ["resources-unonboarded"] });
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: toastError,
  });
  return (
    <div style={{ background: "#FBF6E8", border: "1px solid #F0DFB0", borderRadius: 14, padding: "14px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: "#C98A00", display: "flex" }}><Icon name="alert" size={17} /></span>
        <span style={{ fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>{people.length} assignee{people.length === 1 ? "" : "s"} not onboarded</span>
        <span style={{ fontSize: 12, color: color.subtle }}>— assigned on tasks (e.g. imported from Jira) but not in the directory.</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {people.map((p) => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: "8px 12px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: color.text, flex: "none" }}>{p.name}</span>
            <span style={{ flex: 1, fontSize: 11.5, color: color.faint2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.projects.join(", ")}</span>
            {canOnboard
              ? <button onClick={() => onboard.mutate(p.name)} disabled={onboard.isPending}
                  style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: color.primary, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", flex: "none" }}>
                  <Icon name="userCheck" size={14} /> Onboard
                </button>
              : <span style={{ fontSize: 11, color: color.faint3, flex: "none" }}>Ask an admin to onboard</span>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: color.faint2, marginTop: 8 }}>
        Onboarding adds them to a manual directory group; re-sync Jira (or reopen the task) and they'll match as a known person.
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

// ---- Availability finder --------------------------------------------------
// Who's free on a date (or across a window), with each person's load broken
// down by the projects/programs/releases/products/ops pulling on them; booked
// absences net them to unavailable. Backed by GET /resources/availability.
interface AvailSlice { type: string; entityId: string; entityName: string; pct: number }
interface AvailRow { name: string; title: string; dept: string; initials: string; color: string; allocated: number; free: number; onLeave: boolean; leaveNote: string; slices: AvailSlice[] }
interface AvailData { on: string; from: string; to: string; people: AvailRow[] }

const SLICE_COLOR: Record<string, string> = {
  project: "#0F6CBD", program: "#7A3FB0", release: "#0E7C7B", product: "#C98A00", ops: "#15A34A",
};
const SLICE_LABEL: Record<string, string> = {
  project: "Projects", program: "Programs", release: "Releases", product: "Products", ops: "Ops",
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

function AvailabilityTab() {
  const [mode, setMode] = useState<"day" | "range">("day");
  const [on, setOn] = useState(todayISO());
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [minFree, setMinFree] = useState(0);

  const qs = mode === "day" ? `on=${on}` : `from=${from}&to=${to}`;
  const { data } = useQuery({
    queryKey: ["availability", mode, on, from, to], retry: false, staleTime: 15_000,
    queryFn: async (): Promise<AvailData> =>
      (await api<AvailData>(`/resources/availability?${qs}`)) ?? { on: "", from: "", to: "", people: [] },
  });
  const people = (data?.people ?? []).filter((p) => p.free >= minFree);
  const freeCount = (data?.people ?? []).filter((p) => p.free >= 50 && !p.onLeave).length;

  const pill = (active: boolean): React.CSSProperties => ({
    padding: "6px 13px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
    fontFamily: "inherit", background: active ? color.primary : "transparent", color: active ? "#fff" : "#6A7488",
  });
  const dateBox: React.CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 8, padding: "6px 9px", fontSize: 12.5, fontFamily: "inherit", color: color.text };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${color.border3}`, borderRadius: 10, padding: 3, gap: 2 }}>
          <button onClick={() => setMode("day")} style={pill(mode === "day")}>On a date</button>
          <button onClick={() => setMode("range")} style={pill(mode === "range")}>Across a window</button>
        </div>
        {mode === "day" ? (
          <input type="date" value={on} onChange={(e) => setOn(e.target.value)} style={dateBox} />
        ) : (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateBox} />
            <span style={{ fontSize: 12, color: color.faint3 }}>→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateBox} />
          </>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#56607A" }}>Min. free</span>
        <select value={minFree} onChange={(e) => setMinFree(Number(e.target.value))} style={selectStyle}>
          {[0, 20, 50, 80, 100].map((v) => <option key={v} value={v}>{v === 0 ? "Any" : `≥ ${v}%`}</option>)}
        </select>
      </div>

      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 12 }}>
        {mode === "range"
          ? "Free = capacity free across the whole window (100% − peak load). Booked time-off marks a person unavailable."
          : "Free = 100% − load on that day. Booked time-off marks a person unavailable."}
        {" "}{freeCount} with ≥50% free.
        <span style={{ marginLeft: 12 }}>
          {Object.keys(SLICE_LABEL).map((k) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginRight: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: SLICE_COLOR[k], display: "inline-block" }} />
              <span style={{ fontSize: 11, color: color.faint2 }}>{SLICE_LABEL[k]}</span>
            </span>
          ))}
        </span>
      </div>

      {people.length === 0 ? (
        <EmptyPanel icon="users" title="No one matches" message="Try a lower minimum-free threshold or a different date." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {people.map((p) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1px solid ${color.border}`, borderRadius: 12, padding: "12px 16px" }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: p.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>{p.initials}</span>
              <div style={{ width: 170, flex: "none", minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: color.faint3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
              </div>
              {/* stacked allocation bar */}
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ display: "flex", height: 16, borderRadius: 5, overflow: "hidden", background: "#EEF1F6", border: `1px solid ${color.border3}` }} title={p.slices.map((s) => `${s.entityName} ${s.pct}%`).join(" · ")}>
                  {p.slices.map((s, i) => (
                    <div key={i} style={{ width: `${Math.min(100, s.pct)}%`, background: SLICE_COLOR[s.type] ?? color.faint2 }} title={`${SLICE_LABEL[s.type] ?? s.type}: ${s.entityName} — ${s.pct}%`} />
                  ))}
                </div>
                {p.slices.length > 0 && (
                  <div style={{ fontSize: 10.5, color: color.faint3, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.slices.map((s) => `${s.entityName} ${s.pct}%`).join(" · ")}
                  </div>
                )}
              </div>
              <div style={{ width: 96, flex: "none", textAlign: "right" }}>
                {p.onLeave ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#A1282B", background: "#FBE7E8", borderRadius: 6, padding: "3px 8px" }}>On leave{p.leaveNote ? ` · ${p.leaveNote}` : ""}</span>
                ) : (
                  <>
                    <span style={{ fontFamily: font.head, fontSize: 18, fontWeight: 700, color: p.free >= 50 ? "#0B6B37" : p.free > 0 ? color.warningAlt : color.faint2 }}>{p.free}%</span>
                    <div style={{ fontSize: 10, color: color.faint3 }}>free</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
