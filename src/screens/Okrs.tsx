import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { Icon } from "@/components/Icon";
import { api } from "@/api";
import { Button, Input, RowMenu, MenuItem } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";

// ---------------------------------------------------------------------------
// Data model + hook (empty by default until the API exists).
// ---------------------------------------------------------------------------
interface Kr { id: string; title: string; link: string; progress: number; linkType?: string; linkId?: string; auto?: boolean }
interface Objective { id: string; title: string; owner: string; horizon: string; krs: Kr[]; status?: string; health?: string; startDate?: string; targetDate?: string }
type OkrStatus = "Active" | "Completed";

interface NewObjective { title: string; owner: string; horizon: string; startDate: string; targetDate: string }
interface EditObjective { title: string; owner: string; horizon: string; startDate: string; targetDate: string }
interface NewKr { title: string; linkType: string; linkId: string; progress: number }

// Typed link to a project / program / product for a key result.
interface LinkOpt { id: string; name: string }
const LINK_TYPES = [
  { key: "project", label: "Project" },
  { key: "program", label: "Program" },
  { key: "product", label: "Product" },
];
function useLinkList(path: string): LinkOpt[] {
  const { data } = useQuery({
    queryKey: ["link-opts", path], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<LinkOpt[]> => { try { return (await api<LinkOpt[]>(path)) ?? []; } catch { return []; } },
  });
  return data ?? [];
}
function useLinkOptions() {
  const projects = useLinkList("/projects");
  const programs = useLinkList("/programs");
  const products = useLinkList("/products");
  return (type: string): LinkOpt[] => type === "project" ? projects : type === "program" ? programs : type === "product" ? products : [];
}

// Type + entity picker for a KR's linked deliverable.
function LinkPicker({ type, id, onChange }: { type: string; id: string; onChange: (type: string, id: string) => void }) {
  const optsFor = useLinkOptions();
  const opts = optsFor(type);
  return (
    <div style={{ display: "flex", gap: 9 }}>
      <select value={type} onChange={(e) => onChange(e.target.value, "")} style={okrSelectStyle}>
        <option value="">No link</option>
        {LINK_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
      <select value={id} disabled={!type} onChange={(e) => onChange(type, e.target.value)} style={{ ...okrSelectStyle, flex: 1 }}>
        <option value="">{type ? "Select…" : "—"}</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}
const okrSelectStyle: React.CSSProperties = { fontSize: 13.5, padding: "8px 10px", border: `1px solid ${color.border2}`, borderRadius: 8, background: color.surface, color: color.text, fontFamily: "inherit", outline: "none" };

// Manual RAG health (set by PMO / Platform Admin).
const RAG: Record<string, { label: string; ink: string; tint: string; dot: string }> = {
  green: { label: "On track", ink: "#0B6B37", tint: "#E7F4EC", dot: "#15A34A" },
  amber: { label: "At risk", ink: "#8A6300", tint: "#FBF2D7", dot: "#E0A100" },
  red: { label: "Off track", ink: "#A1282B", tint: "#FBE7E8", dot: "#D13438" },
};
const OKR_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const okrToDisplay = (iso: string) => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return y && m && d ? `${d} ${OKR_MONTHS[m - 1]} ${y}` : ""; };
const okrToIso = (display: string) => { const t = Date.parse(display || ""); return isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10); };
const parseTs = (d?: string) => { const t = Date.parse(d || ""); return isNaN(t) ? null : t; };

// Timing signals: near-horizon warning, missed (spilled past the target and not
// achieved), and where "today" sits on the start→target span.
function okrTiming(o: Objective, progress: number) {
  const start = parseTs(o.startDate), target = parseTs(o.targetDate);
  const now = Date.now();
  const done = (o.status ?? "Active") === "Completed" || progress >= 100;
  const missed = target != null && !done && now > target;
  const near = target != null && !done && !missed && target - now <= 30 * 24 * 3600 * 1000 && progress < 100;
  const todayPct = start != null && target != null && target > start ? Math.max(0, Math.min(100, ((now - start) / (target - start)) * 100)) : null;
  return { start, target, missed, near, spillover: missed, todayPct };
}

function useObjectives() {
  return useQuery({
    // KR progress is derived server-side from the linked project/program/product,
    // which changes on other screens. Always refetch on mount so opening OKRs
    // reflects the current rollup without a manual page refresh.
    queryKey: ["okrs"], retry: false, staleTime: 0, refetchOnMount: "always",
    queryFn: async (): Promise<Objective[]> => {
      try { return (await api<Objective[]>("/okrs")) ?? []; } catch { return []; }
    },
  });
}

// Objective % = mean of its key-result progress (prototype rolls KRs up).
const objProgress = (o: Objective) =>
  o.krs.length ? Math.round(o.krs.reduce((s, k) => s + k.progress, 0) / o.krs.length) : 0;
// Progress → ink colour, lifted verbatim from the prototype's OKR builder.
const objInk = (p: number) => (p >= 66 ? "#0B6B37" : p >= 33 ? "#8A6300" : "#A1282B");
const krFill = (p: number) => (p >= 66 ? "#15A34A" : p >= 33 ? "#E0A100" : "#D13438");

export default function Okrs() {
  const { can } = usePermissions();
  const canEdit = can("cap-okrs", "E"); // cosmetic gate, driven by the matrix (API is authoritative)
  const canDelete = can("cap-okrs", "F");
  const { data: objectives = [] } = useObjectives();
  const qc = useQueryClient();

  // Modal state: obj = new objective, { objId } = add key result to objId.
  const [modal, setModal] = useState<null | { kind: "obj" } | { kind: "kr"; objId: string }>(null);
  const [editObj, setEditObj] = useState<Objective | null>(null);
  const [confirmDel, setConfirmDel] = useState<Objective | null>(null);
  const [linkKr, setLinkKr] = useState<Kr | null>(null);

  const createObjective = useMutation({
    mutationFn: (body: NewObjective) => api<Objective>("/okrs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["okrs"] }),
  });
  const createKr = useMutation({
    mutationFn: ({ objId, body }: { objId: string; body: NewKr }) =>
      api<Kr>(`/okrs/${objId}/krs`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["okrs"] }),
  });
  const updateKrProgress = useMutation({
    mutationFn: ({ krId, progress }: { krId: string; progress: number }) =>
      api<Kr>(`/krs/${krId}`, { method: "PATCH", body: JSON.stringify({ progress }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["okrs"] }),
  });
  const updateKrLink = useMutation({
    mutationFn: ({ krId, linkType, linkId }: { krId: string; linkType: string; linkId: string }) =>
      api<Kr>(`/krs/${krId}`, { method: "PATCH", body: JSON.stringify({ linkType, linkId }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["okrs"] }); setLinkKr(null); },
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/okrs/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["okrs"] }),
  });
  const updateObjective = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<EditObjective & { health: string }> }) =>
      api(`/okrs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["okrs"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/okrs/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["okrs"] }); setConfirmDel(null); },
  });

  const [okrStatus, setOkrStatus] = useState<OkrStatus>("Active");
  const shown = objectives.filter((o) => (o.status ?? "Active") === okrStatus);
  const countBy = (s: OkrStatus) => objectives.filter((o) => (o.status ?? "Active") === s).length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, fontSize: 13.5, color: color.subtle }}>
          Objectives &amp; key results, each linked to the projects/programs/products that deliver them.
        </div>
        {canEdit && (
          <Button onClick={() => setModal({ kind: "obj" })} style={{ padding: "9px 14px" }}>
            <Icon name="plus" size={16} /> New objective
          </Button>
        )}
      </div>

      {/* Objectives aren't deleted — a completed objective moves to Completed. */}
      <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2, marginBottom: 16 }}>
        {(["Active", "Completed"] as OkrStatus[]).map((s) => (
          <button key={s} onClick={() => setOkrStatus(s)} style={{ padding: "7px 15px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: okrStatus === s ? "#fff" : "transparent", color: okrStatus === s ? color.primary : "#565F73", boxShadow: okrStatus === s ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>
            {s} · {countBy(s)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{
          background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16,
          padding: "56px 24px", textAlign: "center",
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, background: color.primaryTint, color: color.primary,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
          }}><Icon name="target" size={22} /></div>
          <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>{okrStatus === "Completed" ? "No completed objectives yet" : "No objectives yet"}</div>
          <div style={{ fontSize: 13, color: color.faint2, marginTop: 4 }}>
            {okrStatus === "Completed" ? "Objectives you mark complete will appear here."
              : canEdit ? "Create an objective and link key results to the work that delivers them."
              : "Objectives will appear here once the PMO defines them."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {shown.map((o) => {
            const p = objProgress(o);
            const t = okrTiming(o, p);
            const rag = RAG[o.health ?? "green"] ?? RAG.green;
            return (
              <div key={o.id} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "18px 22px", borderBottom: `1px solid ${color.bg}` }}>
                  <span style={{ width: 40, height: 40, borderRadius: 11, background: color.primaryTint, color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <Icon name="target" size={20} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>{o.title}</span>
                      {/* At-risk / missed signals against the horizon. */}
                      {t.missed && <span title="Missed — past its target date and not achieved" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#A1282B", background: "#FBE7E8", padding: "2px 8px", borderRadius: 6 }}><Icon name="alert" size={13} /> Missed</span>}
                      {t.near && <span title="Close to its horizon and not yet achieved" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#8A6300", background: "#FBF2D7", padding: "2px 8px", borderRadius: 6 }}><Icon name="alert" size={13} /> Near horizon</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: color.faint3 }}>{o.id} · {o.owner} · {o.horizon}</div>
                  </div>
                  {/* Manual RAG health — editable by PMO / Platform Admin. */}
                  {canEdit ? (
                    <select value={o.health ?? "green"} onChange={(e) => updateObjective.mutate({ id: o.id, body: { health: e.target.value } })} title="Manual RAG status"
                      style={{ fontSize: 11.5, fontWeight: 700, color: rag.ink, background: rag.tint, border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                      <option value="green">On track</option><option value="amber">At risk</option><option value="red">Off track</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: rag.ink, background: rag.tint, padding: "4px 10px", borderRadius: 6 }}>{rag.label}</span>
                  )}
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: font.head, fontSize: 22, fontWeight: 700, color: objInk(p) }}>{p}%</div>
                    <div style={{ fontSize: 10.5, color: color.faint3 }}>objective</div>
                  </div>
                  {canEdit && <button onClick={() => setEditObj(o)} title="Edit objective" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: color.subtle, background: color.surface, border: `1px solid ${color.border2}`, padding: "7px 11px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}><Icon name="edit" size={14} /> Edit</button>}
                  {canEdit && (
                    (o.status ?? "Active") === "Completed"
                      ? <button onClick={() => setStatus.mutate({ id: o.id, status: "Active" })} style={{ fontSize: 12, fontWeight: 600, color: color.primary, background: color.primaryTint, border: "1px solid #CFE0F4", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Reopen</button>
                      : <button onClick={() => setStatus.mutate({ id: o.id, status: "Completed" })} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#0B6B37", background: "#E7F4EC", border: "1px solid #BFE6CE", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}><Icon name="check" size={14} /> Mark complete</button>
                  )}
                  {canDelete && (
                    <RowMenu ariaLabel="Objective actions" width={168}>
                      {(close) => (
                        <MenuItem label="Delete objective" icon={<Icon name="trash" size={15} />} danger onClick={() => { setConfirmDel(o); close(); }} />
                      )}
                    </RowMenu>
                  )}
                </div>
                {/* Timeline — start → target with today's position + progress. */}
                {(o.startDate || o.targetDate) && (
                  <div style={{ padding: "13px 22px 4px" }}>
                    <div style={{ position: "relative", height: 8, background: color.bg, borderRadius: 5 }}>
                      <div style={{ height: "100%", width: `${p}%`, background: t.missed ? "#D13438" : rag.dot, borderRadius: 5 }} />
                      {t.todayPct != null && <div title="Today" style={{ position: "absolute", top: -3, left: `${t.todayPct}%`, transform: "translateX(-50%)", width: 2, height: 14, background: color.ink }} />}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10.5, color: color.faint3, fontFamily: font.mono }}>
                      <span>{o.startDate || "—"}</span>
                      <span>{t.spillover && <span style={{ color: "#A1282B", fontWeight: 700, fontFamily: font.body }}>Spilled over · </span>}Target {o.targetDate || "—"}</span>
                    </div>
                  </div>
                )}
                <div style={{ padding: "8px 22px 16px" }}>
                  {o.krs.length === 0 && (
                    <div style={{ padding: "18px 0", fontSize: 12.5, color: color.faint3, textAlign: "center" }}>
                      No key results yet.
                    </div>
                  )}
                  {o.krs.map((k) => (
                    <div key={k.id} style={{ padding: "11px 0", borderBottom: "1px solid #F4F6FA" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                        <span style={{ flex: 1, fontSize: 13.5, color: color.text, fontWeight: 500 }}>{k.title}</span>
                        {k.link && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: color.primaryDark, background: color.primaryTint2, padding: "2px 9px", borderRadius: 6 }}>
                            <Icon name="link" size={14} />
                            {k.linkType && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.7 }}>{k.linkType}</span>}
                            {k.link}
                          </span>
                        )}
                        {canEdit && (
                          <button onClick={() => setLinkKr(k)} title="Link to a project, program or product" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: color.primary, background: "transparent", border: `1px solid ${color.border2}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                            <Icon name="link" size={13} /> {k.link ? "Edit link" : "Link"}
                          </button>
                        )}
                        {k.auto ? (
                          <span title={`Measured automatically from ${k.linkType ?? "the linked deliverable"}: ${k.link}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: font.mono, fontSize: 12.5, fontWeight: 700, color: color.textMuted, whiteSpace: "nowrap" }}>
                            <Icon name="link" size={12} />{k.progress}%
                          </span>
                        ) : canEdit ? (
                          <input type="number" min={0} max={100} value={k.progress}
                            onChange={(e) => updateKrProgress.mutate({ krId: k.id, progress: clampPct(e.target.value) })}
                            style={{ width: 52, textAlign: "center", border: `1px solid ${color.border2}`, borderRadius: 7, padding: "5px 0", fontSize: 12, fontWeight: 700, fontFamily: font.mono, color: color.text, outline: "none" }} />
                        ) : (
                          <span style={{ fontFamily: font.mono, fontSize: 12.5, fontWeight: 700, color: color.textMuted, width: 38, textAlign: "right" }}>{k.progress}%</span>
                        )}
                      </div>
                      <div style={{ height: 7, background: color.bg, borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${clampPct(k.progress)}%`, background: krFill(k.progress), borderRadius: 5 }} />
                      </div>
                    </div>
                  ))}
                  {canEdit && (
                    <button onClick={() => setModal({ kind: "kr", objId: o.id })} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12.5, fontWeight: 600, color: color.primary, background: color.primaryTint, border: "1px solid #CFE0F4", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                      <Icon name="plus" size={14} /> Add key result
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.kind === "obj" && (
        <ObjectiveModal
          submitting={createObjective.isPending}
          onClose={() => setModal(null)}
          onSave={(body) => createObjective.mutate(body, { onSuccess: () => setModal(null) })}
        />
      )}
      {modal?.kind === "kr" && (
        <KrModal
          submitting={createKr.isPending}
          onClose={() => setModal(null)}
          onSave={(body) => createKr.mutate({ objId: modal.objId, body }, { onSuccess: () => setModal(null) })}
        />
      )}
      {editObj && (
        <EditObjectiveModal
          objective={editObj}
          submitting={updateObjective.isPending}
          onClose={() => setEditObj(null)}
          onSave={(body) => updateObjective.mutate({ id: editObj.id, body }, { onSuccess: () => setEditObj(null) })}
        />
      )}
      {linkKr && (
        <KrLinkModal
          kr={linkKr}
          submitting={updateKrLink.isPending}
          onClose={() => setLinkKr(null)}
          onSave={(linkType, linkId) => updateKrLink.mutate({ krId: linkKr.id, linkType, linkId })}
        />
      )}
      {confirmDel && (
        <ModalShell title="Delete objective" onClose={() => setConfirmDel(null)} width={440}>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13.5, color: color.text, lineHeight: 1.5, marginBottom: 8 }}>
              Permanently delete <strong>{confirmDel.title}</strong> <span style={{ fontFamily: font.mono, color: color.faint3 }}>({confirmDel.id})</span> and all of its key results?
            </div>
            <div style={{ fontSize: 12.5, color: "#A1282B", background: "#FBE7E8", borderRadius: 8, padding: "9px 12px" }}>This can't be undone. To keep the record, mark it complete instead.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, padding: "0 20px 20px" }}>
            <button onClick={() => setConfirmDel(null)} style={{ fontSize: 13, fontWeight: 600, color: color.subtle, background: color.surface, border: `1px solid ${color.border2}`, padding: "9px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={() => del.mutate(confirmDel.id)} disabled={del.isPending} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#D13438", border: "none", padding: "9px 16px", borderRadius: 9, cursor: del.isPending ? "not-allowed" : "pointer", opacity: del.isPending ? 0.6 : 1, fontFamily: "inherit" }}>{del.isPending ? "Deleting…" : "Delete permanently"}</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

const clampPct = (v: string | number) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

// --- New objective modal --------------------------------------------------
function ObjectiveModal({ onClose, onSave, submitting }: { onClose: () => void; onSave: (o: NewObjective) => void; submitting?: boolean }) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [horizon, setHorizon] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), owner: owner.trim() || "Unassigned", horizon: horizon.trim() || "FY2026", startDate: okrToDisplay(startDate), targetDate: okrToDisplay(targetDate) });
  };
  return (
    <ModalShell title="New objective" onClose={onClose} width={480}>
      <div style={{ padding: 20 }}>
        <Label>Objective</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lead Nordic e-commerce conversion" style={{ fontSize: 13.5, marginBottom: 13 }} />
        <div style={{ display: "flex", gap: 11, marginBottom: 13 }}>
          <div style={{ flex: 1 }}>
            <Label>Owner</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" style={{ fontSize: 13.5 }} />
          </div>
          <div style={{ width: 140 }}>
            <Label>Horizon</Label>
            <Input value={horizon} onChange={(e) => setHorizon(e.target.value)} placeholder="FY2026" style={{ fontSize: 13.5 }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 11 }}>
          <div style={{ flex: 1 }}><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ fontSize: 13.5 }} /></div>
          <div style={{ flex: 1 }}><Label>Target date</Label><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={{ fontSize: 13.5 }} /></div>
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={save} saveLabel={submitting ? "Creating…" : "Create objective"} disabled={submitting} />
    </ModalShell>
  );
}

function EditObjectiveModal({ objective, onClose, onSave, submitting }: { objective: Objective; onClose: () => void; onSave: (o: EditObjective) => void; submitting?: boolean }) {
  const [title, setTitle] = useState(objective.title);
  const [owner, setOwner] = useState(objective.owner);
  const [horizon, setHorizon] = useState(objective.horizon);
  const [startDate, setStartDate] = useState(okrToIso(objective.startDate ?? ""));
  const [targetDate, setTargetDate] = useState(okrToIso(objective.targetDate ?? ""));
  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), owner: owner.trim() || "Unassigned", horizon: horizon.trim() || "FY2026", startDate: okrToDisplay(startDate), targetDate: okrToDisplay(targetDate) });
  };
  return (
    <ModalShell title={`Edit ${objective.id}`} onClose={onClose} width={480}>
      <div style={{ padding: 20 }}>
        <Label>Objective</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: 13.5, marginBottom: 13 }} />
        <div style={{ display: "flex", gap: 11, marginBottom: 13 }}>
          <div style={{ flex: 1 }}><Label>Owner</Label><Input value={owner} onChange={(e) => setOwner(e.target.value)} style={{ fontSize: 13.5 }} /></div>
          <div style={{ width: 140 }}><Label>Horizon</Label><Input value={horizon} onChange={(e) => setHorizon(e.target.value)} style={{ fontSize: 13.5 }} /></div>
        </div>
        <div style={{ display: "flex", gap: 11 }}>
          <div style={{ flex: 1 }}><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ fontSize: 13.5 }} /></div>
          <div style={{ flex: 1 }}><Label>Target date</Label><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={{ fontSize: 13.5 }} /></div>
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={save} saveLabel={submitting ? "Saving…" : "Save changes"} disabled={submitting} />
    </ModalShell>
  );
}

// --- Add key result modal -------------------------------------------------
function KrModal({ onClose, onSave, submitting }: { onClose: () => void; onSave: (k: NewKr) => void; submitting?: boolean }) {
  const [title, setTitle] = useState("");
  const [linkType, setLinkType] = useState("");
  const [linkId, setLinkId] = useState("");
  const [progress, setProgress] = useState(0);
  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), linkType, linkId, progress: clampPct(progress) });
  };
  return (
    <ModalShell title="Add key result" onClose={onClose} width={480}>
      <div style={{ padding: 20 }}>
        <Label>Key result</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Conversion rate 3.2% → 4.0%" style={{ fontSize: 13.5, marginBottom: 13 }} />
        <Label>Linked deliverable</Label>
        <div style={{ marginBottom: 13 }}>
          <LinkPicker type={linkType} id={linkId} onChange={(t, i) => { setLinkType(t); setLinkId(i); }} />
        </div>
        <Label>Starting progress %</Label>
        <Input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(clampPct(e.target.value))} style={{ fontSize: 13.5, width: 90, fontFamily: font.mono }} />
      </div>
      <ModalActions onClose={onClose} onSave={save} saveLabel={submitting ? "Adding…" : "Add key result"} disabled={submitting} />
    </ModalShell>
  );
}

// --- Edit an existing key result's link ----------------------------------
function KrLinkModal({ kr, onClose, onSave, submitting }: { kr: Kr; onClose: () => void; onSave: (linkType: string, linkId: string) => void; submitting?: boolean }) {
  const [linkType, setLinkType] = useState(kr.linkType ?? "");
  const [linkId, setLinkId] = useState(kr.linkId ?? "");
  return (
    <ModalShell title="Link key result" onClose={onClose} width={480}>
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 12 }}>{kr.title}</div>
        <Label>Linked deliverable</Label>
        <div style={{ marginTop: 4 }}>
          <LinkPicker type={linkType} id={linkId} onChange={(t, i) => { setLinkType(t); setLinkId(i); }} />
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={() => onSave(linkType, linkId)} saveLabel={submitting ? "Saving…" : "Save link"} disabled={submitting} />
    </ModalShell>
  );
}

// --- Modal primitives -----------------------------------------------------
function ModalShell({ title, width, onClose, children }: { title: string; width: number; onClose: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(17,22,58,0.42)", zIndex: 190 }} />
      <div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: `min(${width}px,94vw)`, background: color.surface, borderRadius: 14, boxShadow: "0 30px 80px rgba(20,26,60,0.35)", zIndex: 200, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${color.bg}`, fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
function ModalActions({ onClose, onSave, saveLabel, disabled }: { onClose: () => void; onSave: () => void; saveLabel: string; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, padding: "0 20px 20px" }}>
      <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: color.subtle, background: color.surface, border: `1px solid ${color.border2}`, padding: "9px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      <button onClick={onSave} disabled={disabled} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "9px 16px", borderRadius: 9, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "inherit" }}>{saveLabel}</button>
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>{children}</label>;
}
