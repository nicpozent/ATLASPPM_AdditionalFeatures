import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Card, Button, Select, Modal, Input } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

// A person on a sub-team or an assignment.
export interface TeamMemberT { id: number; name: string; email: string; title: string }
export interface SubTeamT { id: number; name: string; managerKey: string; managerLabel: string; description: string; canManage: boolean; members: TeamMemberT[] }
// An assignment member carries the full allocation shape.
interface AssignMemberT extends TeamMemberT {
  alloc: number; allocHours: number; startDate: string; endDate: string;
  extAlloc: number; extHours: number; extStartDate: string; extEndDate: string;
}
interface AssignmentT { id: number; subTeamId: number; subTeamName: string; managerLabel: string; members: AssignMemberT[] }

const HOURS_PER_WEEK = 40;
const pct = (mode: "percent" | "hours", value: number) =>
  mode === "hours" ? Math.min(100, Math.round((value / HOURS_PER_WEEK) * 100)) : value;

// Per-member allocation editing state (base segment + optional extension).
interface AllocEdit {
  mode: "percent" | "hours"; value: number; start: string; end: string;
  extOn: boolean; extMode: "percent" | "hours"; extValue: number; extStart: string; extEnd: string;
}
const blankAlloc = (): AllocEdit => ({ mode: "percent", value: 0, start: "", end: "", extOn: false, extMode: "hours", extValue: 0, extStart: "", extEnd: "" });
function allocFrom(m: AssignMemberT): AllocEdit {
  return {
    mode: m.allocHours > 0 ? "hours" : "percent", value: m.allocHours > 0 ? m.allocHours : m.alloc,
    start: m.startDate, end: m.endDate,
    extOn: m.extAlloc > 0 || m.extHours > 0 || !!m.extStartDate || !!m.extEndDate,
    extMode: m.extHours > 0 ? "hours" : "percent", extValue: m.extHours > 0 ? m.extHours : m.extAlloc,
    extStart: m.extStartDate, extEnd: m.extEndDate,
  };
}
function allocReq(name: string, email: string, title: string, a: AllocEdit) {
  return {
    name, email, title,
    ...(a.mode === "hours" ? { allocHours: a.value } : { alloc: a.value }),
    startDate: a.start, endDate: a.end,
    ...(a.extOn
      ? { ...(a.extMode === "hours" ? { extHours: a.extValue } : { extAlloc: a.extValue }), extStartDate: a.extStart, extEndDate: a.extEnd }
      : { extAlloc: 0, extHours: 0, extStartDate: "", extEndDate: "" }),
  };
}

const avatarColors = ["#0F6CBD", "#7A3FB0", "#0E7C7B", "#C98A00", "#15A34A", "#A1282B"];
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
const avatarColor = (n: string) => avatarColors[[...n].reduce((s, c) => s + c.charCodeAt(0), 0) % avatarColors.length];

function useSubTeams() {
  return useQuery({
    queryKey: ["subteams"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canManage: boolean; subTeams: SubTeamT[] }> =>
      (await api<{ canManage: boolean; subTeams: SubTeamT[] }>("/subteams")) ?? { canManage: false, subTeams: [] },
  });
}

function Avatar({ name }: { name: string }) {
  return <span style={{ width: 26, height: 26, borderRadius: "50%", background: avatarColor(name), color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, flex: "none" }}>{initials(name) || "?"}</span>;
}

// ---- The team panel shown on a project/program/product/release detail -------
export function TeamPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const qc = useQueryClient();
  const key = ["team-assignments", entityType, entityId];
  const { data } = useQuery({
    queryKey: key, enabled: !!entityId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; assignments: AssignmentT[] }> =>
      (await api<{ canEdit: boolean; assignments: AssignmentT[] }>(`/teams/assignments/${entityType}/${entityId}`)) ?? { canEdit: false, assignments: [] },
  });
  const { data: subs } = useSubTeams();
  const [attach, setAttach] = useState(false);
  const [individual, setIndividual] = useState(false);
  const [editing, setEditing] = useState<AssignmentT | null>(null);

  const assignments = data?.assignments ?? [];
  const canEdit = data?.canEdit ?? false;
  const subTeams = subs?.subTeams ?? [];
  const attachedIds = new Set(assignments.map((a) => a.subTeamId));
  const available = subTeams.filter((s) => !attachedIds.has(s.id));

  const detach = useMutation({
    mutationFn: (id: number) => api(`/teams/assignments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast((e as Error).message, "error"),
  });

  return (
    <Card padding={20}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontFamily: font.head, fontSize: 15.5, fontWeight: 700, color: color.ink }}>Team</div>
        <div style={{ flex: 1 }} />
        {canEdit && <Button variant="secondary" onClick={() => setIndividual(true)}><Icon name="plus" size={15} /> Assign individual</Button>}
        {canEdit && <Button variant="secondary" onClick={() => setAttach(true)} disabled={available.length === 0} title={available.length === 0 ? (subTeams.length ? "Every sub-team is already attached" : "No sub-teams yet — a manager creates them in My Team") : undefined}><Icon name="plus" size={15} /> Attach sub-team</Button>}
      </div>
      {assignments.length === 0 ? (
        <div style={{ fontSize: 13, color: color.faint3, padding: "8px 2px" }}>No team attached yet.{canEdit && subTeams.length === 0 ? " Ask a manager to create a sub-team in My Team, then attach it here." : ""}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {assignments.map((a) => (
            <div key={a.id} style={{ border: `1px solid ${color.border}`, borderRadius: 11, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: color.text }}>{a.subTeamName}</span>
                {a.managerLabel && <span style={{ fontSize: 10.5, fontWeight: 600, color: color.faint, background: color.bg, borderRadius: 20, padding: "2px 9px" }}>{a.managerLabel}</span>}
                <div style={{ flex: 1 }} />
                {canEdit && (
                  <>
                    <button onClick={() => setEditing(a)} title="Edit who's working on this" style={{ background: "none", border: "none", cursor: "pointer", color: color.primary, display: "flex", padding: 4 }}><Icon name="edit" size={14} /></button>
                    <button onClick={() => { if (confirm(`Detach “${a.subTeamName}” from this ${entityType}?`)) detach.mutate(a.id); }} title="Detach sub-team" style={{ background: "none", border: "none", cursor: "pointer", color: "#A1282B", display: "flex", padding: 4 }}><Icon name="trash" size={14} /></button>
                  </>
                )}
              </div>
              {a.members.length === 0 ? (
                <div style={{ fontSize: 12, color: color.faint3 }}>No members selected.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {a.members.map((m) => {
                    const range = m.startDate || m.endDate ? `${m.startDate || "…"} → ${m.endDate || "…"}` : "";
                    const tip = [m.title, m.email, range, m.extAlloc ? `+${m.extAlloc}% extension` : ""].filter(Boolean).join(" · ");
                    return (
                      <span key={m.id} title={tip} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: color.bg, borderRadius: 20, padding: "3px 10px 3px 3px" }}>
                        <Avatar name={m.name} />
                        <span style={{ fontSize: 12, color: color.text }}>{m.name}</span>
                        {m.alloc > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: color.primary }}>{m.alloc}%</span>}
                        {m.extAlloc > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#8A6300" }} title="extension">+{m.extAlloc}%</span>}
                        {range && <span style={{ fontSize: 10, color: color.faint3, fontFamily: font.mono }}>{range}</span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {attach && <AttachModal entityType={entityType} entityId={entityId} available={available} onClose={() => setAttach(false)} invalidate={() => qc.invalidateQueries({ queryKey: key })} />}
      {individual && <IndividualModal entityType={entityType} entityId={entityId} onClose={() => setIndividual(false)} invalidate={() => qc.invalidateQueries({ queryKey: key })} />}
      {editing && <MembersModal assignment={editing} subTeam={subTeams.find((s) => s.id === editing.subTeamId)} onClose={() => setEditing(null)} invalidate={() => qc.invalidateQueries({ queryKey: key })} />}
    </Card>
  );
}

// Per-member allocation editor — %/hours toggle, date window, and an optional
// extension segment (extra capacity when the work runs long).
function AllocEditor({ value, onChange }: { value: AllocEdit; onChange: (a: AllocEdit) => void }) {
  const set = (patch: Partial<AllocEdit>) => onChange({ ...value, ...patch });
  const dateInput: React.CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 7, padding: "4px 6px", fontSize: 11.5, fontFamily: "inherit", color: color.text };
  const modeBtn = (active: boolean): React.CSSProperties => ({ fontSize: 11, fontWeight: 700, padding: "3px 8px", border: "none", cursor: "pointer", background: active ? color.primary : color.surfaceAlt, color: active ? "#fff" : color.subtle, fontFamily: "inherit" });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", borderRadius: 7, overflow: "hidden", border: `1px solid ${color.border2}` }}>
          <button type="button" onClick={() => set({ mode: "percent" })} style={modeBtn(value.mode === "percent")}>%</button>
          <button type="button" onClick={() => set({ mode: "hours" })} style={modeBtn(value.mode === "hours")}>h/wk</button>
        </span>
        <input type="number" min={0} max={value.mode === "percent" ? 100 : 60} value={value.value || ""}
          onChange={(e) => set({ value: Math.max(0, Number(e.target.value) || 0) })}
          style={{ width: 56, textAlign: "right", ...dateInput }} />
        {value.mode === "hours" && <span style={{ fontSize: 11, color: color.faint3 }}>≈ {pct("hours", value.value)}%</span>}
        <span style={{ fontSize: 11, color: color.faint3 }}>from</span>
        <input type="date" value={value.start} onChange={(e) => set({ start: e.target.value })} style={dateInput} />
        <span style={{ fontSize: 11, color: color.faint3 }}>to</span>
        <input type="date" value={value.end} onChange={(e) => set({ end: e.target.value })} style={dateInput} />
      </div>
      {value.extOn ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#FBF6E7", border: "1px solid #F0E4BE", borderRadius: 8, padding: "6px 8px" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A6300" }}>EXTENSION</span>
          <span style={{ display: "inline-flex", borderRadius: 7, overflow: "hidden", border: `1px solid ${color.border2}` }}>
            <button type="button" onClick={() => set({ extMode: "percent" })} style={modeBtn(value.extMode === "percent")}>%</button>
            <button type="button" onClick={() => set({ extMode: "hours" })} style={modeBtn(value.extMode === "hours")}>h/wk</button>
          </span>
          <input type="number" min={0} max={value.extMode === "percent" ? 100 : 60} value={value.extValue || ""}
            onChange={(e) => set({ extValue: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 52, textAlign: "right", ...dateInput }} />
          <input type="date" value={value.extStart} onChange={(e) => set({ extStart: e.target.value })} style={dateInput} />
          <input type="date" value={value.extEnd} onChange={(e) => set({ extEnd: e.target.value })} style={dateInput} />
          <button type="button" onClick={() => set({ extOn: false })} style={{ background: "none", border: "none", cursor: "pointer", color: color.faint3, fontSize: 11, fontFamily: "inherit" }}>remove</button>
        </div>
      ) : (
        <button type="button" onClick={() => set({ extOn: true })} style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", color: color.primary, fontSize: 11, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>+ Add extension (extra hours if it runs long)</button>
      )}
    </div>
  );
}

function MemberChecklist({ members, selected, onToggle, edits, onEdit }: {
  members: TeamMemberT[]; selected: Set<string>; onToggle: (name: string) => void;
  edits: Record<string, AllocEdit>; onEdit: (name: string, a: AllocEdit) => void;
}) {
  if (members.length === 0) return <div style={{ fontSize: 12, color: color.faint3 }}>This sub-team has no members yet — add them in My Team.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto" }}>
      {members.map((m) => {
        const on = selected.has(m.name);
        return (
          <div key={m.id}
            style={{ background: on ? "#EAF2FB" : color.surfaceAlt, border: `1px solid ${on ? "#CFE0F4" : color.border}`, borderRadius: 9, padding: "8px 10px" }}>
            <button type="button" onClick={() => onToggle(m.name)} style={{ display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: "none", border: "none", width: "100%", minWidth: 0, padding: 0 }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? color.primary : "#fff", border: on ? "none" : `1.5px solid ${color.border2}` }}>{on && <Icon name="check" size={11} color="#fff" />}</span>
              <Avatar name={m.name} />
              <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 12.5, color: color.text }}>{m.name}</span>{m.title && <span style={{ fontSize: 11, color: color.faint3 }}> · {m.title}</span>}</span>
            </button>
            {on && <AllocEditor value={edits[m.name] ?? blankAlloc()} onChange={(a) => onEdit(m.name, a)} />}
          </div>
        );
      })}
    </div>
  );
}

function AttachModal({ entityType, entityId, available, onClose, invalidate }: { entityType: string; entityId: string; available: SubTeamT[]; onClose: () => void; invalidate: () => void }) {
  const [subId, setSubId] = useState(available[0]?.id ?? 0);
  const sub = available.find((s) => s.id === subId);
  const [selected, setSelected] = useState<Set<string>>(new Set(available[0]?.members.map((m) => m.name) ?? []));
  const [edits, setEdits] = useState<Record<string, AllocEdit>>({});
  const pick = (id: number) => { setSubId(id); setSelected(new Set(available.find((s) => s.id === id)?.members.map((m) => m.name) ?? [])); setEdits({}); };
  const toggle = (n: string) => setSelected((prev) => { const s = new Set(prev); if (s.has(n)) s.delete(n); else s.add(n); return s; });
  const onEdit = (n: string, a: AllocEdit) => setEdits((prev) => ({ ...prev, [n]: a }));
  const attach = useMutation({
    mutationFn: () => api(`/teams/assignments/${entityType}/${entityId}`, {
      method: "POST",
      body: JSON.stringify({ subTeamId: subId, members: (sub?.members ?? []).filter((m) => selected.has(m.name)).map((m) => allocReq(m.name, m.email, m.title, edits[m.name] ?? blankAlloc())) }),
    }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toast((e as Error).message, "error"),
  });

  return (
    <Modal onClose={onClose} width={520} label="Attach a sub-team">
      <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>Sub-team</div>
      <Select value={String(subId)} onChange={(e) => pick(Number(e.target.value))} style={{ marginBottom: 14 }}>
        {available.map((s) => <option key={s.id} value={s.id}>{s.name}{s.managerLabel ? ` · ${s.managerLabel}` : ""}</option>)}
      </Select>
      <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 6 }}>Who's working on this {entityType}? ({selected.size})</div>
      <MemberChecklist members={sub?.members ?? []} selected={selected} onToggle={toggle} edits={edits} onEdit={onEdit} />
      <div style={{ fontSize: 11, color: color.faint3, marginTop: 8 }}>Set each person's allocation as a % or weekly hours (40h = 100%), with an optional start/end and an extension if the work runs long.</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => subId && attach.mutate()} disabled={!subId || attach.isPending}>{attach.isPending ? "Attaching…" : "Attach"}</Button>
      </div>
    </Modal>
  );
}

function MembersModal({ assignment, subTeam, onClose, invalidate }: { assignment: AssignmentT; subTeam?: SubTeamT; onClose: () => void; invalidate: () => void }) {
  // Choose from the sub-team's full roster; pre-check the currently-assigned ones.
  const roster: TeamMemberT[] = subTeam?.members ?? assignment.members;
  const [selected, setSelected] = useState<Set<string>>(new Set(assignment.members.map((m) => m.name)));
  const [edits, setEdits] = useState<Record<string, AllocEdit>>(
    Object.fromEntries(assignment.members.map((m) => [m.name, allocFrom(m)])));
  const toggle = (n: string) => setSelected((prev) => { const s = new Set(prev); if (s.has(n)) s.delete(n); else s.add(n); return s; });
  const onEdit = (n: string, a: AllocEdit) => setEdits((prev) => ({ ...prev, [n]: a }));
  const save = useMutation({
    mutationFn: () => api(`/teams/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ members: roster.filter((m) => selected.has(m.name)).map((m) => allocReq(m.name, m.email, m.title, edits[m.name] ?? blankAlloc())) }),
    }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toast((e as Error).message, "error"),
  });

  return (
    <Modal onClose={onClose} width={520} label={`Members · ${assignment.subTeamName}`}>
      <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 6 }}>Who's working on this? ({selected.size})</div>
      <MemberChecklist members={roster} selected={selected} onToggle={toggle} edits={edits} onEdit={onEdit} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </Modal>
  );
}

interface DirEntry { name: string; email: string; title: string }
function IndividualModal({ entityType, entityId, onClose, invalidate }: { entityType: string; entityId: string; onClose: () => void; invalidate: () => void }) {
  const { data: dir = [] } = useQuery({
    queryKey: ["team-roster"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<DirEntry[]> => { try { return (await api<DirEntry[]>("/teams/roster")) ?? []; } catch { return []; } },
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [manual, setManual] = useState(false);
  const [alloc, setAlloc] = useState<AllocEdit>(blankAlloc());
  const pick = (n: string) => { const d = dir.find((x) => x.name === n); setName(n); setEmail(d?.email ?? ""); setTitle(d?.title ?? ""); };
  const add = useMutation({
    mutationFn: () => api(`/teams/assignments/${entityType}/${entityId}/individual`, {
      method: "POST", body: JSON.stringify(allocReq(name.trim(), email.trim(), title.trim(), alloc)),
    }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toast((e as Error).message, "error"),
  });

  return (
    <Modal onClose={onClose} width={520} label={`Assign an individual to this ${entityType}`}>
      <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>Person</div>
      {!manual && dir.length > 0 ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <Select value={name} onChange={(e) => pick(e.target.value)} style={{ flex: 1 }}>
            <option value="">Pick from directory…</option>
            {dir.map((d) => <option key={d.name} value={d.name}>{d.name}{d.title ? ` · ${d.title}` : ""}</option>)}
          </Select>
          <button onClick={() => { setManual(true); setName(""); setEmail(""); setTitle(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: color.primary, fontSize: 11.5, fontFamily: "inherit" }}>+ manual</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ flex: 1 }} />
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" style={{ flex: 1 }} />
          {dir.length > 0 && <button onClick={() => setManual(false)} style={{ background: "none", border: "none", cursor: "pointer", color: color.primary, fontSize: 11.5, fontFamily: "inherit" }}>from directory</button>}
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 2 }}>Allocation</div>
      <AllocEditor value={alloc} onChange={setAlloc} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => name.trim() && add.mutate()} disabled={!name.trim() || add.isPending}>{add.isPending ? "Assigning…" : "Assign"}</Button>
      </div>
    </Modal>
  );
}

// ---- Sub-team management (managers) — used on the My Team screen -------------
export function SubTeamManager() {
  const qc = useQueryClient();
  const { data } = useSubTeams();
  const [creating, setCreating] = useState(false);
  const subTeams = (data?.subTeams ?? []).filter((s) => s.canManage);
  const canManage = data?.canManage ?? false;
  if (!canManage) return null;

  return (
    <Card padding={20} style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ fontFamily: font.head, fontSize: 15.5, fontWeight: 700, color: color.ink }}>My sub-teams</div>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> New sub-team</Button>
      </div>
      <div style={{ fontSize: 12.5, color: color.faint, marginBottom: 14 }}>Named rosters you own. Project, program, product and release managers attach these to their work and pick who's involved.</div>
      {subTeams.length === 0 ? (
        <div style={{ fontSize: 13, color: color.faint3, padding: "6px 2px" }}>No sub-teams yet. Create one, then add its members.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {subTeams.map((s) => <SubTeamCard key={s.id} team={s} onChange={() => qc.invalidateQueries({ queryKey: ["subteams"] })} />)}
        </div>
      )}
      {creating && <SubTeamEditModal onClose={() => setCreating(false)} onDone={() => qc.invalidateQueries({ queryKey: ["subteams"] })} />}
    </Card>
  );
}

interface Candidate { name: string; email: string; title: string }
function SubTeamCard({ team, onChange }: { team: SubTeamT; onChange: () => void }) {
  const [addName, setAddName] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [manual, setManual] = useState(false);
  const [edit, setEdit] = useState(false);
  // The manager's own directory members (Entra), scoped to what they manage.
  const { data: cand } = useQuery({
    queryKey: ["subteam-candidates"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<{ members: Candidate[] }> => (await api<{ members: Candidate[] }>("/subteams/candidates")) ?? { members: [] },
  });
  const candidates = (cand?.members ?? []).filter((m) => !team.members.some((tm) => tm.name === m.name));
  const addMember = useMutation({
    mutationFn: (body: { name: string; email?: string; title?: string }) => api(`/subteams/${team.id}/members`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { setAddName(""); setAddTitle(""); onChange(); },
    onError: (e) => toast((e as Error).message, "error"),
  });
  const addFromDirectory = (name: string) => { const m = candidates.find((c) => c.name === name); if (m) addMember.mutate({ name: m.name, email: m.email, title: m.title }); };
  const delMember = useMutation({
    mutationFn: (id: number) => api(`/subteams/members/${id}`, { method: "DELETE" }),
    onSuccess: onChange, onError: (e) => toast((e as Error).message, "error"),
  });
  const del = useMutation({
    mutationFn: () => api(`/subteams/${team.id}`, { method: "DELETE" }),
    onSuccess: onChange, onError: (e) => toast((e as Error).message, "error"),
  });

  return (
    <div style={{ border: `1px solid ${color.border}`, borderRadius: 11, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: color.text }}>{team.name}</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: color.faint, background: color.bg, borderRadius: 20, padding: "2px 9px" }}>{team.managerLabel}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setEdit(true)} title="Rename / describe" style={{ background: "none", border: "none", cursor: "pointer", color: color.primary, display: "flex", padding: 4 }}><Icon name="edit" size={14} /></button>
        <button onClick={() => { if (confirm(`Delete sub-team “${team.name}”? It will be detached from anything it's assigned to.`)) del.mutate(); }} title="Delete sub-team" style={{ background: "none", border: "none", cursor: "pointer", color: "#A1282B", display: "flex", padding: 4 }}><Icon name="trash" size={14} /></button>
      </div>
      {team.description && <div style={{ fontSize: 12, color: color.subtle, marginBottom: 9 }}>{team.description}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 11 }}>
        {team.members.length === 0 ? <span style={{ fontSize: 12, color: color.faint3 }}>No members yet.</span> : team.members.map((m) => (
          <span key={m.id} title={m.title} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: color.bg, borderRadius: 20, padding: "3px 6px 3px 3px" }}>
            <Avatar name={m.name} /><span style={{ fontSize: 12, color: color.text }}>{m.name}</span>
            <button onClick={() => delMember.mutate(m.id)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: color.faint3, display: "flex", padding: 0 }}><Icon name="x" size={12} /></button>
          </span>
        ))}
      </div>
      {manual || candidates.length === 0 ? (
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Add member — name" style={{ flex: 1 }} />
          <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="Title (optional)" style={{ flex: 1 }} />
          <Button variant="secondary" onClick={() => addName.trim() && addMember.mutate({ name: addName.trim(), title: addTitle.trim() })} disabled={!addName.trim() || addMember.isPending}>Add</Button>
          {candidates.length > 0 && <button onClick={() => setManual(false)} title="Pick from your team instead" style={{ background: "none", border: "none", cursor: "pointer", color: color.primary, fontSize: 11.5, fontFamily: "inherit" }}>from team</button>}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <Select value="" onChange={(e) => { if (e.target.value) addFromDirectory(e.target.value); }} style={{ flex: 1 }}>
            <option value="">Add a team member…</option>
            {candidates.map((c) => <option key={c.name} value={c.name}>{c.name}{c.title ? ` · ${c.title}` : ""}</option>)}
          </Select>
          <button onClick={() => setManual(true)} title="Add someone not in your synced team" style={{ background: "none", border: "none", cursor: "pointer", color: color.primary, fontSize: 11.5, fontFamily: "inherit" }}>+ manual</button>
        </div>
      )}
      {edit && <SubTeamEditModal team={team} onClose={() => setEdit(false)} onDone={onChange} />}
    </div>
  );
}

function SubTeamEditModal({ team, onClose, onDone }: { team?: SubTeamT; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const save = useMutation({
    mutationFn: () => team
      ? api(`/subteams/${team.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim(), description: description.trim() }) })
      : api("/subteams", { method: "POST", body: JSON.stringify({ name: name.trim(), description: description.trim() }) }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e) => toast((e as Error).message, "error"),
  });
  return (
    <Modal onClose={onClose} width={420} label={team ? "Edit sub-team" : "New sub-team"}>
      <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>Name</div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Payments squad" style={{ marginBottom: 13 }} />
      <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>Description (optional)</div>
      <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this team does" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => name.trim() && save.mutate()} disabled={!name.trim() || save.isPending}>{save.isPending ? "Saving…" : team ? "Save" : "Create"}</Button>
      </div>
    </Modal>
  );
}
