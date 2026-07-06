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
interface AssignmentT { id: number; subTeamId: number; subTeamName: string; managerLabel: string; members: TeamMemberT[] }

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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: font.head, fontSize: 15.5, fontWeight: 700, color: color.ink }}>Team</div>
        <div style={{ flex: 1 }} />
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
                  {a.members.map((m) => (
                    <span key={m.id} title={[m.title, m.email].filter(Boolean).join(" · ")} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: color.bg, borderRadius: 20, padding: "3px 10px 3px 3px" }}>
                      <Avatar name={m.name} /><span style={{ fontSize: 12, color: color.text }}>{m.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {attach && <AttachModal entityType={entityType} entityId={entityId} available={available} onClose={() => setAttach(false)} invalidate={() => qc.invalidateQueries({ queryKey: key })} />}
      {editing && <MembersModal assignment={editing} subTeam={subTeams.find((s) => s.id === editing.subTeamId)} onClose={() => setEditing(null)} invalidate={() => qc.invalidateQueries({ queryKey: key })} />}
    </Card>
  );
}

function MemberChecklist({ members, selected, onToggle }: { members: TeamMemberT[]; selected: Set<string>; onToggle: (name: string) => void }) {
  if (members.length === 0) return <div style={{ fontSize: 12, color: color.faint3 }}>This sub-team has no members yet — add them in My Team.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
      {members.map((m) => {
        const on = selected.has(m.name);
        return (
          <button key={m.id} type="button" onClick={() => onToggle(m.name)}
            style={{ display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: on ? "#EAF2FB" : color.surfaceAlt, border: `1px solid ${on ? "#CFE0F4" : color.border}`, borderRadius: 9, padding: "7px 10px" }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? color.primary : "#fff", border: on ? "none" : `1.5px solid ${color.border2}` }}>{on && <Icon name="check" size={11} color="#fff" />}</span>
            <Avatar name={m.name} />
            <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 12.5, color: color.text }}>{m.name}</span>{m.title && <span style={{ fontSize: 11, color: color.faint3 }}> · {m.title}</span>}</span>
          </button>
        );
      })}
    </div>
  );
}

function AttachModal({ entityType, entityId, available, onClose, invalidate }: { entityType: string; entityId: string; available: SubTeamT[]; onClose: () => void; invalidate: () => void }) {
  const [subId, setSubId] = useState(available[0]?.id ?? 0);
  const sub = available.find((s) => s.id === subId);
  const [selected, setSelected] = useState<Set<string>>(new Set(available[0]?.members.map((m) => m.name) ?? []));
  const pick = (id: number) => { setSubId(id); setSelected(new Set(available.find((s) => s.id === id)?.members.map((m) => m.name) ?? [])); };
  const toggle = (n: string) => setSelected((prev) => { const s = new Set(prev); if (s.has(n)) s.delete(n); else s.add(n); return s; });
  const attach = useMutation({
    mutationFn: () => api(`/teams/assignments/${entityType}/${entityId}`, {
      method: "POST",
      body: JSON.stringify({ subTeamId: subId, members: (sub?.members ?? []).filter((m) => selected.has(m.name)).map((m) => ({ name: m.name, email: m.email, title: m.title })) }),
    }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toast((e as Error).message, "error"),
  });

  return (
    <Modal onClose={onClose} width={460} label="Attach a sub-team">
      <div style={{ fontSize: 12, fontWeight: 600, color: "#56607A", marginBottom: 5 }}>Sub-team</div>
      <Select value={String(subId)} onChange={(e) => pick(Number(e.target.value))} style={{ marginBottom: 14 }}>
        {available.map((s) => <option key={s.id} value={s.id}>{s.name}{s.managerLabel ? ` · ${s.managerLabel}` : ""}</option>)}
      </Select>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#56607A", marginBottom: 6 }}>Who's working on this {entityType}? ({selected.size})</div>
      <MemberChecklist members={sub?.members ?? []} selected={selected} onToggle={toggle} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => subId && attach.mutate()} disabled={!subId || attach.isPending}>{attach.isPending ? "Attaching…" : "Attach"}</Button>
      </div>
    </Modal>
  );
}

function MembersModal({ assignment, subTeam, onClose, invalidate }: { assignment: AssignmentT; subTeam?: SubTeamT; onClose: () => void; invalidate: () => void }) {
  // Choose from the sub-team's full roster; pre-check the currently-assigned ones.
  const roster = subTeam?.members ?? assignment.members;
  const [selected, setSelected] = useState<Set<string>>(new Set(assignment.members.map((m) => m.name)));
  const toggle = (n: string) => setSelected((prev) => { const s = new Set(prev); if (s.has(n)) s.delete(n); else s.add(n); return s; });
  const save = useMutation({
    mutationFn: () => api(`/teams/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ members: roster.filter((m) => selected.has(m.name)).map((m) => ({ name: m.name, email: m.email, title: m.title })) }),
    }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toast((e as Error).message, "error"),
  });

  return (
    <Modal onClose={onClose} width={460} label={`Members · ${assignment.subTeamName}`}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#56607A", marginBottom: 6 }}>Who's working on this? ({selected.size})</div>
      <MemberChecklist members={roster} selected={selected} onToggle={toggle} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
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

function SubTeamCard({ team, onChange }: { team: SubTeamT; onChange: () => void }) {
  const [addName, setAddName] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [edit, setEdit] = useState(false);
  const addMember = useMutation({
    mutationFn: () => api(`/subteams/${team.id}/members`, { method: "POST", body: JSON.stringify({ name: addName.trim(), title: addTitle.trim() }) }),
    onSuccess: () => { setAddName(""); setAddTitle(""); onChange(); },
    onError: (e) => toast((e as Error).message, "error"),
  });
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
      <div style={{ display: "flex", gap: 7 }}>
        <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Add member — name" style={{ flex: 1 }} />
        <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="Title (optional)" style={{ flex: 1 }} />
        <Button variant="secondary" onClick={() => addName.trim() && addMember.mutate()} disabled={!addName.trim() || addMember.isPending}>Add</Button>
      </div>
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
      <div style={{ fontSize: 12, fontWeight: 600, color: "#56607A", marginBottom: 5 }}>Name</div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Payments squad" style={{ marginBottom: 13 }} />
      <div style={{ fontSize: 12, fontWeight: 600, color: "#56607A", marginBottom: 5 }}>Description (optional)</div>
      <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this team does" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => name.trim() && save.mutate()} disabled={!name.trim() || save.isPending}>{save.isPending ? "Saving…" : team ? "Save" : "Create"}</Button>
      </div>
    </Modal>
  );
}
