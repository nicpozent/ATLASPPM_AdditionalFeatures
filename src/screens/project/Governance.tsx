// Project → Governance tab: stage-gate approvals, architecture/security review
// checkpoints, and the decision log (ADR). Extracted from Project.tsx unchanged
// (ADR-0041) to keep that screen's file focused.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, Button, Modal, Input, Select, Textarea } from "@/components/ui";
import { toastError } from "@/components/Toast";
import { DecLabel } from "./shared";

interface GateCriterion { id: number; label: string; met: boolean; }
interface Gate { id: number; code: string; name: string; approver: string; status: string; date: string; pct: number; metLabel: string; criteria: GateCriterion[]; }
interface GatesData { canGovern: boolean; gates: Gate[]; }

const GATE_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved:      { ink: color.successInk, tint: color.successTint },
  Pending:       { ink: color.warningInk, tint: color.warningTint },
  Rejected:      { ink: color.dangerInk, tint: color.dangerTint },
  "Not started": { ink: "#8A92A6", tint: color.bg },
};

export function Governance({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["gates", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<GatesData> => (await api<GatesData>(`/projects/${projectId}/gates`)) ?? { canGovern: false, gates: [] },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["gates", projectId] });
  const toggle = useMutation({
    mutationFn: (v: { critId: number; met: boolean }) => api(`/gates/criteria/${v.critId}`, { method: "PATCH", body: JSON.stringify({ met: v.met }) }),
    onSuccess: invalidate,
  });
  const addCrit = useMutation({
    mutationFn: (v: { gateId: number; label: string }) => api(`/gates/${v.gateId}/criteria`, { method: "POST", body: JSON.stringify({ label: v.label }) }),
    onSuccess: invalidate,
    onError: (e) => toastError(e),
  });
  const delCrit = useMutation({
    mutationFn: (critId: number) => api(`/gates/criteria/${critId}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (e) => toastError(e),
  });
  const decide = useMutation({
    mutationFn: (v: { gateId: number; action: "approve" | "reject" }) => api(`/gates/${v.gateId}/${v.action}`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const gates = data?.gates ?? [];
  const canGovern = data?.canGovern ?? false;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its governance." /></Card>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Stage-gate approvals, review checkpoints &amp; decision log.</div>
        <div style={{ flex: 1 }} />
        {canGovern && <span style={{ fontSize: 11, fontWeight: 600, color: color.successInk, background: color.successTint, padding: "4px 10px", borderRadius: 6 }}>You can approve gates</span>}
      </div>

      {/* gate rail */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, marginBottom: 20 }}>
        {gates.map((g) => {
          const sc = GATE_STATUS[g.status] ?? GATE_STATUS["Not started"];
          const canAct = canGovern && g.status !== "Approved";
          return (
            <div key={g.id} style={{ flex: "0 0 224px", background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: "15px 16px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ flex: 1, fontFamily: font.head, fontSize: 13.5, fontWeight: 600, color: color.ink }}>{g.name}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{g.status}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: color.faint3, marginBottom: 10 }}>
                <span>{g.approver}</span><span>·</span><span>{g.date || "—"}</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: color.bg, overflow: "hidden", marginBottom: 8 }}><div style={{ height: "100%", width: `${g.pct}%`, background: color.primary }} /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                {g.criteria.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
                    <button onClick={() => canGovern && toggle.mutate({ critId: c.id, met: !c.met })} disabled={!canGovern || toggle.isPending}
                      style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: 7, textAlign: "left", background: "none", border: "none", padding: 0, cursor: canGovern ? "pointer" : "default", fontFamily: "inherit" }}>
                      <span style={{ flex: "none", width: 14, height: 14, borderRadius: 4, marginTop: 1, background: c.met ? "#15A34A" : "transparent", border: c.met ? "none" : `1.5px solid ${color.border2}`, color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.met ? "✓" : ""}</span>
                      <span style={{ fontSize: 11.5, color: color.text, lineHeight: 1.35 }}>{c.label}</span>
                    </button>
                    {canGovern && (
                      <button onClick={() => { if (confirm(`Remove criterion “${c.label}”?`)) delCrit.mutate(c.id); }} title="Remove criterion"
                        style={{ flex: "none", background: "none", border: "none", cursor: "pointer", color: color.faint3, padding: 0, marginTop: 1, lineHeight: 1 }}>×</button>
                    )}
                  </div>
                ))}
                {canGovern && (
                  <button onClick={() => { const l = prompt("New criterion")?.trim(); if (l) addCrit.mutate({ gateId: g.id, label: l }); }} disabled={addCrit.isPending}
                    style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 600, color: color.primary, background: "none", border: "none", padding: "2px 0", cursor: "pointer", fontFamily: "inherit" }}>+ Add criterion</button>
                )}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 10.5, color: color.faint3, marginBottom: 8 }}>{g.metLabel}</div>
              {canAct && (
                <div style={{ display: "flex", gap: 7 }}>
                  <button onClick={() => decide.mutate({ gateId: g.id, action: "approve" })} disabled={decide.isPending}
                    style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#fff", background: "#0B6B37", border: "none", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontFamily: "inherit" }}>Approve</button>
                  <button onClick={() => decide.mutate({ gateId: g.id, action: "reject" })} disabled={decide.isPending}
                    style={{ flex: "none", fontSize: 12, fontWeight: 600, color: color.dangerInk, background: color.dangerTint, border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit" }}>Reject</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* review checkpoints (structural; populated from architecture/security reviews) */}
      <Card padding={0} style={{ overflow: "hidden", marginBottom: 18 }}>
        <div style={{ padding: "16px 22px 13px", fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Architecture &amp; security review checkpoints</div>
        <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1.2fr 0.9fr 0.8fr 2.2fr", padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Gate</div><div>Type</div><div>Reviewer</div><div>Status</div><div>Date</div><div>Note</div>
        </div>
        <EmptyBlock message="No review checkpoints scheduled yet." minHeight={120} />
      </Card>

      {/* decision log (ADR) */}
      <DecisionLog projectId={projectId} canGovern={canGovern} />
    </div>
  );
}

interface Decision { id: number; code: string; title: string; context: string; decision: string; owner: string; date: string; status: string; }
const DEC_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: color.successInk, tint: color.successTint },
  Proposed: { ink: color.primaryDark, tint: color.primaryTint2 },
  Rejected: { ink: color.dangerInk, tint: color.dangerTint },
};
const DEC_COLS = "0.7fr 1.6fr 2fr 1fr 0.8fr 0.9fr";

function DecisionLog({ projectId, canGovern }: { projectId: string | null; canGovern: boolean }) {
  const [modal, setModal] = useState(false);
  const [open, setOpen] = useState<Decision | null>(null);
  const { data } = useQuery({
    queryKey: ["decisions", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<Decision[]> => (await api<{ decisions: Decision[] }>(`/projects/${projectId}/decisions`))?.decisions ?? [],
  });
  const decisions = data ?? [];

  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px 22px 13px" }}>
        <span style={{ flex: 1, fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Decision log</span>
        {canGovern && (
          <button onClick={() => setModal(true)} style={{ fontSize: 12.5, fontWeight: 600, color: color.primary, background: color.primaryTint2, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit" }}>+ Log decision</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: DEC_COLS, padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
        <div>ID</div><div>Decision</div><div>Rationale</div><div>Owner</div><div>Date</div><div>Status</div>
      </div>
      {decisions.length === 0 ? (
        <EmptyBlock message="No decisions logged yet." minHeight={120} />
      ) : decisions.map((d) => {
        const sc = DEC_STATUS[d.status] ?? DEC_STATUS.Proposed;
        return (
          <div key={d.code} onClick={() => canGovern && setOpen(d)} style={{ display: "grid", gridTemplateColumns: DEC_COLS, alignItems: "flex-start", padding: "13px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, cursor: canGovern ? "pointer" : "default" }}>
            <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint3 }}>{d.code}</div>
            <div style={{ fontSize: 13, color: color.text, fontWeight: 600 }}>{d.title}</div>
            <div style={{ fontSize: 12, color: color.faint, lineHeight: 1.4 }}><span style={{ color: color.faint3 }}>{d.context}</span> {d.decision}</div>
            <div style={{ fontSize: 12, color: color.subtle }}>{d.owner}</div>
            <div style={{ fontSize: 11.5, color: color.faint3 }}>{d.date}</div>
            <div><span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 9px", borderRadius: 6 }}>{d.status}</span></div>
          </div>
        );
      })}
      {modal && <LogDecisionModal projectId={projectId!} onClose={() => setModal(false)} />}
      {open && <EditDecisionModal projectId={projectId!} decision={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function EditDecisionModal({ projectId, decision, onClose }: { projectId: string; decision: Decision; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(decision.title);
  const [context, setContext] = useState(decision.context);
  const [dtext, setDtext] = useState(decision.decision);
  const [owner, setOwner] = useState(decision.owner === "—" ? "" : decision.owner);
  const [status, setStatus] = useState(decision.status);
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["decisions", projectId] });
  const save = useMutation({
    mutationFn: () => api(`/decisions/${decision.id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim(), context: context.trim(), decision: dtext.trim(), owner: owner.trim(), status }) }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/decisions/${decision.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  return (
    <Modal onClose={onClose} width={500} label={`${decision.code} · Decision`}>
      <DecLabel>Decision title</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What was decided?" style={{ marginBottom: 14 }} />
      <DecLabel>Context / problem</DecLabel>
      <Textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Why was a decision needed?" style={{ minHeight: 56, resize: "vertical", marginBottom: 14 }} />
      <DecLabel>Decision &amp; rationale</DecLabel>
      <Textarea value={dtext} onChange={(e) => setDtext(e.target.value)} placeholder="What was chosen and why?" style={{ minHeight: 56, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Owner</DecLabel><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Decision owner" /></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{["Proposed", "Approved", "Rejected"].map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: color.dangerInk, fontWeight: 600 }}>Delete this decision?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: color.danger }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.dangerInk, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}

function LogDecisionModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [decision, setDecision] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("Proposed");

  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/decisions`, { method: "POST", body: JSON.stringify({ title: title.trim(), context: context.trim(), decision: decision.trim(), owner: owner.trim(), status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["decisions", projectId] }); onClose(); },
  });
  const submit = () => { if (title.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={500} label="Log a decision">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Captured in the project decision log.</div>
      <DecLabel>Decision title</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What was decided?" style={{ marginBottom: 14 }} />
      <DecLabel>Context / problem</DecLabel>
      <Textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Why was a decision needed?" style={{ minHeight: 56, resize: "vertical", marginBottom: 14 }} />
      <DecLabel>Decision &amp; rationale</DecLabel>
      <Textarea value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="What was chosen and why?" style={{ minHeight: 56, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <DecLabel>Owner</DecLabel>
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Decision owner" />
        </div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["Proposed", "Approved", "Rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !title.trim()}>{create.isPending ? "Logging…" : "Log decision"}</Button>
      </div>
    </Modal>
  );
}
