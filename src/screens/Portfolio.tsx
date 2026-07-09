import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, HealthPill, ProgressBar, statusDot, Button, Input, Select, Textarea, Modal, RowMenu, MenuItem, MenuDivider } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { useRole } from "@/components/RoleContext";
import { SCREENS } from "@/nav";
import { DEPARTMENTS } from "@/departments";
import {
  STATUS_FILTERS, useProjects, useBlockers, type Project, type ProjectBucket, type Blocker, type BlockerStatus,
} from "./portfolio/data";
import PortfolioOverview from "./portfolio/Overview";

const fmtBudget = (v: number) => "€" + (v / 1000).toFixed(1) + "M";

// Target date <-> the display string projects store ("12 Sep 2026"). Lets the
// edit modal use a native calendar picker while keeping the friendly display.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const toIsoDate = (display: string): string => {
  const d = new Date(display);
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const toDisplayDate = (iso: string): string => {
  if (!iso) return "TBD";
  const [y, m, dd] = iso.split("-").map(Number);
  return y && m && dd ? `${dd} ${MONTHS[m - 1]} ${y}` : "TBD";
};
const BLK_COLORS: Record<BlockerStatus, { dot: string; ink: string; tint: string }> = {
  Active:        { dot: "#D13438", ink: "#A1282B", tint: "#FBE7E8" },
  "In progress": { dot: "#E0A100", ink: "#8A6300", tint: "#FBF2D7" },
  Resolved:      { dot: "#15A34A", ink: "#0B6B37", tint: "#E7F4EC" },
  Cancelled:     { dot: "#8A93A6", ink: "#56607A", tint: "#EEF1F6" },
  Archived:      { dot: "#7A6BB0", ink: "#5E2E89", tint: "#F0E8F7" },
};
const BLK_STATUSES: BlockerStatus[] = ["Active", "In progress", "Resolved", "Cancelled", "Archived"];
// Views group the lifecycle: Open = actionable, then one view per closed state.
const BLK_VIEWS: { key: string; label: string; match: (s: BlockerStatus) => boolean }[] = [
  { key: "open", label: "Open", match: (s) => s === "Active" || s === "In progress" },
  { key: "resolved", label: "Resolved", match: (s) => s === "Resolved" },
  { key: "cancelled", label: "Cancelled", match: (s) => s === "Cancelled" },
  { key: "archived", label: "Archived", match: (s) => s === "Archived" },
  { key: "all", label: "All", match: () => true },
];

interface RaiseBlocker { title: string; projectId: string; owner: string; status: BlockerStatus; description: string; }

export default function Portfolio() {
  const [tab, setTab] = useState<"overview" | "projects" | "blockers">("projects");
  const [filter, setFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [newProject, setNewProject] = useState(false);
  const [bucket, setBucket] = useState<ProjectBucket>("active");
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects(bucket);
  const { data: blockers = [] } = useBlockers();
  const { can } = usePermissions();
  const { role } = useRole();
  const mayCreate = can("cap-projects", "F");
  const mayEdit = can("cap-projects", "E");
  const mayDelete = role === "admin"; // hard delete is Platform Admin only (cosmetic gate; API enforces)
  const mayRequest = !mayEdit && !mayDelete; // roles that can't archive/delete can request it instead

  const refetchProjects = () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["financials"] });
  };

  const raiseBlocker = useMutation({
    mutationFn: (body: RaiseBlocker) => api("/blockers", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blockers"] });
      qc.invalidateQueries({ queryKey: ["projects"] }); // blockerCount changes
    },
  });

  const archive = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      api(`/projects/${id}/${on ? "archive" : "unarchive"}`, { method: "POST" }),
    onSuccess: () => refetchProjects(),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => { refetchProjects(); setConfirmDelete(null); },
  });
  const requestDeletion = useMutation({
    mutationFn: (id: string) => api(`/projects/${id}/deletion-request`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["archive-admin"] }),
  });

  const blkCounts = {
    active: blockers.filter((b) => b.status === "Active").length,
    inProgress: blockers.filter((b) => b.status === "In progress").length,
    resolved: blockers.filter((b) => b.status === "Resolved").length,
  };
  const filtered = projects
    .filter((p) => STATUS_FILTERS.find((f) => f.key === filter)?.match(p) ?? true)
    .filter((p) => deptFilter === "all" || (p.dept || "") === deptFilter);
  const openProject = (id: string) => navigate(`${SCREENS.project.path}?id=${id}`);

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* sub-tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2 }}>
          <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>Overview</TabBtn>
          <TabBtn active={tab === "projects"} onClick={() => setTab("projects")}>Projects</TabBtn>
          <TabBtn active={tab === "blockers"} onClick={() => setTab("blockers")}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              Blockers <span style={{ fontSize: 11, fontWeight: 700, background: "#D13438", color: "#fff", borderRadius: 20, padding: "1px 7px", fontFamily: font.mono }}>{blkCounts.active}</span>
            </span>
          </TabBtn>
        </div>
        <div style={{ flex: 1 }} />
        {tab === "projects" && (
          <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2 }}>
            {(["active", "completed", "archived"] as ProjectBucket[]).map((b) => (
              <TabBtn key={b} active={bucket === b} onClick={() => { setBucket(b); setFilter("all"); }}>
                {b[0].toUpperCase() + b.slice(1)}
              </TabBtn>
            ))}
          </div>
        )}
        {tab === "projects" && (
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} title="Filter by owning department" style={{ width: "auto", minWidth: 150 }}>
            <option value="all">All departments</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        )}
        {tab !== "blockers" && <Button onClick={() => setNewProject(true)} disabled={!mayCreate} title={mayCreate ? undefined : "Your role can't create projects"}><Icon name="plus" size={16} /> New project</Button>}
      </div>

      {tab === "overview" ? (
        <PortfolioOverview />
      ) : tab === "projects" ? (
        <>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
            {STATUS_FILTERS.map((f) => {
              const count = f.key === "all" ? projects.length : projects.filter((p) => f.match(p)).length;
              const active = filter === f.key;
              return (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit",
                  color: f.key === "all" ? "#fff" : f.ink, background: f.tint, boxShadow: active ? "0 0 0 2px #11163A22" : "none",
                }}>{f.label} · {count}</button>
              );
            })}
          </div>
          <Card padding={0} style={{ overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 0.95fr 0.7fr 0.8fr 0.9fr 1fr 0.85fr", padding: "14px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
              <div>Project</div><div>Owner</div><div>Method</div><div>Health</div><div>Target date</div><div>Progress</div><div style={{ textAlign: "right" }}>Budget</div>
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: "56px 22px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>
                {bucket === "archived" ? "No archived projects." : bucket === "completed" ? "No completed projects yet." : projects.length === 0 ? "No projects yet. Create one to populate the portfolio." : "No projects match this filter."}
              </div>
            ) : filtered.map((p) => (
              <div key={p.id} onClick={() => openProject(p.id)} style={{ position: "relative", display: "grid", gridTemplateColumns: "2fr 0.95fr 0.7fr 0.8fr 0.9fr 1fr 0.85fr", alignItems: "center", padding: "15px 22px", borderBottom: "1px solid #F2F4F9", cursor: "pointer", opacity: p.archived ? 0.72 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: statusDot(p.status), flex: "none" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                      {p.archived && (
                        <span style={{ flex: "none", fontSize: 10, fontWeight: 700, color: color.subtle, background: color.surfaceAlt, borderRadius: 5, padding: "1px 6px", letterSpacing: "0.03em", textTransform: "uppercase" }}>Archived</span>
                      )}
                      {!p.archived && p.status === "completed" && (
                        <span style={{ flex: "none", fontSize: 10, fontWeight: 700, color: "#0C5798", background: color.primaryTint2, borderRadius: 5, padding: "1px 6px", letterSpacing: "0.03em", textTransform: "uppercase" }}>Completed</span>
                      )}
                      {p.blockerCount > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flex: "none", color: "#D13438", background: "#FBE7E8", borderRadius: 6, padding: "1px 6px 1px 4px", fontSize: 10.5, fontWeight: 700 }}><Icon name="alert" size={12} />{p.blockerCount}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono }}>{p.id} · {p.dept}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: color.textMuted }}>{p.owner}</div>
                <div><span style={{ fontSize: 11.5, fontWeight: 600, color: color.textMuted, background: color.bg, padding: "3px 9px", borderRadius: 6 }}>{p.methodology}</span></div>
                <div><HealthPill status={p.status} label={p.health} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: color.textMuted }}>{p.target}</div>
                <div style={{ paddingRight: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ProgressBar pct={p.progress} fill={statusDot(p.status)} />
                    <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.textMuted, width: 34, textAlign: "right" }}>{p.progress}%</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", paddingRight: (mayEdit || mayDelete || mayRequest) ? 30 : 0 }}>
                  <div style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: color.text }}>{fmtBudget(p.budget)}</div>
                  <div style={{ fontSize: 11, color: color.faint3 }}>{fmtBudget(p.spent)} spent</div>
                </div>
                {(mayEdit || mayDelete || mayRequest) && (
                  <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }} onClick={(e) => e.stopPropagation()}>
                    <RowActions
                      project={p} mayEdit={mayEdit} mayDelete={mayDelete} mayRequest={mayRequest}
                      onEdit={() => setEditProject(p)}
                      onArchive={(on) => archive.mutate({ id: p.id, on })}
                      onDelete={() => setConfirmDelete(p)}
                      onRequest={() => requestDeletion.mutate(p.id)}
                    />
                  </div>
                )}
              </div>
            ))}
          </Card>
        </>
      ) : (
        <BlockersTab
          blockers={blockers} counts={blkCounts} projects={projects}
          submitting={raiseBlocker.isPending}
          onRaise={(payload) => raiseBlocker.mutate(payload)}
        />
      )}

      {newProject && <CreateProjectModal onClose={() => setNewProject(false)} onCreated={(id) => { setNewProject(false); openProject(id); }} />}
      {editProject && <EditProjectModal project={editProject} onClose={() => setEditProject(null)} onSaved={() => { setEditProject(null); refetchProjects(); }} />}
      {confirmDelete && (
        <ConfirmDeleteModal
          project={confirmDelete} pending={del.isPending} error={del.error as Error | null}
          onCancel={() => setConfirmDelete(null)} onConfirm={() => del.mutate(confirmDelete.id)}
        />
      )}
    </div>
  );
}

// Row-level actions: a kebab that reveals edit / archive / delete. The popover
// is portalled to <body> (see RowMenu) so it's never clipped by the table Card's
// overflow:hidden. Delete is Platform-Admin-only and never for seeded (system)
// projects — both mirrored from the server's authoritative rules.
function RowActions({ project, mayEdit, mayDelete, mayRequest, onEdit, onArchive, onDelete, onRequest }: {
  project: Project;
  mayEdit: boolean; mayDelete: boolean; mayRequest: boolean;
  onEdit: () => void; onArchive: (on: boolean) => void; onDelete: () => void; onRequest: () => void;
}) {
  const canDelete = mayDelete && !project.isSystem;
  return (
    <RowMenu ariaLabel="Project actions" width={182}>
      {(close) => (
        <>
          {mayEdit && <MenuItem label="Edit details" icon={<Icon name="edit" size={15} />} onClick={() => { onEdit(); close(); }} />}
          {mayEdit && (project.archived
            ? <MenuItem label="Restore" icon={<Icon name="refresh" size={15} />} onClick={() => { onArchive(false); close(); }} />
            : <MenuItem label="Archive" icon={<Icon name="archive" size={15} />} onClick={() => { onArchive(true); close(); }} />)}
          {mayRequest && !project.archived && <MenuItem label="Request deletion" icon={<Icon name="trash" size={15} />} onClick={() => { onRequest(); close(); }} />}
          {canDelete && (
            <>
              <MenuDivider />
              <MenuItem label="Delete permanently" icon={<Icon name="trash" size={15} />} danger onClick={() => { onDelete(); close(); }} />
            </>
          )}
          {mayDelete && project.isSystem && (
            <div style={{ padding: "7px 13px", fontSize: 11, color: color.faint3, lineHeight: 1.4 }}>Seeded projects can't be deleted — archive instead.</div>
          )}
        </>
      )}
    </RowMenu>
  );
}

const EDIT_STATUSES: { key: Project["status"]; label: string }[] = [
  { key: "green", label: "On track" }, { key: "amber", label: "At risk" },
  { key: "red", label: "Critical" }, { key: "hold", label: "On hold" },
  { key: "completed", label: "Completed" },
];

function EditProjectModal({ project, onClose, onSaved }: { project: Project; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(project.name);
  const [dept, setDept] = useState(project.dept);
  const [owner, setOwner] = useState(project.owner);
  const [methodology, setMethodology] = useState(project.methodology);
  const [status, setStatus] = useState<Project["status"]>(project.status);
  const [progress, setProgress] = useState(String(project.progress));
  const [startDate, setStartDate] = useState(project.startDate ?? "");
  const [target, setTarget] = useState(project.target);
  const [budget, setBudget] = useState(String(project.budget));
  const [spent, setSpent] = useState(String(project.spent));

  const save = useMutation({
    mutationFn: () => api(`/projects/${project.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: name.trim(), dept: dept.trim(), owner: owner.trim(), methodology, status,
        progress: Math.max(0, Math.min(100, Number(progress) || 0)),
        target: target.trim(), startDate: startDate.trim(), budget: Number(budget) || 0, spent: Number(spent) || 0,
      }),
    }),
    onSuccess: onSaved,
  });

  return (
    <Modal onClose={onClose} width={520} label={`Edit ${project.id}`}>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>Update the project's details. Health follows the status you pick.</div>
      <Field label="Project name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Department"><Input value={dept} onChange={(e) => setDept(e.target.value)} /></Field>
        <Field label="Owner"><Input value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Methodology">
          <Select value={methodology} onChange={(e) => setMethodology(e.target.value)}>
            {METHODOLOGIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as Project["status"])}>
            {EDIT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Progress %"><Input type="number" value={progress} onChange={(e) => setProgress(e.target.value)} /></Field>
        <Field label="Start date"><Input type="date" value={toIsoDate(startDate)} onChange={(e) => setStartDate(toDisplayDate(e.target.value))} /></Field>
        <Field label="Target date"><Input type="date" value={toIsoDate(target)} onChange={(e) => setTarget(toDisplayDate(e.target.value))} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Budget (€k)"><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
        <Field label="Spent (€k)"><Input type="number" value={spent} onChange={(e) => setSpent(e.target.value)} /></Field>
      </div>
      {save.error && <div style={{ fontSize: 12.5, color: "#A1282B", marginTop: 6 }}>{(save.error as Error).message}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => name.trim() && save.mutate()} disabled={save.isPending || !name.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}

function ConfirmDeleteModal({ project, pending, error, onCancel, onConfirm }: {
  project: Project; pending: boolean; error: Error | null; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel} width={440} label="Delete project">
      <div style={{ fontSize: 13.5, color: color.text, lineHeight: 1.5, marginBottom: 6 }}>
        Permanently delete <strong>{project.name}</strong> <span style={{ fontFamily: font.mono, color: color.faint3 }}>({project.id})</span> and all of its tasks, gates, artifacts, costs and other records?
      </div>
      <div style={{ fontSize: 12.5, color: "#A1282B", background: "#FBE7E8", borderRadius: 8, padding: "9px 12px", marginBottom: 14 }}>This can't be undone. To keep the record, archive it instead.</div>
      {error && <div style={{ fontSize: 12.5, color: "#A1282B", marginBottom: 10 }}>{error.message}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <button onClick={onConfirm} disabled={pending} style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", background: "#D13438", border: "none", padding: "10px 16px", borderRadius: 10, cursor: pending ? "not-allowed" : "pointer", opacity: pending ? 0.6 : 1, fontFamily: "inherit" }}>{pending ? "Deleting…" : "Delete permanently"}</button>
      </div>
    </Modal>
  );
}

const METHODOLOGIES = ["Scrum", "Kanban", "Scrumban", "SAFe", "Waterfall", "V-Model", "Stage-Gate", "Spiral", "Iterative", "RAD", "DevOps"];

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [owner, setOwner] = useState("");
  const [methodology, setMethodology] = useState(METHODOLOGIES[0]);
  const [startDate, setStartDate] = useState("");
  const [target, setTarget] = useState("");

  const create = useMutation({
    mutationFn: () => api<{ id: string }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), dept: dept.trim(), owner: owner.trim(), methodology, startDate, target }),
    }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      if (p?.id) onCreated(p.id); else onClose();
    },
  });

  const submit = () => { if (name.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={460} label="New project">
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>Create a project directly in the portfolio. It starts in Planning with an empty schedule.</div>
      <Field label="Project name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Store Network Expansion" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Department"><Input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Owning department" /></Field>
        <Field label="Project manager"><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Project manager / owner" /></Field>
      </div>
      <Field label="Methodology">
        <Select value={methodology} onChange={(e) => setMethodology(e.target.value)}>
          {METHODOLOGIES.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Start date"><Input type="date" value={toIsoDate(startDate)} onChange={(e) => setStartDate(toDisplayDate(e.target.value))} /></Field>
        <Field label="Target date"><Input type="date" value={toIsoDate(target)} onChange={(e) => setTarget(toDisplayDate(e.target.value))} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !name.trim()}>{create.isPending ? "Creating…" : "Create project"}</Button>
      </div>
    </Modal>
  );
}

function BlockersTab({ blockers, counts, projects, onRaise, submitting }: {
  blockers: Blocker[]; counts: { active: number; inProgress: number; resolved: number };
  projects: { id: string; name: string }[]; onRaise: (b: RaiseBlocker) => void; submitting?: boolean;
}) {
  const { can } = usePermissions();
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<BlockerStatus>("Active");
  const [view, setView] = useState("open");
  const [projFilter, setProjFilter] = useState("");
  const [openBlocker, setOpenBlocker] = useState<Blocker | null>(null);

  const submit = () => {
    if (!title.trim() || !projectId) return;
    onRaise({ title: title.trim(), description: description.trim(), projectId, owner: owner.trim(), status });
    setTitle(""); setDescription(""); setOwner("");
  };

  const viewMatch = BLK_VIEWS.find((v) => v.key === view)!.match;
  const shown = blockers.filter((b) => viewMatch(b.status) && (!projFilter || b.projectId === projFilter));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", gap: 9, marginBottom: 14 }}>
          {[["Active", "#D13438", counts.active], ["In progress", "#E0A100", counts.inProgress], ["Resolved", "#15A34A", counts.resolved]].map(([label, c, n]) => (
            <div key={label as string} style={{ flex: 1, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 12, padding: "13px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: c as string }} /><span style={{ fontSize: 12, color: color.faint }}>{label}</span></div>
              <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: color.ink, marginTop: 3 }}>{n as number}</div>
            </div>
          ))}
        </div>

        {/* view + project filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2 }}>
            {BLK_VIEWS.map((v) => (
              <button key={v.key} onClick={() => setView(v.key)} style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", background: view === v.key ? "#fff" : "transparent", color: view === v.key ? color.primary : "#565F73", boxShadow: view === v.key ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>{v.label}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: color.faint3 }}>Project</span>
          <div style={{ minWidth: 190 }}>
            <Select value={projFilter} onChange={(e) => setProjFilter(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        </div>

        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.6fr 2.4fr 1.1fr 0.9fr 0.9fr", padding: "13px 20px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
            <div>ID</div><div>Blocker</div><div>Project</div><div>Owner</div><div>Status</div>
          </div>
          {shown.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>{blockers.length === 0 ? "No blockers logged. Raise one on the right when something impedes progress." : "No blockers match this view."}</div>
          ) : shown.map((b) => {
            const bc = BLK_COLORS[b.status];
            return (
              <div key={b.id} onClick={() => setOpenBlocker(b)} style={{ display: "grid", gridTemplateColumns: "0.6fr 2.4fr 1.1fr 0.9fr 0.9fr", alignItems: "center", padding: "13px 20px", borderBottom: "1px solid #F2F4F9", cursor: "pointer" }}>
                <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint3 }}>{b.id}</div>
                <div style={{ paddingRight: 12, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: color.text }}>{b.title}</div>
                  {b.description && <div style={{ fontSize: 11.5, color: color.faint3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{b.description}</div>}
                </div>
                <div style={{ fontSize: 12, color: color.subtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 8 }}>{b.projectName}</div>
                <div style={{ fontSize: 12.5, color: color.textMuted }}>{b.owner}</div>
                <div><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: bc.ink, background: bc.tint, padding: "3px 10px", borderRadius: 20 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: bc.dot }} />{b.status}</span></div>
              </div>
            );
          })}
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}><span style={{ color: "#D13438", display: "flex" }}><Icon name="alert" size={18} /></span><div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Raise a blocker</div></div>
        <div style={{ fontSize: 12, color: color.faint2, marginBottom: 16 }}>Manually log an impediment against a project.</div>
        <Field label="Project">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{projects.length ? "Select a project" : "No projects available"}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is blocking progress?" style={{ minHeight: 64 }} />
        </Field>
        <Field label="Owner">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Assignee name" />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as BlockerStatus)}>
            {BLK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        {(() => { const may = can("cap-projects", "E"); const off = submitting || !may; return (
        <button onClick={submit} disabled={off} title={may ? undefined : "Your role can't raise blockers"} style={{ width: "100%", fontSize: 13.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: 11, borderRadius: 10, cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.6 : 1, fontFamily: "inherit", marginTop: 4 }}>{submitting ? "Adding…" : "Add blocker"}</button>
        ); })()}
      </Card>

      {openBlocker && <BlockerModal blocker={openBlocker} canEdit={can("cap-projects", "E")} onClose={() => setOpenBlocker(null)} />}
    </div>
  );
}

function BlockerModal({ blocker, canEdit, onClose }: { blocker: Blocker; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(blocker.title);
  const [description, setDescription] = useState(blocker.description);
  const [owner, setOwner] = useState(blocker.owner);
  const [status, setStatus] = useState<BlockerStatus>(blocker.status);
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["blockers"] }); qc.invalidateQueries({ queryKey: ["projects"] }); };

  const save = useMutation({
    mutationFn: () => api(`/blockers/${blocker.id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim(), description: description.trim(), owner: owner.trim(), status }) }),
    onSuccess: () => { invalidate(); onClose(); },
  });
  const del = useMutation({
    mutationFn: () => api(`/blockers/${blocker.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
  });

  return (
    <Modal onClose={onClose} width={480} label={`${blocker.id} · Blocker`}>
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 16 }}>{blocker.projectName}</div>
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} placeholder="Short summary" />
      </Field>
      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} placeholder="What is blocking progress?" style={{ minHeight: 72 }} />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Owner"><Input value={owner} onChange={(e) => setOwner(e.target.value)} disabled={!canEdit} placeholder="Owner" /></Field></div>
        <div style={{ flex: 1 }}><Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value as BlockerStatus)} disabled={!canEdit}>{BLK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 8 }}>
        {canEdit && (confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this blocker?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        ))}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>{canEdit ? "Cancel" : "Close"}</Button>
        {canEdit && <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>}
      </div>
    </Modal>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
      background: active ? "#fff" : "transparent", color: active ? color.primary : "#565F73", boxShadow: active ? "0 1px 3px rgba(20,26,60,0.12)" : "none",
    }}>{children}</button>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
