import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { Icon } from "@/components/Icon";
import { api } from "@/api";
import { Button, Input } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";

// ---------------------------------------------------------------------------
// Data model + hook (empty by default until the API exists).
// ---------------------------------------------------------------------------
interface Kr { id: string; title: string; link: string; progress: number }
interface Objective { id: string; title: string; owner: string; horizon: string; krs: Kr[]; status?: string }
type OkrStatus = "Active" | "Completed";

interface NewObjective { title: string; owner: string; horizon: string }
interface NewKr { title: string; link: string; progress: number }

function useObjectives() {
  return useQuery({
    queryKey: ["okrs"], retry: false, staleTime: 60_000,
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
  const canEdit = can("cap-projects", "E"); // cosmetic gate, driven by the matrix (API is authoritative)
  const { data: objectives = [] } = useObjectives();
  const qc = useQueryClient();

  // Modal state: obj = new objective, { objId } = add key result to objId.
  const [modal, setModal] = useState<null | { kind: "obj" } | { kind: "kr"; objId: string }>(null);

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
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/okrs/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["okrs"] }),
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
          <button key={s} onClick={() => setOkrStatus(s)} style={{ padding: "7px 15px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: okrStatus === s ? "#fff" : "transparent", color: okrStatus === s ? color.primary : "#6A7488", boxShadow: okrStatus === s ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>
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
            width: 46, height: 46, borderRadius: 12, background: "#EEF3FB", color: color.primary,
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
            return (
              <div key={o.id} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "18px 22px", borderBottom: `1px solid ${color.bg}` }}>
                  <span style={{ width: 40, height: 40, borderRadius: 11, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <Icon name="target" size={20} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>{o.title}</div>
                    <div style={{ fontSize: 11.5, color: color.faint3 }}>{o.id} · {o.owner} · {o.horizon}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: font.head, fontSize: 22, fontWeight: 700, color: objInk(p) }}>{p}%</div>
                    <div style={{ fontSize: 10.5, color: color.faint3 }}>objective</div>
                  </div>
                  {canEdit && (
                    (o.status ?? "Active") === "Completed"
                      ? <button onClick={() => setStatus.mutate({ id: o.id, status: "Active" })} style={{ fontSize: 12, fontWeight: 600, color: color.primary, background: color.primaryTint, border: "1px solid #CFE0F4", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Reopen</button>
                      : <button onClick={() => setStatus.mutate({ id: o.id, status: "Completed" })} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#0B6B37", background: "#E7F4EC", border: "1px solid #BFE6CE", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}><Icon name="check" size={14} /> Mark complete</button>
                  )}
                </div>
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
                            <Icon name="link" size={14} /> {k.link}
                          </span>
                        )}
                        {canEdit ? (
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
    </div>
  );
}

const clampPct = (v: string | number) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

// --- New objective modal --------------------------------------------------
function ObjectiveModal({ onClose, onSave, submitting }: { onClose: () => void; onSave: (o: NewObjective) => void; submitting?: boolean }) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [horizon, setHorizon] = useState("");
  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), owner: owner.trim() || "Unassigned", horizon: horizon.trim() || "FY2026" });
  };
  return (
    <ModalShell title="New objective" onClose={onClose} width={480}>
      <div style={{ padding: 20 }}>
        <Label>Objective</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lead Nordic e-commerce conversion" style={{ fontSize: 13.5, marginBottom: 13 }} />
        <div style={{ display: "flex", gap: 11 }}>
          <div style={{ flex: 1 }}>
            <Label>Owner</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" style={{ fontSize: 13.5 }} />
          </div>
          <div style={{ width: 140 }}>
            <Label>Horizon</Label>
            <Input value={horizon} onChange={(e) => setHorizon(e.target.value)} placeholder="FY2026" style={{ fontSize: 13.5 }} />
          </div>
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={save} saveLabel={submitting ? "Creating…" : "Create objective"} disabled={submitting} />
    </ModalShell>
  );
}

// --- Add key result modal -------------------------------------------------
function KrModal({ onClose, onSave, submitting }: { onClose: () => void; onSave: (k: NewKr) => void; submitting?: boolean }) {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [progress, setProgress] = useState(0);
  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), link: link.trim(), progress: clampPct(progress) });
  };
  return (
    <ModalShell title="Add key result" onClose={onClose} width={480}>
      <div style={{ padding: 20 }}>
        <Label>Key result</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Conversion rate 3.2% → 4.0%" style={{ fontSize: 13.5, marginBottom: 13 }} />
        <Label>Linked deliverable</Label>
        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Project, program or product" style={{ fontSize: 13.5, marginBottom: 13 }} />
        <Label>Starting progress %</Label>
        <Input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(clampPct(e.target.value))} style={{ fontSize: 13.5, width: 90, fontFamily: font.mono }} />
      </div>
      <ModalActions onClose={onClose} onSave={save} saveLabel={submitting ? "Adding…" : "Add key result"} disabled={submitting} />
    </ModalShell>
  );
}

// --- Modal primitives -----------------------------------------------------
function ModalShell({ title, width, onClose, children }: { title: string; width: number; onClose: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(17,22,58,0.42)", zIndex: 190 }} />
      <div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: `min(${width}px,94vw)`, background: "#fff", borderRadius: 14, boxShadow: "0 30px 80px rgba(20,26,60,0.35)", zIndex: 200, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${color.bg}`, fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
function ModalActions({ onClose, onSave, saveLabel, disabled }: { onClose: () => void; onSave: () => void; saveLabel: string; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, padding: "0 20px 20px" }}>
      <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: color.subtle, background: "#fff", border: `1px solid ${color.border2}`, padding: "9px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      <button onClick={onSave} disabled={disabled} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "9px 16px", borderRadius: 9, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "inherit" }}>{saveLabel}</button>
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", marginBottom: 5 }}>{children}</label>;
}
