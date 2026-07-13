import { useState, type CSSProperties, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api, apiDownload } from "@/api";
import { Card, EmptyBlock, Button, Input } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { toast, toastError } from "@/components/Toast";
import { SubTeamManager } from "@/components/TeamPanel";
import { TeamSwotPanel, type TeamSwot } from "@/components/TeamSwot";
import { DevPlanModal, type DevPlan } from "@/components/DevPlan";
import { useRole } from "@/components/RoleContext";
import { laborHours, laborCost, HOURS_PER_DAY, DAYS_PER_MONTH } from "@/lib/labor";

// ---------------------------------------------------------------------------
// My Team — members come from Entra groups mapped to a manager slot in Admin →
// Teams. A manager sees their own team plus every team beneath them in the
// roll-up tree; the Platform Admin sees all mapped teams. Skills/allocation are
// enriched elsewhere; here we show the roster cleanly.
// ---------------------------------------------------------------------------
interface Member { id: number; displayName: string; email: string; jobTitle: string; }
interface Group { id: string; displayName: string; members: Member[]; }
interface ManagerTeam { key: string; label: string; isSelf: boolean; groups: Group[]; memberCount: number; }
interface MyTeam { isAdmin: boolean; managerKey: string; managerLabel: string; teams: ManagerTeam[]; }

const AVATAR_COLORS = ["#0F6CBD", "#7A3FB0", "#0E7C7B", "#C98A00", "#15A34A", "#A1282B"];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
const avatarColor = (name: string) => AVATAR_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

export default function Teams() {
  const { data } = useQuery({
    queryKey: ["myteam"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<MyTeam> => (await api<MyTeam>("/myteam")) ?? { isAdmin: false, managerKey: "", managerLabel: "", teams: [] },
  });
  const teams = data?.teams ?? [];
  const totalMembers = teams.reduce((s, t) => s + t.memberCount, 0);

  const qc = useQueryClient();
  const { data: swot } = useQuery({
    queryKey: ["teamswot"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; items: Record<string, TeamSwot> }> =>
      (await api<{ canEdit: boolean; items: Record<string, TeamSwot> }>("/teams/swot")) ?? { canEdit: false, items: {} },
  });
  const { data: dev } = useQuery({
    queryKey: ["devplans"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; items: Record<string, DevPlan> }> =>
      (await api<{ canEdit: boolean; items: Record<string, DevPlan> }>("/devplans")) ?? { canEdit: false, items: {} },
  });
  const [devPlanFor, setDevPlanFor] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.subtle, flex: 1 }}>
          {data?.isAdmin
            ? "All teams, grouped by manager. Members sync from the Entra groups mapped in Administration → Teams."
            : data?.managerLabel
              ? <>Your team{teams.some((t) => !t.isSelf) ? " and the teams that roll up to you" : ""} — synced from Entra groups.</>
              : "Members sync from Entra groups mapped to a manager. Ask a Platform Admin to map your groups in Administration → Teams."}
        </div>
        {totalMembers > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, background: color.bg, borderRadius: 20, padding: "5px 12px" }}>{totalMembers} member{totalMembers === 1 ? "" : "s"}</span>}
      </div>

      {teams.length === 0 ? (
        <Card><EmptyBlock minHeight={200} message="No team members yet — a Platform Admin maps Entra groups to managers in Administration → Teams." /></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {teams.map((t) => (
            <Card key={t.key} padding={0} style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 22px", borderBottom: `1px solid ${color.bg}` }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: color.primaryTint, color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="users" size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: font.head, fontSize: 15.5, fontWeight: 600, color: color.navy }}>{t.label}</span>
                    {t.isSelf && <span style={{ fontSize: 10, fontWeight: 700, color: color.successInk, background: color.successTint, borderRadius: 5, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.03em" }}>You</span>}
                    {!t.isSelf && !data?.isAdmin && <span style={{ fontSize: 10, fontWeight: 700, color: color.subtle, background: color.surfaceAlt, borderRadius: 5, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.03em" }}>Reports to you</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: color.faint3 }}>{t.memberCount} member{t.memberCount === 1 ? "" : "s"} · {t.groups.length} group{t.groups.length === 1 ? "" : "s"}</div>
                </div>
              </div>
              {t.memberCount === 0 ? (
                <EmptyBlock minHeight={80} message="No members in this team's Entra groups yet." />
              ) : (
                <div style={{ padding: "8px 12px" }}>
                  {t.groups.map((g) => (
                    <div key={g.id} style={{ padding: "8px 10px" }}>
                      {t.groups.length > 1 && <div style={{ fontSize: 11, fontWeight: 700, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.04em", margin: "4px 0 10px" }}>{g.displayName}</div>}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
                        {g.members.map((m) => (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 11, border: `1px solid ${color.border}`, borderRadius: 12, padding: "10px 12px" }}>
                            <span style={{ width: 34, height: 34, borderRadius: "50%", background: avatarColor(m.displayName), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{initials(m.displayName)}</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.displayName}</div>
                              <div style={{ fontSize: 11.5, color: color.faint3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.jobTitle || m.email || "—"}</div>
                            </div>
                            {dev?.canEdit && (
                              <button onClick={() => setDevPlanFor(m.displayName)} title="Development plan (managers only)" aria-label={`Development plan for ${m.displayName}`}
                                style={{ border: "none", background: "transparent", color: dev.items[m.displayName] ? color.primary : color.faint2, cursor: "pointer", padding: 5, borderRadius: 7, lineHeight: 0, flex: "none" }}>
                                <Icon name="userCheck" size={15} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <TeamSwotPanel
                teamKey={t.key}
                canEdit={!!swot?.canEdit}
                swot={swot?.items[t.key]}
                onSaved={() => qc.invalidateQueries({ queryKey: ["teamswot"] })}
              />
            </Card>
          ))}
        </div>
      )}

      <div style={{ marginTop: 18 }}><LaborRateCard /></div>

      <div style={{ marginTop: 18 }}><SkillsMatrix /></div>

      <SubTeamManager />

      {devPlanFor && (
        <DevPlanModal
          person={devPlanFor}
          plan={dev?.items[devPlanFor]}
          onClose={() => setDevPlanFor(null)}
          onSaved={() => { setDevPlanFor(null); qc.invalidateQueries({ queryKey: ["devplans"] }); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal-labour rate card & cost calculator. Average blended cost/hour by
// discipline (Dev, Infra) and seniority; PMO / PM Lead / Admin can edit. The
// calculator turns effort (months/days/hours) into an internal-labour cost
// using the selected rate. Rates persist server-side (/labor-rates).
// ---------------------------------------------------------------------------
const RATE_LEVEL_LABELS: Record<string, string> = {
  junior: "Junior", semiSenior: "Semi-Senior", senior: "Senior", specialist: "Specialist", expert: "Expert",
};
const RATE_DISC_LABELS: Record<string, string> = {
  infraSweden: "Infra · Sweden", infraApac: "Infra · APAC", infraCh: "Infra · CH",
  devSweden: "Dev · Sweden", devApac: "Dev · APAC", devBlog: "Dev · BLOG", devCh: "Dev · CH",
  architectSweden: "Architect · Sweden", architectCh: "Architect · CH",
  pmSweden: "PM · Sweden", pmCh: "PM · CH",
  poSweden: "PO · Sweden", poCh: "PO · CH",
};

interface RateCard { canEdit: boolean; disciplines: string[]; levels: string[]; rates: Record<string, number>; }

function LaborRateCard() {
  const qc = useQueryClient();
  // Each discipline's rate is need-to-know (server-filtered by the effective UI
  // identity), so key the query by the selected role — switching persona in the
  // header refetches the rates that persona may see.
  const { role } = useRole();
  const { data } = useQuery({
    queryKey: ["labor-rates", role], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<RateCard> => (await api<RateCard>("/labor-rates")) ?? { canEdit: false, disciplines: [], levels: ["junior", "semiSenior", "senior", "specialist", "expert"], rates: {} },
  });
  const disciplines = data?.disciplines ?? [];
  const levels = data?.levels ?? ["junior", "semiSenior", "senior", "specialist", "expert"];
  const rates = data?.rates ?? {};
  const canEdit = data?.canEdit ?? false;

  // Local editable copy of the rate grid (strings for the inputs).
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const rateOf = (d: string, l: string) => (editing ? Number(draft[`${d}.${l}`] ?? 0) : (rates[`${d}.${l}`] ?? 0));

  const save = useMutation({
    mutationFn: () => {
      const out: Record<string, number> = {};
      for (const d of disciplines) for (const l of levels) out[`${d}.${l}`] = Number(draft[`${d}.${l}`] ?? 0) || 0;
      return api("/labor-rates", { method: "PUT", body: JSON.stringify({ rates: out }) });
    },
    onSuccess: () => { toast("Rate card saved"); setEditing(false); qc.invalidateQueries({ queryKey: ["labor-rates"] }); },
    onError: toastError,
  });
  const startEdit = () => {
    const d: Record<string, string> = {};
    for (const disc of disciplines) for (const l of levels) d[`${disc}.${l}`] = String(rates[`${disc}.${l}`] ?? 0);
    setDraft(d); setEditing(true);
  };

  // Calculator state. The discipline defaults to the first one this persona may
  // see (the list is need-to-know), falling back gracefully as it changes.
  const [calcDisc, setCalcDisc] = useState("dev");
  const [calcLevel, setCalcLevel] = useState("senior");
  const [months, setMonths] = useState("0");
  const [days, setDays] = useState("0");
  const [hours, setHours] = useState("0");
  const effCalcDisc = disciplines.includes(calcDisc) ? calcDisc : (disciplines[0] ?? "");
  const totalHours = laborHours(Number(months), Number(days), Number(hours));
  const calcRate = rateOf(effCalcDisc, calcLevel);
  const cost = laborCost(Number(months), Number(days), Number(hours), calcRate);
  const euro = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 22px", borderBottom: `1px solid ${color.bg}` }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: color.primaryTint, color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="coins" size={18} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: font.head, fontSize: 15.5, fontWeight: 600, color: color.navy }}>Internal-labour rate card</div>
          <div style={{ fontSize: 11.5, color: color.faint3 }}>Average blended cost / hour by discipline and seniority</div>
        </div>
        {canEdit && !editing && <Button variant="secondary" onClick={startEdit}><Icon name="edit" size={15} /> Edit rates</Button>}
        {editing && <>
          <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </>}
      </div>

      {/* Rates are need-to-know: a persona with no owned discipline sees none. */}
      {disciplines.length === 0 ? (
        <div style={{ padding: "22px", fontSize: 12.5, color: color.faint2, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="lock" size={15} />
          Internal-labour rates are restricted. Each region rate line (e.g. Infra · Sweden, Dev · APAC, PM · CH) is visible only to the managers who own that region, plus CTO / CIO. Switch to a role that owns a rate to view or edit it.
        </div>
      ) : (
      <>
      {/* Rate grid */}
      <div style={{ overflowX: "auto", padding: "6px 22px 16px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: 11, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.04em", padding: "10px 8px", fontWeight: 600 }}>Discipline</th>
              {levels.map((l) => <th key={l} style={{ textAlign: "right", fontSize: 11, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.04em", padding: "10px 8px", fontWeight: 600 }}>{RATE_LEVEL_LABELS[l] ?? l}</th>)}
            </tr>
          </thead>
          <tbody>
            {disciplines.map((d) => (
              <tr key={d} style={{ borderTop: `1px solid ${color.surfaceAlt}` }}>
                <td style={{ fontSize: 13, fontWeight: 600, color: color.text, padding: "10px 8px" }}>{RATE_DISC_LABELS[d] ?? d}</td>
                {levels.map((l) => (
                  <td key={l} style={{ textAlign: "right", padding: "8px" }}>
                    {editing ? (
                      <Input type="number" value={draft[`${d}.${l}`] ?? ""} onChange={(e) => setDraft((p) => ({ ...p, [`${d}.${l}`]: e.target.value }))} style={{ width: 82, textAlign: "right", padding: "6px 8px", fontSize: 12.5 }} />
                    ) : (
                      <span style={{ fontFamily: font.mono, fontSize: 13, color: (rates[`${d}.${l}`] ?? 0) > 0 ? color.text : color.faint3 }}>€{euro(rates[`${d}.${l}`] ?? 0)}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11.5, color: color.faint3, marginTop: 8 }}>€/hour. You see only the discipline(s) your role owns (CTO / CIO see all).</div>
      </div>

      {/* Calculator */}
      <div style={{ borderTop: `1px solid ${color.bg}`, background: color.surfaceAlt, padding: "16px 22px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: color.faint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Cost calculator</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <CalcField label="Discipline">
            <select value={effCalcDisc} onChange={(e) => setCalcDisc(e.target.value)} style={selStyle}>
              {disciplines.map((d) => <option key={d} value={d}>{RATE_DISC_LABELS[d] ?? d}</option>)}
            </select>
          </CalcField>
          <CalcField label="Seniority">
            <select value={calcLevel} onChange={(e) => setCalcLevel(e.target.value)} style={selStyle}>
              {levels.map((l) => <option key={l} value={l}>{RATE_LEVEL_LABELS[l] ?? l}</option>)}
            </select>
          </CalcField>
          <CalcField label="Months"><Input type="number" value={months} onChange={(e) => setMonths(e.target.value)} style={{ width: 80 }} /></CalcField>
          <CalcField label="Days"><Input type="number" value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 80 }} /></CalcField>
          <CalcField label="Hours"><Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} style={{ width: 80 }} /></CalcField>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11.5, color: color.faint3 }}>{euro(totalHours)} h × €{euro(calcRate)}/h</div>
            <div style={{ fontFamily: font.head, fontSize: 22, fontWeight: 700, color: cost > 0 ? color.navy : color.faint3 }}>€{euro(cost)}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: color.faint3, marginTop: 10 }}>1 month = {DAYS_PER_MONTH} working days · 1 day = {HOURS_PER_DAY} h. {calcRate === 0 && "Set a rate above to compute a cost."}</div>
      </div>
      </>
      )}
    </Card>
  );
}

const selStyle: CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: color.surface, color: color.text };
function CalcField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, color: color.faint3, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Skills matrix — customizable competency columns × team members × 0–4 level.
// Columns are fully editable (add/remove); rows are every member in the
// manager's scope. Levels persist per person + skill.
// ---------------------------------------------------------------------------
interface Skill { id: number; name: string }
interface Rating { skillId: number; person: string; level: number }
interface SkillsData { canEdit: boolean; skills: Skill[]; people: string[]; ratings: Rating[] }
const LEVELS = ["—", "1", "2", "3", "4"];
const levelColor = (n: number) => n >= 4 ? "#0B6B37" : n === 3 ? "#15A34A" : n >= 1 ? "#C98A00" : color.faint3;

function SkillsMatrix() {
  const qc = useQueryClient();
  const [newSkill, setNewSkill] = useState("");
  const { data } = useQuery({
    queryKey: ["skills"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<SkillsData> => (await api<SkillsData>("/skills")) ?? { canEdit: false, skills: [], people: [], ratings: [] },
  });
  const canEdit = data?.canEdit ?? false;
  const skills = data?.skills ?? [];
  const people = data?.people ?? [];
  const rating = new Map((data?.ratings ?? []).map((r) => [`${r.skillId}|${r.person}`, r.level]));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["skills"] });

  const addSkill = useMutation({
    mutationFn: (name: string) => api("/skills", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => { setNewSkill(""); invalidate(); }, onError: toastError,
  });
  const removeSkill = useMutation({
    mutationFn: (id: number) => api(`/skills/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast("Skill removed", "info"); invalidate(); }, onError: toastError,
  });
  const setRating = useMutation({
    mutationFn: (b: { skillId: number; person: string; level: number }) => api("/skill-ratings", { method: "PUT", body: JSON.stringify(b) }),
    onSuccess: invalidate, onError: toastError,
  });

  const NAME_COL = 220;
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 22px", borderBottom: `1px solid ${color.bg}`, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Skills &amp; competency matrix</div>
          <div style={{ fontSize: 12, color: color.faint2 }}>Proficiency 0–4 per person · add your own skill columns</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(skills.length > 0 && people.length > 0) && (
            <Button variant="secondary" onClick={() => apiDownload("/skills/export.xlsx", "atlas-skills-matrix.xlsx")} title="Download the matrix as a colour-graded Excel"><Icon name="download" size={15} /> Export</Button>
          )}
          {canEdit && (
            <>
            <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="New skill…"
              onKeyDown={(e) => { if (e.key === "Enter" && newSkill.trim()) addSkill.mutate(newSkill.trim()); }} style={{ width: 160 }} />
            <Button variant="secondary" onClick={() => newSkill.trim() && addSkill.mutate(newSkill.trim())} disabled={!newSkill.trim() || addSkill.isPending}><Icon name="plus" size={15} /> Add skill</Button>
            </>
          )}
        </div>
      </div>

      {people.length === 0 ? (
        <EmptyBlock minHeight={120} message="No team members yet — map Entra groups to a manager in Administration → Teams." />
      ) : skills.length === 0 ? (
        <EmptyBlock minHeight={120} message={canEdit ? "No skills yet — add a skill column above to start rating the team." : "No skills defined yet."} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: NAME_COL + skills.length * 90 }}>
            {/* header */}
            <div style={{ display: "grid", gridTemplateColumns: `${NAME_COL}px repeat(${skills.length}, 90px)`, borderBottom: `1px solid ${color.bg}` }}>
              <div style={{ padding: "10px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>Person</div>
              {skills.map((s) => (
                <div key={s.id} style={{ padding: "8px 6px", textAlign: "center", position: "relative" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: color.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.name}>{s.name}</div>
                  {canEdit && <button onClick={() => removeSkill.mutate(s.id)} title="Remove skill" aria-label={`Remove ${s.name}`} style={{ position: "absolute", top: 2, right: 4, border: "none", background: "none", cursor: "pointer", color: color.faint3, padding: 2, lineHeight: 0 }}><Icon name="x" size={12} /></button>}
                </div>
              ))}
            </div>
            {/* rows */}
            {people.map((p) => (
              <div key={p} style={{ display: "grid", gridTemplateColumns: `${NAME_COL}px repeat(${skills.length}, 90px)`, borderBottom: `1px solid ${color.surfaceAlt}`, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 22px", minWidth: 0 }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: avatarColor(p), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, flex: "none" }}>{initials(p)}</span>
                  <span style={{ fontSize: 12.5, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p}</span>
                </div>
                {skills.map((s) => {
                  const lvl = rating.get(`${s.id}|${p}`) ?? 0;
                  return (
                    <div key={s.id} style={{ padding: "6px 8px", textAlign: "center" }}>
                      {canEdit ? (
                        <select value={lvl} aria-label={`${p} · ${s.name}`}
                          onChange={(e) => setRating.mutate({ skillId: s.id, person: p, level: Number(e.target.value) })}
                          style={{ width: "100%", border: `1px solid ${color.border2}`, borderRadius: 7, padding: "5px 4px", fontSize: 12.5, fontWeight: 700, color: levelColor(lvl), background: color.surface, cursor: "pointer", fontFamily: "inherit" }}>
                          {LEVELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: levelColor(lvl) }}>{lvl === 0 ? "—" : lvl}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 14, padding: "12px 22px", flexWrap: "wrap", borderTop: `1px solid ${color.bg}` }}>
        <span style={{ fontSize: 11, color: color.faint3 }}>Scale:</span>
        <span style={{ fontSize: 11, color: color.subtle }}>0 None</span>
        <span style={{ fontSize: 11, color: color.subtle }}>1–2 Working</span>
        <span style={{ fontSize: 11, color: color.subtle }}>3 Proficient</span>
        <span style={{ fontSize: 11, color: color.subtle }}>4 Expert</span>
      </div>
    </Card>
  );
}
