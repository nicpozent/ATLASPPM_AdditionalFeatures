// Extracted from Resources.tsx — capacity insight, staffing finder, my-allocations.
import React from "react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { Icon } from "@/components/Icon";
import { api } from "@/api";
import { usePermissions } from "@/components/usePermissions";
import { useRole } from "@/components/RoleContext";
import { toast, toastError } from "@/components/Toast";

interface CapPerson { name: string; title: string; dept: string; initials: string; color: string; ops: number; project: number; product: number; total: number; free: number; }
interface CapDept { dept: string; headcount: number; capacity: number; allocated: number; loadedPct: number; overCount: number; }
interface CapInsight { headcount: number; totalCapacity: number; totalAllocated: number; loadedPct: number; overCount: number; freeCount: number; unallocatedCount: number; over: CapPerson[]; under: CapPerson[]; byDept: CapDept[]; }
interface StaffCandidate { name: string; title: string; dept: string; initials: string; color: string; level: number; total: number; free: number; }

function Avatar({ initials, color, size = 26 }: { initials: string; color: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 700, flex: "none" }}>{initials}</span>;
}

export function InsightsTab() {
  const { can } = usePermissions();
  const canAlert = can("cap-ops", "E");
  const { data } = useQuery({
    queryKey: ["capacity-insight"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<CapInsight | null> => { try { return await api<CapInsight>("/capacity/insight"); } catch { return null; } },
  });
  const d = data;
  // Manual over-allocation alert run: emits a notification for each newly
  // over-allocated person to everyone who opted into the "Over-allocation" event.
  const runAlerts = useMutation({
    mutationFn: () => api<{ flagged: string[]; count: number }>("/capacity/alerts/run", { method: "POST" }),
    onSuccess: (r) => toast(!r || r.count === 0 ? "No new over-allocations to notify" : `Notified: ${r.flagged.join(", ")}`, "info"),
    onError: toastError,
  });
  const tile = (label: string, value: string | number, accent?: string) => (
    <div style={{ flex: 1, minWidth: 130, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: accent ?? color.ink }}>{value}</div>
      <div style={{ fontSize: 11.5, color: color.faint2, marginTop: 2 }}>{label}</div>
    </div>
  );
  const personRow = (p: CapPerson, right: React.ReactNode) => (
    <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 18px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
      <Avatar initials={p.initials} color={p.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
        <div style={{ fontSize: 11, color: color.faint3 }}>{p.title}{p.dept && p.dept !== "Unassigned" ? ` · ${p.dept}` : ""} · ops {p.ops}% · proj {p.project}% · prod {p.product}%</div>
      </div>
      {right}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Portfolio capacity vs demand */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {tile("People", d?.headcount ?? 0)}
        {tile("Portfolio load", `${d?.loadedPct ?? 0}%`, (d?.loadedPct ?? 0) > 90 ? color.danger : (d?.loadedPct ?? 0) > 75 ? color.warningAlt : "#0B6B37")}
        {tile("Over-allocated", d?.overCount ?? 0, (d?.overCount ?? 0) > 0 ? color.danger : undefined)}
        {tile("≥50% free", d?.freeCount ?? 0, "#0B6B37")}
        {tile("Unallocated", d?.unallocatedCount ?? 0, (d?.unallocatedCount ?? 0) > 0 ? color.warningAlt : undefined)}
      </div>
      {d && d.totalCapacity > 0 && (
        <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: color.faint2, marginBottom: 6 }}>
            <span>Demand vs capacity</span><span>{d.totalAllocated}% of {d.totalCapacity}% capacity</span>
          </div>
          <div style={{ height: 12, borderRadius: 6, background: color.bg, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, d.loadedPct)}%`, background: d.loadedPct > 100 ? color.danger : d.loadedPct > 90 ? color.warningAlt : color.primary }} />
          </div>
        </div>
      )}

      <MyAllocations />

      {/* Over-allocation alerts */}
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", borderBottom: `1px solid ${color.bg}`, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="alert" size={16} /><span style={{ fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>Over-allocated ({d?.over.length ?? 0})</span>
          <div style={{ flex: 1 }} />
          {canAlert && (d?.over.length ?? 0) > 0 && (
            <button
              onClick={() => runAlerts.mutate()}
              disabled={runAlerts.isPending}
              title="Send an over-allocation notification to everyone who opted into that alert"
              style={{
                display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
                color: color.primary, background: "transparent", border: `1px solid ${color.border3}`,
                borderRadius: 8, padding: "6px 11px", cursor: runAlerts.isPending ? "default" : "pointer",
              }}
            >
              <Icon name="bell" size={14} /> {runAlerts.isPending ? "Notifying…" : "Notify now"}
            </button>
          )}
        </div>
        {(d?.over.length ?? 0) === 0
          ? <div style={{ padding: "16px 18px", fontSize: 12.5, color: color.faint3 }}>Nobody is over 100% right now. 👍</div>
          : d!.over.map((p) => personRow(p, <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: color.danger }}>{p.total}%</span>))}
      </div>

      {/* Under-utilised */}
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", borderBottom: `1px solid ${color.bg}` }}><span style={{ fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>Under-utilised (&lt;50%)</span></div>
        {(d?.under.length ?? 0) === 0
          ? <div style={{ padding: "16px 18px", fontSize: 12.5, color: color.faint3 }}>No under-utilised allocated people.</div>
          : d!.under.map((p) => personRow(p, <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: color.successInk }}>{p.free}% free</span>))}
      </div>

      {/* By department */}
      {(d?.byDept.length ?? 0) > 0 && (
        <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "13px 18px", borderBottom: `1px solid ${color.bg}` }}><span style={{ fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>Capacity vs demand by department</span></div>
          {d!.byDept.map((dep) => (
            <div key={dep.dept} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
              <div style={{ width: 150, flex: "none", fontSize: 12.5, fontWeight: 600, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dep.dept}</div>
              <div style={{ flex: 1, height: 9, background: color.bg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, dep.loadedPct)}%`, background: dep.loadedPct > 100 ? color.danger : dep.loadedPct > 90 ? color.warningAlt : color.primary }} />
              </div>
              <div style={{ width: 130, flex: "none", textAlign: "right", fontSize: 11.5, color: color.faint2 }}>
                {dep.headcount}p · <b style={{ color: color.textMuted }}>{dep.loadedPct}%</b>{dep.overCount > 0 ? ` · ${dep.overCount} over` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      <StaffingFinder />
    </div>
  );
}

// Skills-based staffing: find people who have a skill AND have free capacity.
function StaffingFinder() {
  const [skill, setSkill] = useState("");
  const [minFree, setMinFree] = useState(20);
  const [query, setQuery] = useState<{ skill: string; minFree: number } | null>(null);
  const { data } = useQuery({
    queryKey: ["staffing", query?.skill, query?.minFree], enabled: !!query, retry: false,
    queryFn: async (): Promise<{ skill: string; candidates: StaffCandidate[] } | null> => {
      try { return await api(`/capacity/staffing?skill=${encodeURIComponent(query!.skill)}&minFree=${query!.minFree}`); } catch { return null; }
    },
  });
  const skills = useQuery({
    queryKey: ["skill-names"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<{ id: number; name: string }[]> => { try { return (await api<{ id: number; name: string }[]>("/skills")) ?? []; } catch { return []; } },
  });
  const inp: React.CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontFamily: "inherit" };
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "13px 18px", borderBottom: `1px solid ${color.bg}`, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="search" size={16} /><span style={{ fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>Find someone to staff</span>
      </div>
      <div style={{ display: "flex", gap: 10, padding: "14px 18px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ fontSize: 11, color: color.faint2 }}>Skill
          <input list="skill-list" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. Kubernetes" style={{ display: "block", marginTop: 3, ...inp, width: 180 }} />
          <datalist id="skill-list">{(skills.data ?? []).map((s) => <option key={s.id} value={s.name} />)}</datalist>
        </label>
        <label style={{ fontSize: 11, color: color.faint2 }}>Min. free %
          <input type="number" min={0} max={100} value={minFree} onChange={(e) => setMinFree(Number(e.target.value) || 0)} style={{ display: "block", marginTop: 3, ...inp, width: 90 }} />
        </label>
        <button onClick={() => skill.trim() && setQuery({ skill: skill.trim(), minFree })}
          style={{ background: color.primary, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Find people</button>
      </div>
      {query && (
        (data?.candidates.length ?? 0) === 0
          ? <div style={{ padding: "6px 18px 16px", fontSize: 12.5, color: color.faint3 }}>No one rated in “{query.skill}” has ≥{query.minFree}% free (or the skill isn't defined). Add skills & ratings in My Team.</div>
          : data!.candidates.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 18px", borderTop: `1px solid ${color.surfaceAlt}` }}>
              <Avatar initials={c.initials} color={c.color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: color.faint3 }}>{c.title}{c.dept ? ` · ${c.dept}` : ""} · skill level {c.level}/4</div>
              </div>
              <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: c.free >= 50 ? "#0B6B37" : color.warningAlt }}>{c.free}% free</span>
            </div>
          ))
      )}
    </div>
  );
}

// "My allocations": the signed-in identity's current load slices + free capacity.
interface AvailSlice { type: string; entityName: string; pct: number }
interface AvailRow { name: string; title: string; allocated: number; free: number; onLeave: boolean; slices: AvailSlice[] }
function MyAllocations() {
  const { identity } = useRole();
  const me = (identity?.name || "").trim();
  const { data } = useQuery({
    queryKey: ["my-allocations", me], enabled: !!me, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<AvailRow | null> => {
      try {
        const r = await api<{ people: AvailRow[] }>("/resources/availability");
        return r?.people.find((p) => p.name.toLowerCase() === me.toLowerCase()) ?? null;
      } catch { return null; }
    },
  });
  if (!me) return null;
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon name="users" size={15} /><span style={{ fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>My allocations · {me}</span>
        {data && <span style={{ marginLeft: "auto", fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: data.free >= 50 ? "#0B6B37" : data.free > 0 ? color.warningAlt : color.danger }}>{data.onLeave ? "On leave" : `${data.free}% free`}</span>}
      </div>
      {!data || data.slices.length === 0 ? (
        <div style={{ fontSize: 12.5, color: color.faint3 }}>No current allocations for you. (Identity: {me} — allocations match by name.)</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.slices.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
              <span style={{ width: 70, flex: "none", fontSize: 10.5, fontWeight: 600, color: color.faint2, textTransform: "capitalize" }}>{s.type}</span>
              <span style={{ flex: 1, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.entityName}</span>
              <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.textMuted }}>{s.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- SKILLS MATRIX --------------------------------------------------------
