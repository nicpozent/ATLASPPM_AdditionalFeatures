import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font, chart } from "@/theme";
import { Icon } from "@/components/Icon";
import { api } from "@/api";
import { Button, Input, Textarea, Select, Field, Modal, Card, EmptyBlock, RowMenu, MenuItem, ProgressBar } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { toast, toastError } from "@/components/Toast";
import {
  type IncrementSummary, type Iteration, type Objective, type Dependency, type LinkTarget, type IncrementDetail,
  STATES, OBJ_STATUSES, DEP_STATUSES, LINK_TYPES, STATE_PILL, OBJ_PILL, DEP_COL,
  parseTs, toDisplay, confColor, isOverAllocated, iterationTotals, objectiveRollup, timelineSpan, barPos, monthTicks,
} from "./pip/data";

// ============================================================================
//  Program Increment Planning (PIP) — quarterly PI planning across the whole
//  portfolio. An increment holds PI objectives (business value + team
//  confidence vote), iterations (calendar + capacity vs load), and cross-team
//  dependencies. Everything is data-driven; with no increments the screen shows
//  a tasteful empty state and a "New increment" affordance (when permitted).
//  Pure types, constants and derivations live in ./pip/data (unit-tested).
// ============================================================================

function Pill({ label, ink, tint }: { label: string; ink: string; tint: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color: ink, background: tint, padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{label}</span>;
}

// Fist-of-five team confidence vote (1–5). Read-only unless onVote is given.
function Confidence({ value, onVote }: { value: number; onVote?: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }} aria-label={`Confidence ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const dot = <span style={{ width: 12, height: 12, borderRadius: "50%", background: on ? confColor(value) : chart.track, display: "block" }} />;
        return onVote ? (
          <button key={n} onClick={() => onVote(n === value ? 0 : n)} title={`Vote ${n}`} aria-label={`Vote ${n}`}
            style={{ border: "none", background: "transparent", padding: 1, cursor: "pointer", lineHeight: 0 }}>{dot}</button>
        ) : <span key={n} style={{ lineHeight: 0 }}>{dot}</span>;
      })}
    </div>
  );
}

export default function Pip() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canEdit = can("cap-schedule", "E");
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<"objectives" | "calendar" | "capacity" | "dependencies">("objectives");
  const [showNew, setShowNew] = useState(false);
  const [quickCreate, setQuickCreate] = useState<null | "project" | "program">(null);
  const canCreatePortfolio = can("cap-projects", "F");

  const list = useQuery({
    queryKey: ["increments"], retry: false, staleTime: 0, refetchOnMount: "always",
    queryFn: async () => { try { return (await api<{ canEdit: boolean; increments: IncrementSummary[] }>("/increments")) ?? { canEdit: false, increments: [] }; } catch { return { canEdit: false, increments: [] }; } },
  });
  const increments = list.data?.increments ?? [];
  const activeId = selected ?? increments[0]?.id ?? null;

  const detail = useQuery({
    queryKey: ["increment", activeId], enabled: activeId != null, retry: false, staleTime: 0, refetchOnMount: "always",
    queryFn: async () => { try { return await api<IncrementDetail>(`/increments/${activeId}`); } catch { return null; } },
  });
  const inc = detail.data ?? null;

  const createInc = useMutation({
    mutationFn: (body: { key: string; name: string; startDate: string; endDate: string; state: string }) =>
      api<IncrementSummary>("/increments", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (row) => { setShowNew(false); if (row) setSelected(row.id); qc.invalidateQueries({ queryKey: ["increments"] }); },
    onError: toastError,
  });

  if (list.isLoading) {
    return <div style={{ maxWidth: 1180, margin: "0 auto" }}><Card><EmptyBlock message="Loading increments…" /></Card></div>;
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220, fontSize: 13.5, color: color.subtle }}>
          Quarterly Program Increment planning across projects, programs, products &amp; releases — objectives with business value &amp; confidence, an iteration calendar, capacity vs load, and a cross-team dependency board.
        </div>
        {increments.length > 0 && (
          <Select value={String(activeId ?? "")} onChange={(e) => setSelected(Number(e.target.value))} style={{ width: 260 }}>
            {increments.map((i) => <option key={i.id} value={i.id}>{i.key ? `${i.key} · ` : ""}{i.name}</option>)}
          </Select>
        )}
        {canCreatePortfolio && (
          <>
            <Button variant="secondary" onClick={() => setQuickCreate("project")} style={{ padding: "9px 14px" }}><Icon name="plus" size={15} /> Project</Button>
            <Button variant="secondary" onClick={() => setQuickCreate("program")} style={{ padding: "9px 14px" }}><Icon name="plus" size={15} /> Program</Button>
          </>
        )}
        {canEdit && (
          <Button onClick={() => setShowNew(true)} style={{ padding: "9px 14px" }}><Icon name="plus" size={16} /> New increment</Button>
        )}
      </div>

      {increments.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "56px 24px" }}>
          <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 6 }}>No program increments yet</div>
          <div style={{ fontSize: 13.5, color: color.subtle, maxWidth: 460, margin: "0 auto 18px" }}>
            Create a quarterly increment to plan PI objectives, iterations, capacity and cross-team dependencies across the portfolio.
          </div>
          {canEdit && <Button onClick={() => setShowNew(true)} style={{ margin: "0 auto" }}><Icon name="plus" size={16} /> New increment</Button>}
        </Card>
      ) : inc == null ? (
        <Card><EmptyBlock message={detail.isLoading ? "Loading increment…" : "Couldn't load this increment."} /></Card>
      ) : (
        <>
          <IncrementHeader inc={inc} canEdit={inc.canEdit} />
          <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2, margin: "16px 0" }}>
            {([
              ["objectives", "PI Objectives", inc.objectiveList.length],
              ["calendar", "Calendar", inc.iterationList.length],
              ["capacity", "Capacity & Load", inc.iterationList.length],
              ["dependencies", "Dependencies", inc.dependencyList.length],
            ] as const).map(([key, label, n]) => (
              <button key={key} onClick={() => setTab(key)} style={{ padding: "7px 15px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: tab === key ? "#fff" : "transparent", color: tab === key ? color.primary : "#6A7488", boxShadow: tab === key ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>
                {label}{n ? ` · ${n}` : ""}
              </button>
            ))}
          </div>

          {tab === "objectives" && <ObjectivesView inc={inc} />}
          {tab === "calendar" && <CalendarView inc={inc} />}
          {tab === "capacity" && <CapacityView inc={inc} />}
          {tab === "dependencies" && <DependenciesView inc={inc} />}
        </>
      )}

      {showNew && <IncrementModal onClose={() => setShowNew(false)} onSave={(b) => createInc.mutate(b)} busy={createInc.isPending} />}
      {quickCreate && (
        <QuickCreateModal kind={quickCreate} onClose={() => setQuickCreate(null)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ["increment", activeId] }); }} />
      )}
    </div>
  );
}

// Quick-create a project or program without leaving PI Planning. The new entity
// becomes available as a linkable deliverable on this increment's objectives and
// dependencies (its `targets` list refreshes). Gated on Projects & tasks (Full).
function QuickCreateModal({ kind, onClose, onCreated }: { kind: "project" | "program"; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [extra, setExtra] = useState("");   // methodology (project) or goal (program)
  const create = useMutation({
    mutationFn: () => kind === "project"
      ? api("/projects", { method: "POST", body: JSON.stringify({ name: name.trim(), owner: owner.trim() || undefined, methodology: extra.trim() || "Scrum" }) })
      : api("/programs", { method: "POST", body: JSON.stringify({ name: name.trim(), owner: owner.trim() || "Unassigned", goal: extra.trim() }) }),
    onSuccess: () => { toast(`${kind === "project" ? "Project" : "Program"} created`); onCreated(); onClose(); },
    onError: toastError,
  });
  return (
    <Modal onClose={onClose} width={460} label={`New ${kind}`}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 6 }}>New {kind}</div>
      <div style={{ fontSize: 12.5, color: color.subtle, marginBottom: 16 }}>Created from PI Planning — you can then link it as a deliverable on this increment's objectives and dependencies.</div>
      <div style={{ display: "grid", gap: 12 }}>
        <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "project" ? "Unified checkout" : "Nordic payments programme"} />}</Field>
        <Field label="Owner">{(id) => <Input id={id} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Accountable person" />}</Field>
        {kind === "project"
          ? <Field label="Methodology">{(id) => <Select id={id} value={extra || "Scrum"} onChange={(e) => setExtra(e.target.value)}>{["Scrum", "Kanban", "Waterfall", "SAFe", "Scrumban", "V-Model", "Stage-Gate"].map((m) => <option key={m} value={m}>{m}</option>)}</Select>}</Field>
          : <Field label="Goal">{(id) => <Textarea id={id} value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder="What this programme delivers" />}</Field>}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (name.trim()) create.mutate(); }} disabled={create.isPending || !name.trim()}>{create.isPending ? "Creating…" : "Create"}</Button>
      </div>
    </Modal>
  );
}

// --- Increment header (span + state + edit/delete) --------------------------
function IncrementHeader({ inc, canEdit }: { inc: IncrementDetail; canEdit: boolean }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const s = STATE_PILL[inc.state] ?? STATE_PILL.Planning;
  const patch = useMutation({
    mutationFn: (body: Partial<IncrementDetail>) => api(`/increments/${inc.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { setEdit(false); qc.invalidateQueries({ queryKey: ["increment", inc.id] }); qc.invalidateQueries({ queryKey: ["increments"] }); },
    onError: toastError,
  });
  const del = useMutation({
    mutationFn: () => api(`/increments/${inc.id}`, { method: "DELETE" }),
    onSuccess: () => { toast("Increment deleted", "info"); qc.invalidateQueries({ queryKey: ["increments"] }); qc.invalidateQueries({ queryKey: ["increment", inc.id] }); },
    onError: toastError,
  });
  return (
    <Card padding={18}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: color.ink }}>{inc.name}</span>
            {inc.key && <span style={{ fontFamily: font.mono, fontSize: 12, color: color.faint2 }}>{inc.key}</span>}
            <Pill label={inc.state} ink={s.ink} tint={s.tint} />
          </div>
          <div style={{ fontSize: 12.5, color: color.subtle, marginTop: 4 }}>{toDisplay(inc.startDate)} → {toDisplay(inc.endDate)}</div>
        </div>
        {canEdit && (
          <RowMenu ariaLabel="Increment actions">
            {(close) => (<>
              <MenuItem label="Edit increment" icon={<Icon name="edit" size={15} />} onClick={() => { setEdit(true); close(); }} />
              <MenuItem label="Delete increment" icon={<Icon name="trash" size={15} />} danger onClick={() => { if (confirm(`Delete "${inc.name}" and all its objectives, iterations and dependencies?`)) del.mutate(); close(); }} />
            </>)}
          </RowMenu>
        )}
      </div>
      {edit && <IncrementModal initial={inc} onClose={() => setEdit(false)} onSave={(b) => patch.mutate(b)} busy={patch.isPending} />}
    </Card>
  );
}

// --- PI Objectives ----------------------------------------------------------
function ObjectivesView({ inc }: { inc: IncrementDetail }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | { obj?: Objective }>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["increment", inc.id] });
  const vote = useMutation({
    mutationFn: ({ id, confidence }: { id: number; confidence: number }) => api(`/pi-objectives/${id}`, { method: "PATCH", body: JSON.stringify({ confidence }) }),
    onSuccess: invalidate, onError: toastError,
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/pi-objectives/${id}`, { method: "DELETE" }),
    onSuccess: invalidate, onError: toastError,
  });

  const { committed, stretch, meanConf, plannedBV, doneBV } = objectiveRollup(inc.objectiveList);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 6 }}>
        <Stat label="Committed objectives" value={String(committed.length)} />
        <Stat label="Stretch objectives" value={String(stretch.length)} />
        <Stat label="Planned business value" value={String(plannedBV)} sub={committed.length ? `${doneBV} delivered` : undefined} />
        <Stat label="Mean confidence" value={meanConf ? meanConf.toFixed(1) : "—"} sub="of 5" valueColor={confColor(Math.round(meanConf))} />
      </div>
      {inc.canEdit && <div style={{ marginTop: 12 }}><Button variant="secondary" onClick={() => setModal({})}><Icon name="plus" size={15} /> Add objective</Button></div>}
      <ObjectiveSection title="Committed" items={committed} inc={inc} onEdit={(o) => setModal({ obj: o })} onVote={(id, confidence) => vote.mutate({ id, confidence })} onDelete={(id) => del.mutate(id)} />
      <ObjectiveSection title="Stretch" items={stretch} inc={inc} onEdit={(o) => setModal({ obj: o })} onVote={(id, confidence) => vote.mutate({ id, confidence })} onDelete={(id) => del.mutate(id)} />
      {modal && <ObjectiveModal inc={inc} obj={modal.obj} onClose={() => setModal(null)} />}
    </div>
  );
}

function ObjectiveSection({ title, items, inc, onEdit, onVote, onDelete }: {
  title: string; items: Objective[]; inc: IncrementDetail;
  onEdit: (o: Objective) => void; onVote: (id: number, confidence: number) => void; onDelete: (id: number) => void;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: color.textMuted, marginBottom: 8 }}>{title} · {items.length}</div>
      {items.length === 0 ? <Card><EmptyBlock message={`No ${title.toLowerCase()} objectives.`} minHeight={64} /></Card> : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((o) => {
            const p = OBJ_PILL[o.status] ?? OBJ_PILL.Planned;
            return (
              <Card key={o.id} padding={16}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>{o.title}</span>
                      <Pill label={o.status} ink={p.ink} tint={p.tint} />
                      {o.entityName && o.entityType && <Pill label={`${o.entityType}: ${o.entityName}`} ink={color.primary} tint={color.primaryTint} />}
                      {o.okrTitle && <Pill label={`OKR: ${o.okrTitle}`} ink={color.accent} tint={color.accentTint} />}
                    </div>
                    {o.description && <div style={{ fontSize: 12.5, color: color.subtle, marginTop: 5 }}>{o.description}</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 11.5, color: color.faint2 }}>Business value</span>
                        <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: color.ink }}>{o.businessValue}</span>
                        {o.status === "Done" && o.actualValue > 0 && <span style={{ fontSize: 11.5, color: color.faint2 }}>→ actual <b style={{ color: o.actualValue >= o.businessValue ? chart.onTrack : chart.atRisk }}>{o.actualValue}</b></span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 11.5, color: color.faint2 }}>Confidence</span>
                        <Confidence value={o.confidence} onVote={inc.canEdit ? (v) => onVote(o.id, v) : undefined} />
                      </div>
                    </div>
                  </div>
                  {inc.canEdit && (
                    <RowMenu ariaLabel="Objective actions">
                      {(close) => (<>
                        <MenuItem label="Edit" icon={<Icon name="edit" size={15} />} onClick={() => { onEdit(o); close(); }} />
                        <MenuItem label="Delete" icon={<Icon name="trash" size={15} />} danger onClick={() => { onDelete(o.id); close(); }} />
                      </>)}
                    </RowMenu>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <Card padding={14}>
      <div style={{ fontSize: 11.5, color: color.faint2, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: font.head, fontSize: 22, fontWeight: 600, color: valueColor ?? color.ink }}>{value}{sub && <span style={{ fontSize: 12, fontWeight: 500, color: color.faint2, marginLeft: 5 }}>{sub}</span>}</div>
    </Card>
  );
}

// --- Calendar (iteration timeline) ------------------------------------------
function CalendarView({ inc }: { inc: IncrementDetail }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | { it?: Iteration }>(null);
  const del = useMutation({
    mutationFn: (id: number) => api(`/pi-iterations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["increment", inc.id] }), onError: toastError,
  });

  const its = inc.iterationList;
  // Span: increment dates, widened to cover any iteration outside it.
  const { min, max, total } = timelineSpan(inc, its);
  const ticks = monthTicks(min, max, total);

  return (
    <div>
      {inc.canEdit && <div style={{ marginBottom: 12 }}><Button variant="secondary" onClick={() => setModal({})}><Icon name="plus" size={15} /> Add iteration</Button></div>}
      {its.length === 0 ? <Card><EmptyBlock message="No iterations yet. Add iterations to plan the increment calendar." /></Card> : (
        <Card padding={18}>
          {/* Month grid */}
          <div style={{ position: "relative", height: 20, marginBottom: 6, marginLeft: 150 }}>
            {ticks.map((t, i) => (
              <div key={i} style={{ position: "absolute", left: `${t.pct}%`, fontSize: 10.5, color: color.faint2, transform: "translateX(-2px)" }}>{t.label}</div>
            ))}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {its.map((it) => {
              const p = barPos(min, total, parseTs(it.startDate), parseTs(it.endDate));
              const over = isOverAllocated(it);
              return (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 140, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                    {inc.canEdit && (
                      <RowMenu ariaLabel="Iteration actions" width={150}>
                        {(close) => (<>
                          <MenuItem label="Edit" icon={<Icon name="edit" size={15} />} onClick={() => { setModal({ it }); close(); }} />
                          <MenuItem label="Delete" icon={<Icon name="trash" size={15} />} danger onClick={() => { del.mutate(it.id); close(); }} />
                        </>)}
                      </RowMenu>
                    )}
                  </div>
                  <div style={{ position: "relative", flex: 1, height: 26, background: chart.grid, borderRadius: 6 }}>
                    {p && (
                      <div title={`${toDisplay(it.startDate)} → ${toDisplay(it.endDate)}`} style={{ position: "absolute", top: 3, height: 20, left: `${p.left}%`, width: `${p.width}%`, minWidth: 24, background: over ? color.danger : color.primary, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10.5, fontWeight: 700, overflow: "hidden" }}>
                        {it.capacity > 0 ? `${it.load}/${it.capacity}` : ""}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {modal && <IterationModal inc={inc} it={modal.it} onClose={() => setModal(null)} />}
    </div>
  );
}

// Team availability across the whole PI window — reads the time-phased
// allocation model (free = 100% − peak load over the window; absences net out).
interface PiAvailSlice { type: string; entityName: string; pct: number }
interface PiAvailRow { name: string; title: string; allocated: number; free: number; onLeave: boolean; leaveNote: string; slices: PiAvailSlice[] }
function PiAvailability({ from, to }: { from: string; to: string }) {
  const { data } = useQuery({
    queryKey: ["availability", "pi", from, to], enabled: !!from && !!to, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ people: PiAvailRow[] }> =>
      (await api<{ people: PiAvailRow[] }>(`/resources/availability?from=${from}&to=${to}`)) ?? { people: [] },
  });
  const people = data?.people ?? [];
  if (!from || !to) return null;
  const freeColor = (f: number) => (f >= 50 ? "#0B6B37" : f > 0 ? color.warningAlt : color.faint2);
  return (
    <Card padding={0} style={{ overflow: "hidden", marginTop: 14 }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${color.bg}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: font.head, fontSize: 14, fontWeight: 700, color: color.ink }}>Team availability across this PI</div>
        <span style={{ fontSize: 11.5, color: color.faint2 }}>{from} → {to} · free = capacity free across the whole window; booked time-off shown</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#0B6B37" }}>{people.filter((p) => p.free >= 50 && !p.onLeave).length} with ≥50% free</span>
      </div>
      {people.length === 0 ? (
        <EmptyBlock message="No people to assess — attach a team to the increment's projects/programs, or check the PI dates." minHeight={80} />
      ) : (
        <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {people.map((p) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 18px", borderBottom: "1px solid #F4F6FA" }}>
              <div style={{ width: 190, flex: "none", minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: color.faint3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <div style={{ height: 10, borderRadius: 4, background: "#EEF1F6", overflow: "hidden" }} title={p.slices.map((s) => `${s.entityName} ${s.pct}%`).join(" · ") || "unallocated"}>
                  <div style={{ width: `${Math.min(100, p.allocated)}%`, height: "100%", background: p.allocated > 100 ? color.danger : color.primary }} />
                </div>
              </div>
              <div style={{ width: 92, flex: "none", textAlign: "right" }}>
                {p.onLeave
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: "#A1282B" }}>On leave</span>
                  : <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: freeColor(p.free) }}>{p.free}% free</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// --- Capacity & Load --------------------------------------------------------
function CapacityView({ inc }: { inc: IncrementDetail }) {
  const its = inc.iterationList;
  const totals = iterationTotals(its);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Stat label="Total capacity" value={String(totals.capacity)} />
        <Stat label="Total planned load" value={String(totals.load)} valueColor={totals.over ? color.danger : undefined} />
        <Stat label="Headroom" value={String(totals.headroom)} sub={totals.capacity > 0 ? `${totals.loadedPct}% loaded` : undefined} valueColor={totals.headroom < 0 ? color.danger : chart.onTrack} />
      </div>
      {its.length === 0 ? <Card><EmptyBlock message="No iterations to load. Add iterations on the Calendar tab, then set capacity vs load here." /></Card> : (
        <Card padding={18}>
          <div style={{ display: "grid", gap: 14 }}>
            {its.map((it) => {
              const pct = it.capacity > 0 ? (it.load / it.capacity) * 100 : 0;
              const over = isOverAllocated(it);
              return (
                <div key={it.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{it.name}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 12, color: over ? color.danger : color.faint2 }}>
                      {it.load} / {it.capacity}{over && " · over-allocated"}
                    </span>
                  </div>
                  <ProgressBar pct={pct} fill={over ? color.danger : pct > 85 ? chart.atRisk : color.primary} height={10} />
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <PiAvailability from={(inc.startDate || "").slice(0, 10)} to={(inc.endDate || "").slice(0, 10)} />
    </div>
  );
}

// --- Dependencies board -----------------------------------------------------
function DependenciesView({ inc }: { inc: IncrementDetail }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | { dep?: Dependency }>(null);
  const del = useMutation({
    mutationFn: (id: number) => api(`/pi-dependencies/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["increment", inc.id] }), onError: toastError,
  });
  return (
    <div>
      {inc.canEdit && <div style={{ marginBottom: 12 }}><Button variant="secondary" onClick={() => setModal({})}><Icon name="plus" size={15} /> Add dependency</Button></div>}
      {inc.dependencyList.length === 0 ? <Card><EmptyBlock message="No cross-team dependencies logged for this increment." /></Card> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
          {DEP_STATUSES.map((st) => {
            const col = DEP_COL[st];
            const items = inc.dependencyList.filter((d) => d.status === st);
            return (
              <div key={st}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.bar }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: color.textMuted }}>{st}</span>
                  <span style={{ fontSize: 11.5, color: color.faint3 }}>{items.length}</span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {items.map((d) => (
                    <Card key={d.id} padding={13} style={{ borderLeft: `3px solid ${col.bar}` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: color.ink }}>{d.title}</div>
                          <div style={{ fontSize: 11.5, color: color.subtle, marginTop: 5, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                            <span>{d.fromName || d.fromId || "—"}</span>
                            <Icon name="arrowRight" size={12} />
                            <span>{d.toName || d.toId || "—"}</span>
                          </div>
                          <div style={{ fontSize: 11, color: color.faint2, marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            {d.owner && <span>Owner: {d.owner}</span>}
                            {d.dueDate && <span>Due {toDisplay(d.dueDate)}</span>}
                          </div>
                        </div>
                        {inc.canEdit && (
                          <RowMenu ariaLabel="Dependency actions" width={150}>
                            {(close) => (<>
                              <MenuItem label="Edit" icon={<Icon name="edit" size={15} />} onClick={() => { setModal({ dep: d }); close(); }} />
                              <MenuItem label="Delete" icon={<Icon name="trash" size={15} />} danger onClick={() => { del.mutate(d.id); close(); }} />
                            </>)}
                          </RowMenu>
                        )}
                      </div>
                    </Card>
                  ))}
                  {items.length === 0 && <div style={{ fontSize: 11.5, color: color.faint3, padding: "8px 2px" }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal && <DependencyModal inc={inc} dep={modal.dep} onClose={() => setModal(null)} />}
    </div>
  );
}

// --- Modals -----------------------------------------------------------------
function IncrementModal({ initial, onClose, onSave, busy }: {
  initial?: IncrementDetail; onClose: () => void;
  onSave: (b: { key: string; name: string; startDate: string; endDate: string; state: string }) => void; busy: boolean;
}) {
  const [key, setKey] = useState(initial?.key ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStart] = useState(initial?.startDate ?? "");
  const [endDate, setEnd] = useState(initial?.endDate ?? "");
  const [state, setState] = useState(initial?.state ?? "Planning");
  const submit = () => { if (!name.trim()) { toast("Name is required", "error"); return; } onSave({ key, name, startDate, endDate, state }); };
  return (
    <Modal onClose={onClose} width={480} label={initial ? "Edit increment" : "New increment"}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 16 }}>{initial ? "Edit increment" : "New program increment"}</div>
      <div style={{ display: "grid", gap: 12 }}>
        <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="PI 2026.3 — Autumn" />}</Field>
        <Field label="Key (quarter)">{(id) => <Input id={id} value={key} onChange={(e) => setKey(e.target.value)} placeholder="2026-Q3" />}</Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Start date">{(id) => <Input id={id} type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />}</Field>
          <Field label="End date">{(id) => <Input id={id} type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />}</Field>
        </div>
        <Field label="State">{(id) => <Select id={id} value={state} onChange={(e) => setState(e.target.value)}>{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>}</Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : initial ? "Save" : "Create"}</Button>
      </div>
    </Modal>
  );
}

// Type + entity picker reused for objective links and dependency endpoints.
function TargetPicker({ targets, type, id, onChange }: { targets: LinkTarget[]; type: string; id: string; onChange: (type: string, id: string) => void }) {
  const opts = targets.filter((t) => t.type === type);
  return (
    <div style={{ display: "flex", gap: 9 }}>
      <Select value={type} onChange={(e) => onChange(e.target.value, "")} style={{ width: 130 }}>
        {LINK_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </Select>
      <Select value={id} disabled={!type} onChange={(e) => onChange(type, e.target.value)} style={{ flex: 1 }}>
        <option value="">{type ? "Select…" : "—"}</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Select>
    </div>
  );
}

function ObjectiveModal({ inc, obj, onClose }: { inc: IncrementDetail; obj?: Objective; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(obj?.title ?? "");
  const [description, setDesc] = useState(obj?.description ?? "");
  const [entityType, setType] = useState(obj?.entityType ?? "");
  const [entityId, setId] = useState(obj?.entityId ?? "");
  const [businessValue, setBV] = useState(obj?.businessValue ?? 5);
  const [actualValue, setAV] = useState(obj?.actualValue ?? 0);
  const [committed, setCommitted] = useState(obj?.committed ?? true);
  const [confidence, setConf] = useState(obj?.confidence ?? 0);
  const [status, setStatus] = useState(obj?.status ?? "Planned");
  const [objectiveLink, setObjectiveLink] = useState(obj?.objectiveLink ?? "");
  // Strategic OKR objectives this PI objective can advance (empty until the API has any).
  const okrs = useQuery({
    queryKey: ["okrs"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<{ id: string; title: string }[]> => { try { return (await api<{ id: string; title: string }[]>("/okrs")) ?? []; } catch { return []; } },
  });
  const save = useMutation({
    mutationFn: (body: object) => obj
      ? api(`/pi-objectives/${obj.id}`, { method: "PATCH", body: JSON.stringify(body) })
      : api(`/increments/${inc.id}/objectives`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["increment", inc.id] }); onClose(); }, onError: toastError,
  });
  const submit = () => { if (!title.trim()) { toast("Title is required", "error"); return; } save.mutate({ title, description, entityType, entityId, businessValue, actualValue, committed, confidence, status, objectiveLink }); };
  return (
    <Modal onClose={onClose} width={500} label={obj ? "Edit objective" : "Add objective"}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 16 }}>{obj ? "Edit PI objective" : "Add PI objective"}</div>
      <div style={{ display: "grid", gap: 12 }}>
        <Field label="Objective">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Launch unified checkout across Nordics" />}</Field>
        <Field label="Description">{(id) => <Textarea id={id} value={description} onChange={(e) => setDesc(e.target.value)} rows={2} />}</Field>
        <Field label="Linked deliverable">{() => <TargetPicker targets={inc.targets} type={entityType} id={entityId} onChange={(t, i) => { setType(t); setId(i); }} />}</Field>
        <Field label="Strategic OKR (optional)">{(id) => (
          <Select id={id} value={objectiveLink} onChange={(e) => setObjectiveLink(e.target.value)}>
            <option value="">No OKR link</option>
            {(okrs.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </Select>
        )}</Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Business value (1–10)">{(id) => <Input id={id} type="number" min={0} max={10} value={businessValue} onChange={(e) => setBV(Number(e.target.value))} />}</Field>
          <Field label="Status">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>{OBJ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>}</Field>
        </div>
        {status === "Done" && <Field label="Actual value delivered (1–10)">{(id) => <Input id={id} type="number" min={0} max={10} value={actualValue} onChange={(e) => setAV(Number(e.target.value))} />}</Field>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: color.text, cursor: "pointer" }}>
            <input type="checkbox" checked={committed} onChange={(e) => setCommitted(e.target.checked)} /> Committed objective {committed ? "" : "(stretch)"}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: color.faint2 }}>Confidence</span>
            <Confidence value={confidence} onVote={setConf} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : obj ? "Save" : "Add"}</Button>
      </div>
    </Modal>
  );
}

function IterationModal({ inc, it, onClose }: { inc: IncrementDetail; it?: Iteration; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(it?.name ?? "");
  const [startDate, setStart] = useState(it?.startDate ?? "");
  const [endDate, setEnd] = useState(it?.endDate ?? "");
  const [capacity, setCap] = useState(it?.capacity ?? 0);
  const [load, setLoad] = useState(it?.load ?? 0);
  const save = useMutation({
    mutationFn: (body: object) => it
      ? api(`/pi-iterations/${it.id}`, { method: "PATCH", body: JSON.stringify(body) })
      : api(`/increments/${inc.id}/iterations`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["increment", inc.id] }); onClose(); }, onError: toastError,
  });
  const submit = () => { if (!name.trim()) { toast("Name is required", "error"); return; } save.mutate({ name, startDate, endDate, capacity, load }); };
  return (
    <Modal onClose={onClose} width={460} label={it ? "Edit iteration" : "Add iteration"}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 16 }}>{it ? "Edit iteration" : "Add iteration"}</div>
      <div style={{ display: "grid", gap: 12 }}>
        <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Iteration 1" />}</Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Start date">{(id) => <Input id={id} type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />}</Field>
          <Field label="End date">{(id) => <Input id={id} type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />}</Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Capacity (points)">{(id) => <Input id={id} type="number" min={0} value={capacity} onChange={(e) => setCap(Number(e.target.value))} />}</Field>
          <Field label="Planned load (points)">{(id) => <Input id={id} type="number" min={0} value={load} onChange={(e) => setLoad(Number(e.target.value))} />}</Field>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : it ? "Save" : "Add"}</Button>
      </div>
    </Modal>
  );
}

function DependencyModal({ inc, dep, onClose }: { inc: IncrementDetail; dep?: Dependency; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(dep?.title ?? "");
  const [fromType, setFromType] = useState(dep?.fromType ?? "");
  const [fromId, setFromId] = useState(dep?.fromId ?? "");
  const [toType, setToType] = useState(dep?.toType ?? "");
  const [toId, setToId] = useState(dep?.toId ?? "");
  const [owner, setOwner] = useState(dep?.owner ?? "");
  const [dueDate, setDue] = useState(dep?.dueDate ?? "");
  const [status, setStatus] = useState(dep?.status ?? "Identified");
  const save = useMutation({
    mutationFn: (body: object) => dep
      ? api(`/pi-dependencies/${dep.id}`, { method: "PATCH", body: JSON.stringify(body) })
      : api(`/increments/${inc.id}/dependencies`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["increment", inc.id] }); onClose(); }, onError: toastError,
  });
  const submit = () => { if (!title.trim()) { toast("Title is required", "error"); return; } save.mutate({ title, fromType, fromId, toType, toId, owner, dueDate, status }); };
  return (
    <Modal onClose={onClose} width={500} label={dep ? "Edit dependency" : "Add dependency"}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 16 }}>{dep ? "Edit dependency" : "Add cross-team dependency"}</div>
      <div style={{ display: "grid", gap: 12 }}>
        <Field label="Title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Payments API needed before checkout launch" />}</Field>
        <Field label="From (needs)">{() => <TargetPicker targets={inc.targets} type={fromType} id={fromId} onChange={(t, i) => { setFromType(t); setFromId(i); }} />}</Field>
        <Field label="To (provides)">{() => <TargetPicker targets={inc.targets} type={toType} id={toId} onChange={(t, i) => { setToType(t); setToId(i); }} />}</Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Owner">{(id) => <Input id={id} value={owner} onChange={(e) => setOwner(e.target.value)} />}</Field>
          <Field label="Due date">{(id) => <Input id={id} type="date" value={dueDate} onChange={(e) => setDue(e.target.value)} />}</Field>
        </div>
        <Field label="Status">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>{DEP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>}</Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : dep ? "Save" : "Add"}</Button>
      </div>
    </Modal>
  );
}
