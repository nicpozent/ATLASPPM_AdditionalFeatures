import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Card, EmptyBlock, Button, Input, Select, Modal as Overlay, RowMenu, MenuItem, MenuDivider } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { Icon } from "@/components/Icon";
import { TeamPanel } from "@/components/TeamPanel";
import { SkillsPanel } from "@/components/SkillsPanel";

// ---- data ----------------------------------------------------------------
type ReleaseStatus = "Planned" | "In progress" | "Deployed" | "Rolled back" | "Completed" | "Cancelled";
type ReleaseScope = "Product" | "Project" | "Program";
const RELEASE_STATUSES: ReleaseStatus[] = ["Planned", "In progress", "Deployed", "Rolled back", "Completed", "Cancelled"];

type Release = {
  id: string; name: string; reqs: number; crs: number; owner: string;
  link: string; scope: ReleaseScope; date: string; env: string;
  progress: number; risk: string; status: ReleaseStatus; archived?: boolean;
};

function useReleases() {
  return useQuery({
    queryKey: ["releases"], retry: false, staleTime: 60000,
    queryFn: async () => {
      try { return (await api<Release[]>("/releases")) ?? []; }
      catch { return []; }
    },
  });
}

const SCOPE_OPTS = [
  { value: "all", label: "All scopes" },
  { value: "Product", label: "Products" },
  { value: "Project", label: "Projects" },
  { value: "Program", label: "Programs" },
];
const STATUS_OPTS = [
  { value: "all", label: "All statuses" },
  { value: "Planned", label: "Planned" },
  { value: "In progress", label: "In progress" },
  { value: "Deployed", label: "Deployed" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

const STATUS_COLORS: Record<string, { ink: string; tint: string }> = {
  Planned: { ink: "#566077", tint: "#EEF0F4" },
  "In progress": { ink: "#0C5798", tint: "#E6EFFB" },
  Deployed: { ink: "#0B6B37", tint: "#E7F4EC" },
  "Rolled back": { ink: "#A1282B", tint: "#FBE7E8" },
  Completed: { ink: "#0C5798", tint: "#E6EFFB" },
  Cancelled: { ink: "#566077", tint: "#EEF0F4" },
};
const RISK_COLORS: Record<string, { ink: string; tint: string }> = {
  Low: { ink: "#0B6B37", tint: "#E7F4EC" },
  Medium: { ink: "#8A6300", tint: "#FBF2D7" },
  High: { ink: "#A1282B", tint: "#FBE7E8" },
};

const GRID = "0.6fr 1.7fr 1.2fr 0.9fr 0.9fr 1fr 0.8fr 0.9fr 44px";

const selectStyle: React.CSSProperties = {
  border: `1px solid ${color.border2}`, borderRadius: 8, padding: "7px 11px",
  fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", color: color.text,
  background: "#fff", cursor: "pointer",
};

function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
      fontSize: 13, fontWeight: 600, fontFamily: "inherit",
      background: active ? "#fff" : "transparent", color: active ? color.primary : "#6A7488",
      boxShadow: active ? "0 1px 3px rgba(20,26,60,0.12)" : "none",
    }}>{children}</button>
  );
}

interface NewRelease { name: string; owner: string; link: string; scope: ReleaseScope; date: string; env: string; risk: string }

export default function Releases() {
  const [scope, setScope] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"table" | "calendar">("table");
  const [modal, setModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Release | null>(null);
  const [editing, setEditing] = useState<Release | null>(null);
  const [teamFor, setTeamFor] = useState<Release | null>(null);
  const { data: releases = [] } = useReleases();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const mayCreate = can("cap-projects", "E");
  const mayEdit = can("cap-projects", "E");
  const mayDelete = can("cap-projects", "F");
  const createRelease = useMutation({
    mutationFn: (body: NewRelease) => api<Release>("/releases", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["releases"] }),
  });
  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/releases/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["releases"] }),
  });
  const archive = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api(`/releases/${id}/${on ? "archive" : "unarchive"}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["releases"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/releases/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["releases"] }); setConfirmDel(null); },
  });
  const editRelease = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Release> }) =>
      api(`/releases/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["releases"] }); setEditing(null); },
  });

  const live = releases.filter((r) => !r.archived);
  const archivedCount = releases.filter((r) => r.archived).length;
  const stats = {
    total: live.length,
    deployed: live.filter((r) => r.status === "Deployed").length,
    inProgress: live.filter((r) => r.status === "In progress").length,
    planned: live.filter((r) => r.status === "Planned").length,
  };
  const list = releases
    .filter((r) => (showArchived ? r.archived : !r.archived))
    .filter((r) => status === "all" || r.status === status)
    .filter((r) => scope === "all" || r.scope === scope);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* header + filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.subtle }}>
          Release calendar &amp; deployment tracking — linked to requirements &amp; change requests.
        </div>
        <div style={{ flex: 1 }} />
        <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ ...selectStyle, marginRight: 8 }}>
          {SCOPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...selectStyle, marginRight: 8 }}>
          {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(archivedCount > 0 || showArchived) && (
          <button onClick={() => setShowArchived((s) => !s)} style={{ ...selectStyle, marginRight: 8, display: "inline-flex", alignItems: "center", gap: 6, color: showArchived ? color.primary : color.textMuted, background: showArchived ? color.primaryTint : "#fff", border: `1px solid ${showArchived ? "#CFE0F4" : color.border2}` }}>
            <Icon name="archive" size={14} /> Archived · {archivedCount}
          </button>
        )}
        <Button onClick={() => setModal(true)} disabled={!mayCreate} title={mayCreate ? undefined : "Your role can't create releases"}><Icon name="plus" size={16} /> New release</Button>
      </div>
      {modal && <NewReleaseModal submitting={createRelease.isPending} onClose={() => setModal(false)}
        onCreate={(body) => createRelease.mutate(body, { onSuccess: () => setModal(false) })} />}

      {/* stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13, marginBottom: 18 }}>
        {[
          ["Total releases", stats.total, color.navy],
          ["Deployed", stats.deployed, color.successInk],
          ["In progress", stats.inProgress, color.primary],
          ["Planned", stats.planned, "#566077"],
        ].map(([label, value, c]) => (
          <div key={label as string} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: color.faint }}>{label}</div>
            <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: c as string, marginTop: 3 }}>{value as number}</div>
          </div>
        ))}
      </div>

      {/* per-status tabs — a holistic "All" plus one tab per lifecycle status */}
      {!showArchived && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
          {(["all", ...RELEASE_STATUSES] as string[]).map((s) => {
            const count = s === "all" ? live.length : live.filter((r) => r.status === s).length;
            const active = status === s;
            const sc = s === "all" ? { ink: "#fff", tint: color.primary } : (STATUS_COLORS[s] ?? STATUS_COLORS.Planned);
            return (
              <button key={s} onClick={() => setStatus(s)} style={{
                fontSize: 12.5, fontWeight: 600, padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit",
                color: s === "all" ? "#fff" : sc.ink, background: sc.tint, boxShadow: active ? "0 0 0 2px #11163A33" : "none",
              }}>{s === "all" ? "All" : s} · {count}</button>
            );
          })}
        </div>
      )}

      {/* view tabs */}
      <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2, marginBottom: 14 }}>
        <PillBtn active={view === "table"} onClick={() => setView("table")}>Table</PillBtn>
        <PillBtn active={view === "calendar"} onClick={() => setView("calendar")}>Calendar</PillBtn>
      </div>

      {view === "calendar" ? (
        <Card padding={18}>
          <EmptyBlock message="No releases scheduled. The calendar will populate as releases are planned." minHeight={220} />
        </Card>
      ) : (
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "13px 22px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
            <div>Release</div><div>Name</div><div>Linked to</div><div>Target date</div>
            <div>Environment</div><div>Progress</div><div>Risk</div><div>Status</div><div />
          </div>
          {list.length === 0 ? (
            <div style={{ padding: "56px 22px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>
              {releases.length === 0 ? "No releases yet. Plan a release to start tracking deployments." : "No releases match these filters."}
            </div>
          ) : list.map((r) => {
            const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.Planned;
            const rc = RISK_COLORS[r.risk] ?? RISK_COLORS.Low;
            return (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", padding: "14px 22px", borderBottom: "1px solid #F2F4F9" }}>
                <div style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.text }}>{r.id}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{r.name}</span>
                    {r.archived && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#566077", background: "#EEF0F4", borderRadius: 5, padding: "1px 6px", letterSpacing: "0.03em", textTransform: "uppercase" }}>Archived</span>}
                  </div>
                  <div style={{ fontSize: 11, color: color.faint3 }}>{r.reqs} reqs · {r.crs} CRs · {r.owner}</div>
                </div>
                <div style={{ minWidth: 0, fontSize: 12.5, color: color.text }}>
                  <div>{r.link || "—"}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#0C5798", textTransform: "uppercase", letterSpacing: "0.03em" }}>{r.scope}</div>
                </div>
                <div style={{ fontSize: 12.5, color: color.textMuted }}>{r.date}</div>
                <div><span style={{ fontSize: 11, fontWeight: 600, color: color.textMuted, background: "#EEF1F6", padding: "3px 9px", borderRadius: 6 }}>{r.env}</span></div>
                <div style={{ paddingRight: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${r.progress}%`, background: "#0F6CBD", borderRadius: 4 }} />
                    </div>
                    <span style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 700, color: color.subtle }}>{r.progress}%</span>
                  </div>
                </div>
                <div><span style={{ fontSize: 11, fontWeight: 700, color: rc.ink, background: rc.tint, padding: "3px 9px", borderRadius: 6 }}>{r.risk}</span></div>
                <div>
                  {mayCreate ? (
                    <select value={r.status} onChange={(e) => changeStatus.mutate({ id: r.id, status: e.target.value })}
                      style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, border: "none", borderRadius: 6, padding: "3px 6px", cursor: "pointer", fontFamily: "inherit" }}>
                      {RELEASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 7px", borderRadius: 6 }}>{r.status}</span>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  {(mayEdit || mayDelete) && (
                    <RowMenu ariaLabel="Release actions" width={176}>
                      {(close) => (
                        <>
                          {mayEdit && <MenuItem label="Edit details" icon={<Icon name="edit" size={15} />} onClick={() => { setEditing(r); close(); }} />}
                          <MenuItem label="Team" icon={<Icon name="users" size={15} />} onClick={() => { setTeamFor(r); close(); }} />
                          <MenuDivider />
                          {mayEdit && (r.archived
                            ? <MenuItem label="Restore" icon={<Icon name="refresh" size={15} />} onClick={() => { archive.mutate({ id: r.id, on: false }); close(); }} />
                            : <MenuItem label="Archive" icon={<Icon name="archive" size={15} />} onClick={() => { archive.mutate({ id: r.id, on: true }); close(); }} />)}
                          {mayDelete && <><MenuDivider /><MenuItem label="Delete permanently" icon={<Icon name="trash" size={15} />} danger onClick={() => { setConfirmDel(r); close(); }} /></>}
                        </>
                      )}
                    </RowMenu>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {editing && (
        <EditReleaseModal release={editing} submitting={editRelease.isPending}
          onClose={() => setEditing(null)}
          onSave={(body) => editRelease.mutate({ id: editing.id, body })} />
      )}

      {teamFor && (
        <Overlay onClose={() => setTeamFor(null)} width={520} label={`Team · ${teamFor.name}`}>
          <TeamPanel entityType="release" entityId={teamFor.id} />
          <div style={{ marginTop: 14 }}><SkillsPanel entityType="release" entityId={teamFor.id} /></div>
        </Overlay>
      )}

      {confirmDel && (
        <Overlay onClose={() => setConfirmDel(null)} width={440}>
          <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.navy, marginBottom: 10 }}>Delete release</div>
          <div style={{ fontSize: 13.5, color: color.text, lineHeight: 1.5, marginBottom: 8 }}>
            Permanently delete <strong>{confirmDel.name}</strong> <span style={{ fontFamily: font.mono, color: color.faint3 }}>({confirmDel.id})</span>?
          </div>
          <div style={{ fontSize: 12.5, color: "#A1282B", background: "#FBE7E8", borderRadius: 8, padding: "9px 12px", marginBottom: 14 }}>This can't be undone. To keep the record, archive it or mark it Cancelled instead.</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button variant="secondary" onClick={() => setConfirmDel(null)}>Cancel</Button>
            <button onClick={() => del.mutate(confirmDel.id)} disabled={del.isPending} style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", background: "#D13438", border: "none", padding: "10px 16px", borderRadius: 10, cursor: del.isPending ? "not-allowed" : "pointer", opacity: del.isPending ? 0.6 : 1, fontFamily: "inherit" }}>{del.isPending ? "Deleting…" : "Delete permanently"}</button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function RelLbl({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", margin: "12px 0 5px" }}>{children}</label>;
}

function NewReleaseModal({ onClose, onCreate, submitting }: {
  onClose: () => void; onCreate: (r: NewRelease) => void; submitting?: boolean;
}) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [link, setLink] = useState("");
  const [scope, setScope] = useState<ReleaseScope>("Product");
  const [date, setDate] = useState("");
  const [env, setEnv] = useState("Staging");
  const [risk, setRisk] = useState("Low");
  const submit = () => { if (name.trim()) onCreate({ name: name.trim(), owner: owner.trim(), link: link.trim(), scope, date, env, risk }); };
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.navy, marginBottom: 4 }}>New release</div>
      <div style={{ fontSize: 12.5, color: color.faint3, marginBottom: 16 }}>Schedule a release; requirements &amp; change requests link in as it progresses.</div>
      <RelLbl>Name</RelLbl>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Storefront 24.5" />
      <RelLbl>Owner</RelLbl>
      <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Release owner" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <RelLbl>Scope</RelLbl>
          <Select value={scope} onChange={(e) => setScope(e.target.value as ReleaseScope)}>
            <option value="Product">Product</option>
            <option value="Project">Project</option>
            <option value="Program">Program</option>
          </Select>
        </div>
        <div>
          <RelLbl>Linked to</RelLbl>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="PRD-01 / PRJ-204" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <RelLbl>Target date</RelLbl>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <RelLbl>Environment</RelLbl>
          <Select value={env} onChange={(e) => setEnv(e.target.value)}>
            <option value="Staging">Staging</option>
            <option value="Production">Production</option>
          </Select>
        </div>
        <div>
          <RelLbl>Risk</RelLbl>
          <Select value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </Select>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={submitting || !name.trim()}>{submitting ? "Creating…" : "Create release"}</Button>
      </div>
    </Overlay>
  );
}

function EditReleaseModal({ release, onClose, onSave, submitting }: {
  release: Release; onClose: () => void; onSave: (body: Partial<Release>) => void; submitting?: boolean;
}) {
  const [name, setName] = useState(release.name);
  const [owner, setOwner] = useState(release.owner);
  const [link, setLink] = useState(release.link);
  const [scope, setScope] = useState<ReleaseScope>(release.scope as ReleaseScope);
  const [date, setDate] = useState(release.date);
  const [env, setEnv] = useState(release.env);
  const [risk, setRisk] = useState(release.risk);
  const [status, setStatus] = useState<ReleaseStatus>(release.status as ReleaseStatus);
  const [reqs, setReqs] = useState(release.reqs);
  const [crs, setCrs] = useState(release.crs);
  const [progress, setProgress] = useState(release.progress);
  const submit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), owner: owner.trim(), link: link.trim(), scope, date, env, risk, status, reqs, crs, progress });
  };
  return (
    <Overlay onClose={onClose} label={`Edit ${release.name}`}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.navy, marginBottom: 4 }}>Edit release</div>
      <div style={{ fontSize: 12.5, color: color.faint3, marginBottom: 16 }}>{release.id}</div>
      <RelLbl>Name</RelLbl>
      <Input value={name} onChange={(e) => setName(e.target.value)} />
      <RelLbl>Owner</RelLbl>
      <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <RelLbl>Scope</RelLbl>
          <Select value={scope} onChange={(e) => setScope(e.target.value as ReleaseScope)}>
            <option value="Product">Product</option>
            <option value="Project">Project</option>
            <option value="Program">Program</option>
          </Select>
        </div>
        <div>
          <RelLbl>Linked to</RelLbl>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="PRD-01 / PRJ-204" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <RelLbl>Target date</RelLbl>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <RelLbl>Environment</RelLbl>
          <Select value={env} onChange={(e) => setEnv(e.target.value)}>
            <option value="Staging">Staging</option>
            <option value="Production">Production</option>
          </Select>
        </div>
        <div>
          <RelLbl>Risk</RelLbl>
          <Select value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </Select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <RelLbl>Requirements</RelLbl>
          <Input type="number" min={0} value={reqs} onChange={(e) => setReqs(Number(e.target.value))} />
        </div>
        <div>
          <RelLbl>Change requests</RelLbl>
          <Input type="number" min={0} value={crs} onChange={(e) => setCrs(Number(e.target.value))} />
        </div>
        <div>
          <RelLbl>Progress %</RelLbl>
          <Input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
        </div>
      </div>
      <RelLbl>Status</RelLbl>
      <Select value={status} onChange={(e) => setStatus(e.target.value as ReleaseStatus)}>
        {RELEASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={submitting || !name.trim()}>{submitting ? "Saving…" : "Save changes"}</Button>
      </div>
    </Overlay>
  );
}
