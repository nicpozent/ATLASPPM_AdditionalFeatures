import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font, radius } from "@/theme";
import { api } from "@/api";
import { Card, EmptyBlock, Button, Input, Textarea, Select, Modal, RowMenu, MenuItem } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { Icon } from "@/components/Icon";
import { toast, toastError } from "@/components/Toast";

// ============================================================================
//  Ops — run-the-business work, a distinct type from project delivery.
//  Operational services hold work items; each item consumes an allocation that
//  rolls up into people's Ops% on Resources, and can be tagged as impacting a
//  project's outcome (ops load pulling capacity off delivery). Data-driven with
//  tasteful empty states; edits gated on the "Operational work" capability.
// ============================================================================

interface OpsItem {
  id: number; serviceId: number; serviceName: string; title: string; description: string;
  type: string; priority: string; status: string; assignee: string; alloc: number;
  impactProjectId: string | null; impactProjectName: string | null; impactNote: string; createdAt: string;
  startDate: string; endDate: string;
}
interface OpsService {
  id: number; ref: string; name: string; category: string; dept: string; owner: string;
  status: string; description: string; items: OpsItem[]; activeCount: number; alloc: number;
  archived: boolean; jiraProjectKey: string;
}
interface OpsSummary { services: number; openItems: number; blocked: number; impactedProjects: number; peopleEngaged: number; }
interface OpsBoard { canEdit: boolean; services: OpsService[]; summary: OpsSummary; }
interface ProjOpt { id: string; name: string; }

const CATEGORIES = ["Support", "Maintenance", "Monitoring", "Infrastructure", "Incident response", "Other"];
const SERVICE_STATUSES = ["Active", "Paused", "Retired"];
const ITEM_TYPES = ["Incident", "Request", "Maintenance", "Monitoring", "Change", "Other"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const ITEM_STATUSES = ["Open", "In progress", "Blocked", "Done"];

const PRIORITY_COLOR: Record<string, string> = { Critical: color.danger, High: color.warningAlt, Medium: color.primary, Low: color.faint2 };
const STATUS_TINT: Record<string, { ink: string; bg: string }> = {
  Open: { ink: color.subtle, bg: color.bg },
  "In progress": { ink: "#0C5798", bg: "#E6EFFB" },
  Blocked: { ink: "#A1282B", bg: "#FBE7E8" },
  Done: { ink: "#0B6B37", bg: "#E7F4EC" },
  Active: { ink: "#0B6B37", bg: "#E7F4EC" },
  Paused: { ink: "#8A6300", bg: "#FBF2D7" },
  Retired: { ink: color.faint2, bg: color.bg },
};

function StatusPill({ value }: { value: string }) {
  const t = STATUS_TINT[value] ?? { ink: color.subtle, bg: color.bg };
  return <span style={{ fontSize: 11, fontWeight: 600, color: t.ink, background: t.bg, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{value}</span>;
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card style={{ flex: 1, minWidth: 130 }}>
      <div style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: accent ?? color.ink }}>{value}</div>
      <div style={{ fontSize: 11.5, color: color.faint2, marginTop: 2 }}>{label}</div>
    </Card>
  );
}

const selectStyle: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: color.textMuted, background: color.surface,
  border: `1px solid ${color.border2}`, borderRadius: radius.md, padding: "7px 10px", fontFamily: "inherit", cursor: "pointer",
};

export default function Ops() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const mayEdit = can("cap-ops", "E");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [newService, setNewService] = useState(false);
  const [editService, setEditService] = useState<OpsService | null>(null);
  const [newItemFor, setNewItemFor] = useState<OpsService | null>(null);
  const [editItem, setEditItem] = useState<OpsItem | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["ops", showArchived], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<OpsBoard> =>
      (await api<OpsBoard>(`/ops?includeArchived=${showArchived}`)) ?? { canEdit: false, services: [], summary: { services: 0, openItems: 0, blocked: 0, impactedProjects: 0, peopleEngaged: 0 } },
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<ProjOpt[]> => { try { return (await api<ProjOpt[]>("/projects")) ?? []; } catch { return []; } },
  });

  const services = data?.services ?? [];
  const summary = data?.summary;
  const filtered = services.filter((s) =>
    (category === "all" || s.category === category) && (status === "all" || s.status === status));

  const delService = useMutation({
    mutationFn: (id: number) => api(`/ops/services/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ops"] }); toast("Service removed"); },
    onError: (e) => toastError(e),
  });
  const archiveService = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) => api(`/ops/services/${id}/archive?on=${on}`, { method: "POST" }),
    onSuccess: (_r, v) => { qc.invalidateQueries({ queryKey: ["ops"] }); toast(v.on ? "Service archived" : "Service restored"); },
    onError: (e) => toastError(e),
  });

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <StatTile label="Services" value={summary?.services ?? 0} />
        <StatTile label="Open items" value={summary?.openItems ?? 0} accent={color.primary} />
        <StatTile label="Blocked" value={summary?.blocked ?? 0} accent={(summary?.blocked ?? 0) > 0 ? color.danger : undefined} />
        <StatTile label="Impacted projects" value={summary?.impactedProjects ?? 0} accent={(summary?.impactedProjects ?? 0) > 0 ? color.warningAlt : undefined} />
        <StatTile label="People engaged" value={summary?.peopleEngaged ?? 0} />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
          <option value="all">All statuses</option>
          {SERVICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.textMuted, cursor: "pointer" }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={() => setImportOpen(true)} disabled={!mayEdit} title={mayEdit ? "Import a Jira project as an ops service" : "Your role can't edit operational work"}>
          <Icon name="sync" size={15} /> Import from Jira
        </Button>
        <Button onClick={() => setNewService(true)} disabled={!mayEdit} title={mayEdit ? undefined : "Your role can't edit operational work"}>
          <Icon name="plus" size={16} /> New service
        </Button>
      </div>

      {services.length === 0 ? (
        <Card><EmptyBlock message="No operational services yet. Add a service (support, maintenance, monitoring, infrastructure…) to track run-the-business work and its impact on projects." minHeight={140} /></Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyBlock message="No services match these filters." minHeight={120} /></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filtered.map((s) => (
            <ServiceCard
              key={s.id} service={s} mayEdit={mayEdit}
              onAddItem={() => setNewItemFor(s)} onEditService={() => setEditService(s)}
              onDeleteService={() => delService.mutate(s.id)} onEditItem={setEditItem}
              onArchive={() => archiveService.mutate({ id: s.id, on: !s.archived })}
            />
          ))}
        </div>
      )}

      {newService && <ServiceModal onClose={() => setNewService(false)} />}
      {editService && <ServiceModal service={editService} onClose={() => setEditService(null)} />}
      {newItemFor && <ItemModal service={newItemFor} projects={projects} onClose={() => setNewItemFor(null)} />}
      {editItem && <ItemModal item={editItem} projects={projects} onClose={() => setEditItem(null)} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function ServiceCard({ service, mayEdit, onAddItem, onEditService, onDeleteService, onEditItem, onArchive }: {
  service: OpsService; mayEdit: boolean; onAddItem: () => void; onEditService: () => void; onDeleteService: () => void; onEditItem: (i: OpsItem) => void; onArchive: () => void;
}) {
  return (
    <Card padding={0} style={{ overflow: "visible" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${color.bg}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: font.mono, fontSize: 11, color: color.faint3 }}>{service.ref}</span>
            <span style={{ fontFamily: font.head, fontSize: 15, fontWeight: 700, color: color.ink }}>{service.name}</span>
            <StatusPill value={service.status} />
            <span style={{ fontSize: 11, fontWeight: 600, color: color.textMuted, background: color.bg, borderRadius: 6, padding: "2px 8px" }}>{service.category}</span>
            {service.jiraProjectKey && <span style={{ fontSize: 10.5, fontWeight: 600, color: color.primaryDark, background: color.primaryTint, borderRadius: 6, padding: "2px 8px" }} title="Imported from Jira">Jira · {service.jiraProjectKey}</span>}
            {service.archived && <span style={{ fontSize: 10.5, fontWeight: 700, color: color.faint2, background: color.bg, borderRadius: 6, padding: "2px 8px" }}>ARCHIVED</span>}
          </div>
          <div style={{ fontSize: 12, color: color.faint2, marginTop: 4 }}>
            {service.dept}{service.owner ? ` · ${service.owner}` : ""} · {service.activeCount} active item{service.activeCount === 1 ? "" : "s"} · {service.alloc}% allocated
          </div>
          {service.description && <div style={{ fontSize: 12.5, color: color.subtle, marginTop: 6 }}>{service.description}</div>}
        </div>
        <Button variant="secondary" onClick={onAddItem} disabled={!mayEdit} title={mayEdit ? undefined : "Your role can't edit operational work"}>
          <Icon name="plus" size={15} /> Item
        </Button>
        {mayEdit && (
          <RowMenu>
            {(close) => (
              <>
                <MenuItem label="Edit service" icon="edit" onClick={() => { close(); onEditService(); }} />
                <MenuItem label={service.archived ? "Restore service" : "Archive service"} icon="archive" onClick={() => { close(); onArchive(); }} />
                <MenuItem label="Delete service" icon="trash" danger onClick={() => { close(); onDeleteService(); }} />
              </>
            )}
          </RowMenu>
        )}
      </div>

      {service.items.length === 0 ? (
        <div style={{ padding: "14px 20px", fontSize: 12.5, color: color.faint3 }}>No work items yet.</div>
      ) : (
        <div>
          {service.items.map((i) => (
            <button key={i.id} onClick={() => mayEdit && onEditItem(i)}
              style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", background: "none", border: "none", borderBottom: "1px solid #F4F6FA", cursor: mayEdit ? "pointer" : "default", fontFamily: "inherit" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: PRIORITY_COLOR[i.priority] ?? color.faint2 }} title={i.priority} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</div>
                <div style={{ fontSize: 11, color: color.faint2, marginTop: 1 }}>
                  {i.type} · {i.assignee}{i.alloc > 0 ? ` · ${i.alloc}%` : ""}
                  {(i.startDate || i.endDate) ? ` · ${i.startDate || "?"}→${i.endDate || "?"}` : ""}
                  {i.impactProjectName && <span style={{ color: color.warningAlt, fontWeight: 600 }}> · impacts {i.impactProjectName}</span>}
                </div>
              </div>
              <StatusPill value={i.status} />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function ServiceModal({ service, onClose }: { service?: OpsService; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = !!service;
  const [name, setName] = useState(service?.name ?? "");
  const [category, setCategory] = useState(service?.category ?? "Support");
  const [dept, setDept] = useState(service?.dept ?? "");
  const [owner, setOwner] = useState(service?.owner ?? "");
  const [status, setStatus] = useState(service?.status ?? "Active");
  const [description, setDescription] = useState(service?.description ?? "");

  const save = useMutation({
    mutationFn: () => editing
      ? api(`/ops/services/${service!.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim(), category, dept: dept.trim(), owner: owner.trim(), status, description: description.trim() }) })
      : api(`/ops/services`, { method: "POST", body: JSON.stringify({ name: name.trim(), category, dept: dept.trim(), owner: owner.trim(), description: description.trim() }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ops"] }); toast(editing ? "Service saved" : "Service created"); onClose(); },
    onError: (e) => toastError(e),
  });

  return (
    <Modal onClose={onClose} width={520} label={editing ? "Edit service" : "New operational service"}>
      <DecLabel>Service name</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Payments platform support" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Category</DecLabel><Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
        {editing && <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{SERVICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>}
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Department</DecLabel><Input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Owning department" /></div>
        <div style={{ flex: 1 }}><DecLabel>Owner</DecLabel><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Service owner" /></div>
      </div>
      <DecLabel>Description</DecLabel>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this service covers…" style={{ minHeight: 70 }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (name.trim()) save.mutate(); }} disabled={save.isPending || !name.trim()}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Create service"}</Button>
      </div>
    </Modal>
  );
}

function ItemModal({ item, service, projects, onClose }: { item?: OpsItem; service?: OpsService; projects: ProjOpt[]; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = !!item;
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [type, setType] = useState(item?.type ?? "Maintenance");
  const [priority, setPriority] = useState(item?.priority ?? "Medium");
  const [status, setStatus] = useState(item?.status ?? "Open");
  const [assignee, setAssignee] = useState(item?.assignee === "Unassigned" ? "" : item?.assignee ?? "");
  const [alloc, setAlloc] = useState(String(item?.alloc || ""));
  const [impact, setImpact] = useState(item?.impactProjectId ?? "");
  const [impactNote, setImpactNote] = useState(item?.impactNote ?? "");
  const [startDate, setStartDate] = useState(item?.startDate ?? "");
  const [endDate, setEndDate] = useState(item?.endDate ?? "");
  const [confirmDel, setConfirmDel] = useState(false);

  const body = () => JSON.stringify({
    title: title.trim(), description: description.trim(), type, priority, status,
    assignee: assignee.trim(), alloc: Number(alloc) || 0, impactProjectId: impact, impactNote: impactNote.trim(),
    startDate, endDate,
  });
  const save = useMutation({
    mutationFn: () => editing
      ? api(`/ops/items/${item!.id}`, { method: "PATCH", body: body() })
      : api(`/ops/services/${service!.id}/items`, { method: "POST", body: body() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ops"] }); qc.invalidateQueries({ queryKey: ["resources"] }); toast(editing ? "Item saved" : "Item added"); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/ops/items/${item!.id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ops"] }); qc.invalidateQueries({ queryKey: ["resources"] }); toast("Item removed"); onClose(); },
    onError: (e) => toastError(e),
  });

  return (
    <Modal onClose={onClose} width={560} label={editing ? "Edit work item" : `New item · ${service?.name ?? ""}`}>
      <DecLabel>Title</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the work?" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Type</DecLabel><Select value={type} onChange={(e) => setType(e.target.value)}>{ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Priority</DecLabel><Select value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{ITEM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 2 }}><DecLabel>Assignee</DecLabel><Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Who's doing it" /></div>
        <div style={{ flex: 1 }}><DecLabel>Allocation %</DecLabel><Input type="number" min={0} max={100} value={alloc} onChange={(e) => setAlloc(e.target.value)} placeholder="0" /></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Active from</DecLabel><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div style={{ flex: 1 }}><DecLabel>Active until</DecLabel><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <div style={{ flex: 2, display: "flex", alignItems: "flex-end" }}><div style={{ fontSize: 11, color: color.faint3, paddingBottom: 8 }}>Leave blank for open-ended. The allocation only counts against capacity while active.</div></div>
      </div>
      <DecLabel>Description</DecLabel>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details…" style={{ minHeight: 60, marginBottom: 14 }} />

      <div style={{ background: color.surfaceAlt, border: `1px solid ${color.border2}`, borderRadius: radius.md, padding: "12px 14px" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: color.warningAlt, marginBottom: 8, letterSpacing: "0.03em" }}>PROJECT IMPACT</div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <DecLabel>Impacts project</DecLabel>
            <Select value={impact} onChange={(e) => setImpact(e.target.value)}>
              <option value="">None</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div style={{ flex: 1 }}><DecLabel>How it affects it</DecLabel><Input value={impactNote} onChange={(e) => setImpactNote(e.target.value)} placeholder="e.g. pulls 2 devs off delivery" disabled={!impact} /></div>
        </div>
        <div style={{ fontSize: 11, color: color.faint2, marginTop: 8 }}>Tagging a project surfaces this ops load on that project's Overview as capacity pulled off delivery.</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {editing && (
          confirmDel ? (
            <>
              <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this item?</span>
              <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
              <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
          )
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Add item"}</Button>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const imp = useMutation({
    mutationFn: () => api<{ ok: boolean; items?: number; serviceRef?: string; error?: string }>(
      `/integrations/jira/import`, { method: "POST", body: JSON.stringify({ jiraProjectKey: key.trim(), target: "ops", name: name.trim() }) }),
    onSuccess: (r) => {
      if (r && r.ok === false) { toast(r.error || "Import failed"); return; }
      qc.invalidateQueries({ queryKey: ["ops"] });
      toast(`Imported ${r?.items ?? 0} items into ${r?.serviceRef ?? "the service"}`);
      onClose();
    },
    onError: (e) => toastError(e),
  });
  return (
    <Modal onClose={onClose} width={480} label="Import a Jira project as an Ops service">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 16 }}>Pull a Jira project's issues in as operational work items. Re-importing the same key tops up new issues (idempotent). Allocation stays at 0 until you set it.</div>
      <DecLabel>Jira project key</DecLabel>
      <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. OPS or SUPPORT" style={{ marginBottom: 14 }} />
      <DecLabel>Service name (optional)</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Defaults to the Jira key" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (key.trim()) imp.mutate(); }} disabled={imp.isPending || !key.trim()}>{imp.isPending ? "Importing…" : "Import"}</Button>
      </div>
    </Modal>
  );
}

function DecLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: color.faint2, marginBottom: 5, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>{children}</div>;
}
