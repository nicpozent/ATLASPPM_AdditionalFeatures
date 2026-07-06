import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Card, EmptyBlock, Button, Input } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { toast, toastError } from "@/components/Toast";
import { SubTeamManager } from "@/components/TeamPanel";

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
                <span style={{ width: 34, height: 34, borderRadius: 9, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="users" size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: font.head, fontSize: 15.5, fontWeight: 600, color: color.navy }}>{t.label}</span>
                    {t.isSelf && <span style={{ fontSize: 10, fontWeight: 700, color: "#0B6B37", background: "#E7F4EC", borderRadius: 5, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.03em" }}>You</span>}
                    {!t.isSelf && !data?.isAdmin && <span style={{ fontSize: 10, fontWeight: 700, color: "#566077", background: "#EEF0F4", borderRadius: 5, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.03em" }}>Reports to you</span>}
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
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.displayName}</div>
                              <div style={{ fontSize: 11.5, color: color.faint3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.jobTitle || m.email || "—"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div style={{ marginTop: 18 }}><SkillsMatrix /></div>

      <SubTeamManager />
    </div>
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
        {canEdit && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="New skill…"
              onKeyDown={(e) => { if (e.key === "Enter" && newSkill.trim()) addSkill.mutate(newSkill.trim()); }} style={{ width: 160 }} />
            <Button variant="secondary" onClick={() => newSkill.trim() && addSkill.mutate(newSkill.trim())} disabled={!newSkill.trim() || addSkill.isPending}><Icon name="plus" size={15} /> Add skill</Button>
          </div>
        )}
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
              <div key={p} style={{ display: "grid", gridTemplateColumns: `${NAME_COL}px repeat(${skills.length}, 90px)`, borderBottom: "1px solid #F4F6FA", alignItems: "center" }}>
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
                          style={{ width: "100%", border: `1px solid ${color.border2}`, borderRadius: 7, padding: "5px 4px", fontSize: 12.5, fontWeight: 700, color: levelColor(lvl), background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
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
        <span style={{ fontSize: 11, color: "#566077" }}>0 None</span>
        <span style={{ fontSize: 11, color: "#566077" }}>1–2 Working</span>
        <span style={{ fontSize: 11, color: "#566077" }}>3 Proficient</span>
        <span style={{ fontSize: 11, color: "#566077" }}>4 Expert</span>
      </div>
    </Card>
  );
}
