import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Input, Select, RowMenu, MenuItem, MenuDivider } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { CostsModal } from "@/components/CostsModal";
import { SubscribeButton } from "@/components/SubscribeButton";
import { Overlay } from "./Demands";

type Health = "green" | "amber" | "red" | "hold";
type PowInt = "High" | "Low";

interface Program {
  id: string; name: string; owner: string; goal: string; status: string;
  projects: string[]; budget: number; spent: number; progress: number; health: Health; startDate?: string; endDate?: string; archived?: boolean;
}
interface NewProgram { name: string; owner: string; goal: string; status: string; projects: string[]; startDate: string; endDate: string }
interface ProjOpt { id: string; name: string; dept?: string; health?: string; status?: Health; progress?: number; budget?: number }

const PG_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pgToDisplay = (iso: string): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? `${d} ${PG_MONTHS[m - 1]} ${y}` : "";
};
interface Stakeholder { id: string; user: string; role: string; power: PowInt; interest: PowInt }

const STATUS_OPTS = ["Planning", "On track", "At risk", "Critical", "On hold", "Completed", "Closed"] as const;
const STATUS_COLOR: Record<string, { tint: string; ink: string; dot: string }> = {
  "Planning": { tint: "#EEF0F4", ink: "#566077", dot: "#8A93A6" },
  "On track": { tint: "#E7F4EC", ink: "#0B6B37", dot: "#15A34A" },
  "At risk": { tint: "#FBF2D7", ink: "#8A6300", dot: "#E0A100" },
  "Critical": { tint: "#FBE7E8", ink: "#A1282B", dot: "#D13438" },
  "On hold": { tint: "#EEF0F4", ink: "#566077", dot: "#8A93A6" },
  "Completed": { tint: "#E6EFFB", ink: "#0C5798", dot: "#0F6CBD" },
  "Closed": { tint: "#EEF0F4", ink: "#566077", dot: "#566077" },
};
const HEALTH: Record<Health, { ink: string; tint: string; dot: string; label: string }> = {
  green: { ink: "#0B6B37", tint: "#E7F4EC", dot: "#15A34A", label: "On track" },
  amber: { ink: "#8A6300", tint: "#FBF2D7", dot: "#E0A100", label: "At risk" },
  red: { ink: "#A1282B", tint: "#FBE7E8", dot: "#D13438", label: "Critical" },
  hold: { ink: "#566077", tint: "#EEF0F4", dot: "#8A93A6", label: "Planning" },
};

const fmt = (v: number) => "€" + (v / 1000).toFixed(1) + "M";

function useProgramsData() {
  return useQuery({
    queryKey: ["programs"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Program[]> => { try { return (await api<Program[]>("/programs")) ?? []; } catch { return []; } },
  });
}
function useProjectOpts() {
  return useQuery({
    queryKey: ["projects", "opts"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<ProjOpt[]> => { try { return (await api<ProjOpt[]>("/projects")) ?? []; } catch { return []; } },
  });
}

export default function Programs() {
  const { data: programs = [] } = useProgramsData();
  const { data: projectOpts = [] } = useProjectOpts();
  const { can } = usePermissions();
  const mayCreate = can("cap-projects", "F");
  const mayEdit = can("cap-projects", "E");
  const mayDelete = can("cap-projects", "F");
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Program | null>(null);
  const createProgram = useMutation({
    mutationFn: (body: NewProgram) => api<Program>("/programs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programs"] }),
  });
  const archive = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api(`/programs/${id}/${on ? "archive" : "unarchive"}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["programs"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/programs/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["programs"] }); setConfirmDel(null); },
  });
  const selected = programs.find((p) => p.id === selectedId) ?? null;
  const activeCount = programs.filter((p) => !p.archived).length;
  const archivedCount = programs.filter((p) => p.archived).length;
  const shown = programs.filter((p) => (showArchived ? p.archived : !p.archived));

  if (selected) {
    return (
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <ProgramDetail program={selected} projectOpts={projectOpts} onClose={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 13.5, color: color.subtle }}>Group related projects under a program for aggregated health, budget &amp; progress.</div>
        <div style={{ flex: 1 }} />
        <Button onClick={() => setModal(true)} disabled={!mayCreate} title={mayCreate ? undefined : "Your role can't create programs"}><Icon name="plus" size={16} /> New program</Button>
      </div>

      {(archivedCount > 0 || showArchived) && (
        <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2, marginBottom: 16 }}>
          {[["Active", false, activeCount], ["Archived", true, archivedCount]].map(([label, arch, n]) => (
            <button key={label as string} onClick={() => setShowArchived(arch as boolean)} style={{ padding: "7px 15px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: showArchived === arch ? "#fff" : "transparent", color: showArchived === arch ? color.primary : "#6A7488", boxShadow: showArchived === arch ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>
              {label as string} · {n as number}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: "56px 22px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>
          {showArchived ? "No archived programs." : "No programs yet. Create one to aggregate related projects."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {shown.map((pg) => {
            const sc = STATUS_COLOR[pg.status] ?? STATUS_COLOR.Planning;
            const h = HEALTH[pg.health] ?? HEALTH.hold;
            return (
              <div key={pg.id} onClick={() => setSelectedId(pg.id)} style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: 20, cursor: "pointer", opacity: pg.archived ? 0.72 : 1 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 14 }}>
                  <div style={folderBadge(42)}><Icon name="folders" size={20} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 600, color: color.navy, lineHeight: 1.25 }}>{pg.name}</div>
                      {pg.archived && <span style={{ flex: "none", fontSize: 10, fontWeight: 700, color: "#566077", background: "#EEF0F4", borderRadius: 5, padding: "1px 6px", letterSpacing: "0.03em", textTransform: "uppercase" }}>Archived</span>}
                    </div>
                    <div style={{ fontSize: 12, color: color.faint2, marginTop: 2 }}>{pg.goal}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 10px", borderRadius: 20, flex: "none" }}>{pg.status}</span>
                  {(mayEdit || mayDelete) && (
                    <div onClick={(e) => e.stopPropagation()} style={{ flex: "none" }}>
                      <RowMenu ariaLabel="Program actions" width={176}>
                        {(close) => (
                          <>
                            {mayEdit && (pg.archived
                              ? <MenuItem label="Restore" icon={<Icon name="refresh" size={15} />} onClick={() => { archive.mutate({ id: pg.id, on: false }); close(); }} />
                              : <MenuItem label="Archive" icon={<Icon name="archive" size={15} />} onClick={() => { archive.mutate({ id: pg.id, on: true }); close(); }} />)}
                            {mayDelete && <><MenuDivider /><MenuItem label="Delete permanently" icon={<Icon name="trash" size={15} />} danger onClick={() => { setConfirmDel(pg); close(); }} /></>}
                          </>
                        )}
                      </RowMenu>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 20, marginBottom: 13 }}>
                  <Stat n={pg.projects.length} label="Projects" />
                  <Stat n={fmt(pg.budget)} label="Budget" />
                  <Stat n={pg.progress + "%"} label="Avg progress" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span title="Aggregated health" style={{ width: 9, height: 9, borderRadius: "50%", background: h.dot, flex: "none" }} />
                  <div style={{ flex: 1, height: 7, background: color.bg, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pg.progress}%`, background: h.dot }} />
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono, marginTop: 10 }}>{pg.id} · Owner {pg.owner}</div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <NewProgramModal
          projectOpts={projectOpts}
          submitting={createProgram.isPending}
          onClose={() => setModal(false)}
          onCreate={(body) => createProgram.mutate(body, { onSuccess: () => setModal(false) })}
        />
      )}
      {confirmDel && (
        <Overlay onClose={() => setConfirmDel(null)} width={440}>
          <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.navy, marginBottom: 10 }}>Delete program</div>
          <div style={{ fontSize: 13.5, color: color.text, lineHeight: 1.5, marginBottom: 8 }}>
            Permanently delete <strong>{confirmDel.name}</strong> <span style={{ fontFamily: font.mono, color: color.faint3 }}>({confirmDel.id})</span>? Its linked projects are not deleted.
          </div>
          <div style={{ fontSize: 12.5, color: "#A1282B", background: "#FBE7E8", borderRadius: 8, padding: "9px 12px", marginBottom: 14 }}>This can't be undone. To keep the record, archive it instead.</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
            <button onClick={() => setConfirmDel(null)} style={{ fontSize: 13, fontWeight: 600, color: color.textMuted, background: "#fff", border: `1px solid ${color.border2}`, padding: "10px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={() => del.mutate(confirmDel.id)} disabled={del.isPending} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#D13438", border: "none", padding: "10px 18px", borderRadius: 9, cursor: del.isPending ? "not-allowed" : "pointer", opacity: del.isPending ? 0.6 : 1, fontFamily: "inherit" }}>{del.isPending ? "Deleting…" : "Delete permanently"}</button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: React.ReactNode; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: font.head, fontSize: 20, fontWeight: 700, color: color.navy, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 11, color: color.faint3, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function ProgramDetail({ program, projectOpts, onClose }: { program: Program; projectOpts: ProjOpt[]; onClose: () => void }) {
  const h = HEALTH[program.health] ?? HEALTH.hold;
  const [costsOpen, setCostsOpen] = useState(false);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [skName, setSkName] = useState("");
  const [skRole, setSkRole] = useState("");
  const [skPower, setSkPower] = useState<PowInt>("High");
  const [skInterest, setSkInterest] = useState<PowInt>("High");
  const projectRows = projectOpts.filter((p) => program.projects.includes(p.id));

  const addStk = () => {
    if (!skName.trim()) return;
    setStakeholders((l) => [...l, { id: "STK-" + Math.floor(1000 + Math.random() * 9000), user: skName.trim(), role: skRole.trim() || "Stakeholder", power: skPower, interest: skInterest }]);
    setSkName(""); setSkRole("");
  };

  const kpi = (label: string, node: React.ReactNode) => (
    <div><div style={{ fontSize: 11, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>{node}</div>
  );
  const costCard = (label: string, value: string, ink: string, sub?: string) => (
    <div style={{ background: color.surfaceAlt, border: `1px solid ${color.bg}`, borderRadius: 11, padding: "13px 14px" }}>
      <div style={{ fontSize: 11, color: color.faint }}>{label}</div>
      <div style={{ fontFamily: font.head, fontSize: 20, fontWeight: 700, color: ink, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: color.faint3, marginTop: 3 }}>{sub}</div>}
    </div>
  );

  return (
    <>
      <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: color.primary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", marginBottom: 14, padding: 0 }}>← All programs</button>

      {/* header */}
      <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: "22px 24px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={folderBadge(46)}><Icon name="folders" size={22} /></div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ fontFamily: font.head, fontSize: 22, fontWeight: 600, color: color.navy, margin: "0 0 4px" }}>{program.name}</h2>
            <div style={{ fontSize: 13, color: color.faint2 }}>{program.goal}</div>
            <div style={{ fontSize: 12, color: color.faint3, fontFamily: font.mono, marginTop: 4 }}>{program.id} · Owner {program.owner}{program.startDate ? ` · Start ${program.startDate}` : ""}{program.endDate ? ` · End ${program.endDate}` : ""}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: h.ink, background: h.tint, padding: "4px 12px", borderRadius: 20 }}>{HEALTH[program.health]?.label ?? program.status}</span>
            <SubscribeButton targetType="program" targetId={program.id} />
            <Button variant="secondary" onClick={() => setCostsOpen(true)}><Icon name="coins" size={15} /> Costs</Button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginTop: 20, paddingTop: 18, borderTop: `1px solid ${color.bg}` }}>
          {kpi("Projects", <div style={{ fontFamily: font.head, fontSize: 20, fontWeight: 700, color: color.navy }}>{program.projects.length}</div>)}
          {kpi("Avg progress", (
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ flex: 1, height: 7, background: color.bg, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${program.progress}%`, background: h.dot }} /></div>
              <span style={{ fontFamily: font.head, fontSize: 14, fontWeight: 700, color: color.navy }}>{program.progress}%</span>
            </div>
          ))}
          {kpi("Budget", <div style={{ fontSize: 15, fontWeight: 600, color: color.text }}>{fmt(program.budget)}</div>)}
          {kpi("Spent", <div style={{ fontSize: 15, fontWeight: 600, color: color.text }}>{fmt(program.spent)}</div>)}
        </div>
      </div>

      {/* aggregated cost */}
      <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: "20px 22px", marginBottom: 18 }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, marginBottom: 4 }}>Aggregated cost · all program projects</div>
        <div style={{ fontSize: 12, color: color.faint2, marginBottom: 16 }}>Rolled up from every project's cost lines</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13 }}>
          {costCard("Internal labor", fmt(0), color.navy, `Dev ${fmt(0)} · Arch ${fmt(0)} · Infra ${fmt(0)}`)}
          {costCard("Infra / cloud", fmt(0), "#0E7C7B")}
          {costCard("Dev tooling", fmt(0), "#7A3FB0")}
          <div style={{ background: color.navy, borderRadius: 11, padding: "13px 14px" }}>
            <div style={{ fontSize: 11, color: "#9FB4E8" }}>Total cost</div>
            <div style={{ fontFamily: font.head, fontSize: 20, fontWeight: 700, color: "#fff", marginTop: 3 }}>{fmt(0)}</div>
            <div style={{ fontSize: 10.5, color: "#9FB4E8", marginTop: 3 }}>Vendor {fmt(0)} · Savings {fmt(0)}</div>
          </div>
        </div>
      </div>

      {/* projects in this program */}
      <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}`, fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy }}>Projects in this program</div>
        {projectRows.length === 0 ? (
          <div style={{ padding: "40px 22px", textAlign: "center", color: color.faint3, fontSize: 13 }}>No projects linked to this program yet.</div>
        ) : projectRows.map((p) => {
          const ph = HEALTH[p.status ?? "hold"] ?? HEALTH.hold;
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.9fr 1fr 0.8fr", alignItems: "center", padding: "14px 22px", borderBottom: "1px solid #F2F4F9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: ph.dot, flex: "none" }} />
                <div><div style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{p.name}</div><div style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono }}>{p.id}</div></div>
              </div>
              <div style={{ fontSize: 12.5, color: color.subtle }}>{p.dept ?? "—"}</div>
              <div><span style={{ fontSize: 11.5, fontWeight: 700, color: ph.ink, background: ph.tint, padding: "3px 9px", borderRadius: 6 }}>{p.health ?? ph.label}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 14 }}>
                <div style={{ flex: 1, height: 6, background: color.bg, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${p.progress ?? 0}%`, background: ph.dot }} /></div>
                <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.textMuted }}>{p.progress ?? 0}%</span>
              </div>
              <div style={{ textAlign: "right", fontFamily: font.mono, fontSize: 12.5, color: color.textMuted }}>{fmt(p.budget ?? 0)}</div>
            </div>
          );
        })}
      </div>

      {/* stakeholder matrix */}
      <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: "20px 22px", marginTop: 18 }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, marginBottom: 14 }}>Stakeholder matrix · power / interest</div>
        <StakeholderMatrix items={stakeholders} />
        <div style={{ borderTop: `1px solid ${color.bg}`, marginTop: 16, paddingTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#56607A", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>Program-level stakeholders</div>
          {stakeholders.map((s) => {
            const q = quadrant(s.power, s.interest);
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid #F4F6FA" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: q.dot, flex: "none" }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: color.text }}>{s.user}</span>
                <span style={{ fontSize: 11, color: color.faint2 }}>{s.role} · {q.label}</span>
                <button onClick={() => setStakeholders((l) => l.filter((x) => x.id !== s.id))} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${color.border3}`, background: "#fff", color: color.faint3, cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
              </div>
            );
          })}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8, marginTop: 12 }}>
            <Input value={skName} onChange={(e) => setSkName(e.target.value)} placeholder="Stakeholder name" />
            <Input value={skRole} onChange={(e) => setSkRole(e.target.value)} placeholder="Role" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginTop: 8 }}>
            <Select value={skPower} onChange={(e) => setSkPower(e.target.value as PowInt)}><option value="High">Power: High</option><option value="Low">Power: Low</option></Select>
            <Select value={skInterest} onChange={(e) => setSkInterest(e.target.value as PowInt)}><option value="High">Interest: High</option><option value="Low">Interest: Low</option></Select>
            <button onClick={addStk} style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          </div>
        </div>
      </div>
      {costsOpen && <CostsModal scope="programs" id={program.id} name={program.name} onClose={() => setCostsOpen(false)} />}
    </>
  );
}

function quadrant(power: PowInt, interest: PowInt) {
  const hi = (s: PowInt) => s === "High";
  if (hi(power) && hi(interest)) return { key: "manage", label: "Manage Closely", tint: "#FBE7E8", ink: "#A1282B", dot: "#D13438" };
  if (hi(power) && !hi(interest)) return { key: "satisfy", label: "Keep Satisfied", tint: "#FBF2D7", ink: "#8A6300", dot: "#E0A100" };
  if (!hi(power) && hi(interest)) return { key: "inform", label: "Keep Informed", tint: "#E6EFFB", ink: "#0C5798", dot: "#0F6CBD" };
  return { key: "monitor", label: "Monitor", tint: "#EEF0F4", ink: "#566077", dot: "#8A93A6" };
}

function StakeholderMatrix({ items }: { items: Stakeholder[] }) {
  const cell = (power: PowInt, interest: PowInt) => {
    const q = quadrant(power, interest);
    const inq = items.filter((it) => quadrant(it.power, it.interest).key === q.key);
    return (
      <div style={{ background: q.tint, borderRadius: 10, padding: "12px 13px", minHeight: 96 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: q.ink, marginBottom: 8 }}>{q.label}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {inq.length ? inq.map((it) => (
            <span key={it.id} title={it.role} style={{ fontSize: 11, fontWeight: 600, color: q.ink, background: "#fff", border: `1px solid ${q.dot}`, borderRadius: 20, padding: "2px 9px" }}>{it.user}</span>
          )) : <span style={{ fontSize: 11, color: color.faint3 }}>—</span>}
        </div>
      </div>
    );
  };
  const axisLabel = (t: string) => <span style={{ fontSize: 10.5, fontWeight: 700, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t}</span>;
  const vAxis = (t: string) => (
    <div style={{ width: 46, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.04em", transform: "rotate(-90deg)", whiteSpace: "nowrap" }}>{t}</span>
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 6, paddingLeft: 54 }}>
        <div style={{ flex: 1 }}>{axisLabel("Low interest")}</div>
        <div style={{ flex: 1 }}>{axisLabel("High interest")}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {vAxis("High power")}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{cell("High", "Low")}{cell("High", "High")}</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {vAxis("Low power")}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{cell("Low", "Low")}{cell("Low", "High")}</div>
      </div>
    </div>
  );
}

function NewProgramModal({ projectOpts, onClose, onCreate, submitting }: { projectOpts: ProjOpt[]; onClose: () => void; onCreate: (p: NewProgram) => void; submitting?: boolean }) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState<string>("Planning");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(), owner: owner.trim() || "Unassigned", goal: goal.trim(), status,
      projects: selected, startDate: pgToDisplay(startDate), endDate: pgToDisplay(endDate),
    });
  };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", marginBottom: 5 };

  return (
    <Overlay onClose={onClose} width={560}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span style={folderBadge(34, 9)}><Icon name="folders" size={18} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.navy }}>New program</div>
          <div style={{ fontSize: 12, color: color.faint2 }}>Aggregate projects under a strategic program</div>
        </div>
      </div>
      <label style={lbl}>Program name</label>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer Experience 2027" style={{ marginBottom: 14, fontSize: 13.5 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div><label style={lbl}>Owner</label><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Program manager" /></div>
        <div><label style={lbl}>Goal</label><Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Strategic objective" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div><label style={lbl}>Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        <div><label style={lbl}>Start date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div><label style={lbl}>End date</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div />
      </div>
      <label style={{ ...lbl, marginBottom: 7 }}>Projects to include</label>
      <div style={{ border: `1px solid ${color.bg}`, borderRadius: 11, maxHeight: 220, overflowY: "auto" }}>
        {projectOpts.length === 0 ? (
          <div style={{ padding: "20px 13px", textAlign: "center", fontSize: 12.5, color: color.faint3 }}>No projects available yet.</div>
        ) : projectOpts.map((o) => {
          const on = selected.includes(o.id);
          return (
            <div key={o.id} onClick={() => toggle(o.id)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 13px", borderBottom: "1px solid #F4F6FA", cursor: "pointer" }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, border: "1.5px solid #C7CEDB", background: on ? color.primary : "#fff", color: on ? "#fff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>✓</span>
              <span style={{ fontSize: 13, color: color.text }}>{o.name}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
        <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: color.textMuted, background: "#fff", border: `1px solid ${color.border2}`, padding: "10px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        <button onClick={submit} disabled={submitting} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "10px 18px", borderRadius: 9, cursor: submitting ? "default" : "pointer", fontFamily: "inherit", opacity: submitting ? 0.6 : 1 }}>{submitting ? "Creating…" : "Create program"}</button>
      </div>
    </Overlay>
  );
}

function folderBadge(size: number, br = 12): React.CSSProperties {
  return { width: size, height: size, borderRadius: br, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" };
}
