// Extracted from Project.tsx — the Requirements tab and its modals/types.
// No behaviour change; shared presentational helpers come from ./shared.
import React from "react";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api, apiUpload, apiDownload } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, Button, Modal, Input, Select, Textarea } from "@/components/ui";
import { toast, toastError } from "@/components/Toast";
import { DecLabel } from "./shared";
import { sectionTitleS, fmtSize } from "./util";

interface ReqAttachment { id: number; fileName: string; size: number; uploadedAt: string; }
interface Requirement { id: number; code: string; title: string; type: string; priority: string; status: string; epic: string; story: string; test: string; testStatus: string; release: string; verified: boolean; description: string; attachments: ReqAttachment[]; }
interface ChangeRequest { id: number; code: string; title: string; reqCode: string; impact: string; sdp: string; status: string; raisedBy: string; date: string; }
interface ReqData { canEdit: boolean; stats: { total: number; approved: number; coverage: number; verified: number }; requirements: Requirement[]; changeRequests: ChangeRequest[]; }

const REQ_TYPES = ["Functional", "Non-functional", "Compliance"];
const REQ_STATUSES = ["Draft", "In review", "Approved", "Replaced", "Archived", "Retired (Requester)", "Retired (PM)", "Retired (Team)"];
const REQ_PRIORITIES = ["Critical", "High", "Medium", "Low"];
const TEST_RESULTS = ["Not run", "In test", "Passed", "Failed"];
const CR_IMPACTS = ["Low", "Medium", "High"];
const REQ_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: "#0B6B37", tint: "#E7F4EC" }, "In review": { ink: "#0C5798", tint: "#E6EFFB" }, Draft: { ink: "#56607A", tint: "#EEF1F6" },
  Replaced: { ink: "#5E2E89", tint: "#F0E8F7" }, Archived: { ink: "#56607A", tint: "#EEF1F6" },
  "Retired (Requester)": { ink: "#8A6300", tint: "#FBF2D7" }, "Retired (PM)": { ink: "#8A6300", tint: "#FBF2D7" }, "Retired (Team)": { ink: "#8A6300", tint: "#FBF2D7" },
};
const TEST_STATUS: Record<string, { ink: string; tint: string }> = {
  Passed: { ink: "#0B6B37", tint: "#E7F4EC" }, "In test": { ink: "#0C5798", tint: "#E6EFFB" }, Failed: { ink: "#A1282B", tint: "#FBE7E8" }, "Not run": { ink: "#56607A", tint: "#EEF1F6" },
};
const CR_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: "#0B6B37", tint: "#E7F4EC" }, Pending: { ink: "#8A6300", tint: "#FBF2D7" }, Rejected: { ink: "#A1282B", tint: "#FBE7E8" },
};
const REQ_COLS = "2.4fr 1fr 1.1fr 0.9fr 1fr 1fr 60px";
const CR_COLS = "0.7fr 2.2fr 0.9fr 0.8fr 1fr 0.9fr 1fr";

export function Requirements({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const [reqModal, setReqModal] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [crFor, setCrFor] = useState<string | null>(null); // req code prefill, or "" for blank
  const [openCr, setOpenCr] = useState<ChangeRequest | null>(null);
  const { data } = useQuery({
    queryKey: ["requirements", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<ReqData | null> => await api<ReqData>(`/projects/${projectId}/requirements`),
  });
  const setResult = useMutation({
    mutationFn: (v: { id: number; testStatus: string }) => api(`/requirements/${v.id}`, { method: "PATCH", body: JSON.stringify({ testStatus: v.testStatus }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requirements", projectId] }),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its requirements." /></Card>;
  if (!data) return <Card><EmptyBlock minHeight={220} message="Loading requirements…" /></Card>;

  const { stats, requirements, changeRequests, canEdit } = data;
  const statCards: [string, number | string, string][] = [
    ["Requirements", stats.total, color.ink], ["Approved", stats.approved, "#0B6B37"],
    ["Test coverage", `${stats.coverage}%`, "#0F6CBD"], ["Verified", stats.verified, color.ink],
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13, marginBottom: 16 }}>
        {statCards.map(([label, value, ink]) => (
          <div key={label} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: "#7B849A" }}>{label}</div>
            <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: ink, marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* traceability matrix */}
      <Card padding={0} style={{ overflow: "hidden", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 22px 13px" }}>
          <div style={{ flex: 1 }}>
            <div style={sectionTitleS}>Traceability matrix</div>
            <div style={{ fontSize: 12, color: color.faint2 }}>Requirement → epic / story → test → release</div>
          </div>
          {canEdit && <Button onClick={() => setReqModal(true)}><Icon name="plus" size={16} /> New requirement</Button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: REQ_COLS, padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Requirement</div><div>Status</div><div>Epic / Story</div><div>Test</div><div>Result</div><div>Release</div><div />
        </div>
        {requirements.length === 0 ? (
          <EmptyBlock message="No requirements yet." minHeight={120} />
        ) : requirements.map((r) => {
          const sc = REQ_STATUS[r.status] ?? REQ_STATUS.Draft;
          const tc = TEST_STATUS[r.testStatus] ?? TEST_STATUS["Not run"];
          return (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: REQ_COLS, alignItems: "center", padding: "13px 22px", borderBottom: "1px solid #F2F4F9" }}>
              <div style={{ minWidth: 0 }}>
                <button onClick={() => setOpenId(r.id)} style={{ fontSize: 13.5, fontWeight: 600, color: color.primary, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>{r.title}</button>
                <div style={{ fontSize: 11, color: color.faint3, fontFamily: font.mono, display: "flex", alignItems: "center", gap: 6 }}>{r.code} · {r.type} · {r.priority}{r.attachments.length > 0 && <span title={`${r.attachments.length} attachment(s)`} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}><Icon name="paperclip" size={11} />{r.attachments.length}</span>}</div>
              </div>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 9px", borderRadius: 6 }}>{r.status}</span></div>
              <div style={{ fontSize: 12, color: color.subtle }}>{r.epic || "—"}<div style={{ fontSize: 11, color: color.faint3, fontFamily: font.mono }}>{r.story}</div></div>
              <div style={{ fontSize: 12, color: color.subtle, fontFamily: font.mono }}>{r.test}</div>
              <div>
                <select value={r.testStatus} disabled={!canEdit} onChange={(e) => setResult.mutate({ id: r.id, testStatus: e.target.value })}
                  style={{ fontSize: 11, fontWeight: 600, color: tc.ink, background: tc.tint, border: "none", borderRadius: 20, padding: "3px 8px", fontFamily: "inherit", cursor: canEdit ? "pointer" : "default" }}>
                  {TEST_RESULTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: color.subtle }}>{r.release}</div>
              <div style={{ textAlign: "right" }}>
                {canEdit && <button onClick={() => setCrFor(r.code)} title="Raise change request" style={{ fontSize: 10.5, fontWeight: 600, color: color.primary, background: "#EAF2FB", border: `1px solid ${color.border}`, padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>CR</button>}
              </div>
            </div>
          );
        })}
      </Card>

      {/* change requests */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 22px 13px" }}>
          <div style={{ flex: 1 }}>
            <div style={sectionTitleS}>Change requests</div>
            <div style={{ fontSize: 12, color: color.faint2 }}>Scope changes against requirements · PMO approval workflow</div>
          </div>
          {canEdit && <Button onClick={() => setCrFor("")}><Icon name="plus" size={16} /> Raise CR</Button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: CR_COLS, padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>ID</div><div>Change</div><div>Requirement</div><div>Impact</div><div>SDP change</div><div>Raised by</div><div>Status</div>
        </div>
        {changeRequests.length === 0 ? (
          <EmptyBlock message="No change requests raised yet." minHeight={110} />
        ) : changeRequests.map((c) => {
          const sc = CR_STATUS[c.status] ?? CR_STATUS.Pending;
          return (
            <div key={c.id} onClick={() => canEdit && setOpenCr(c)} style={{ display: "grid", gridTemplateColumns: CR_COLS, alignItems: "center", padding: "13px 22px", borderBottom: "1px solid #F2F4F9", cursor: canEdit ? "pointer" : "default" }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, color: color.faint3 }}>{c.code}</div>
              <div style={{ fontSize: 13, color: canEdit ? color.primary : color.text, fontWeight: 600 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: color.subtle, fontFamily: font.mono }}>{c.reqCode || "—"}</div>
              <div style={{ fontSize: 12, color: color.subtle }}>{c.impact}</div>
              <div style={{ fontSize: 12, color: color.subtle, fontFamily: font.mono }}>{c.sdp || "—"}</div>
              <div style={{ fontSize: 12, color: color.subtle }}>{c.raisedBy}</div>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 9px", borderRadius: 6 }}>{c.status}</span></div>
            </div>
          );
        })}
      </Card>

      {reqModal && <NewRequirementModal projectId={projectId} onClose={() => setReqModal(false)} />}
      {openId !== null && (() => {
        const r = requirements.find((x) => x.id === openId);
        if (!r) return null;
        return <RequirementModal projectId={projectId} req={r} canEdit={canEdit} onClose={() => setOpenId(null)} />;
      })()}
      {crFor !== null && <RaiseCrModal projectId={projectId} reqCodes={requirements.map((r) => r.code)} prefill={crFor} onClose={() => setCrFor(null)} />}
      {openCr && <EditCrModal projectId={projectId} cr={openCr} reqCodes={requirements.map((r) => r.code)} onClose={() => setOpenCr(null)} />}
    </div>
  );
}

function EditCrModal({ projectId, cr, reqCodes, onClose }: { projectId: string; cr: ChangeRequest; reqCodes: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(cr.title);
  const [reqCode, setReqCode] = useState(cr.reqCode);
  const [impact, setImpact] = useState(cr.impact);
  const [sdp, setSdp] = useState(cr.sdp);
  const [status, setStatus] = useState(cr.status);
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["requirements", projectId] });
  const save = useMutation({
    mutationFn: () => api(`/change-requests/${cr.id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim(), reqCode, impact, sdp: sdp.trim(), status }) }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/change-requests/${cr.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  return (
    <Modal onClose={onClose} width={480} label={`${cr.code} · Change request`}>
      <DecLabel>Change</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is changing?" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <DecLabel>Requirement</DecLabel>
          <Select value={reqCode} onChange={(e) => setReqCode(e.target.value)}>
            <option value="">—</option>
            {reqCodes.map((rc) => <option key={rc} value={rc}>{rc}</option>)}
            {reqCode && !reqCodes.includes(reqCode) && <option value={reqCode}>{reqCode}</option>}
          </Select>
        </div>
        <div style={{ flex: 1 }}><DecLabel>Impact</DecLabel><Select value={impact} onChange={(e) => setImpact(e.target.value)}>{CR_IMPACTS.map((i) => <option key={i}>{i}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{["Pending", "Approved", "Rejected"].map((s) => <option key={s}>{s}</option>)}</Select></div>
      </div>
      <DecLabel>SDP change (optional)</DecLabel>
      <Input value={sdp} onChange={(e) => setSdp(e.target.value)} placeholder="e.g. SDP-48213" />
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this CR?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}

function NewRequirementModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", type: REQ_TYPES[0], priority: "Medium", status: "Draft", epic: "", story: "", test: "", release: "", description: "" });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/requirements`, { method: "POST", body: JSON.stringify({ ...f, title: f.title.trim() }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["requirements", projectId] }); onClose(); },
  });
  return (
    <Modal onClose={onClose} width={520} label="New requirement">
      <DecLabel>Requirement</DecLabel>
      <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="What must the solution do?" style={{ marginBottom: 14 }} />
      <DecLabel>Description</DecLabel>
      <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Acceptance criteria, context, notes…" style={{ minHeight: 64, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Type</DecLabel><Select value={f.type} onChange={(e) => set("type", e.target.value)}>{REQ_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Priority</DecLabel><Select value={f.priority} onChange={(e) => set("priority", e.target.value)}>{REQ_PRIORITIES.map((t) => <option key={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{REQ_STATUSES.map((t) => <option key={t}>{t}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Epic</DecLabel><Input value={f.epic} onChange={(e) => set("epic", e.target.value)} placeholder="Epic" /></div>
        <div style={{ flex: 1 }}><DecLabel>Story</DecLabel><Input value={f.story} onChange={(e) => set("story", e.target.value)} placeholder="e.g. CHK-204" /></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Test</DecLabel><Input value={f.test} onChange={(e) => set("test", e.target.value)} placeholder="e.g. TC-118" /></div>
        <div style={{ flex: 1 }}><DecLabel>Release</DecLabel><Input value={f.release} onChange={(e) => set("release", e.target.value)} placeholder="e.g. R2.0 · Aug" /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => f.title.trim() && create.mutate()} disabled={create.isPending || !f.title.trim()}>{create.isPending ? "Adding…" : "Add requirement"}</Button>
      </div>
    </Modal>
  );
}

function RequirementModal({ projectId, req, canEdit, onClose }: { projectId: string; req: Requirement; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(req.title);
  const [description, setDescription] = useState(req.description);
  const [type, setType] = useState(req.type);
  const [priority, setPriority] = useState(req.priority);
  const [status, setStatus] = useState(req.status);
  const [epic, setEpic] = useState(req.epic);
  const [story, setStory] = useState(req.story);
  const [test, setTest] = useState(req.test === "—" ? "" : req.test);
  const [release, setRelease] = useState(req.release);
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["requirements", projectId] });

  const save = useMutation({
    mutationFn: () => api(`/requirements/${req.id}`, { method: "PATCH", body: JSON.stringify({
      title: title.trim(), description: description.trim(), type, priority, status,
      epic: epic.trim(), story: story.trim(), test: test.trim(), release: release.trim(),
    }) }),
    onSuccess: () => { invalidate(); toast("Requirement saved"); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/requirements/${req.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast("Requirement deleted"); onClose(); },
    onError: (e) => toastError(e),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => { const fd = new FormData(); fd.append("file", file); await apiUpload(`/requirements/${req.id}/attachments`, fd); },
    onSuccess: () => invalidate(),
    onError: (e) => toastError(e),
  });
  const removeAtt = useMutation({
    mutationFn: (attId: number) => api(`/requirement-attachments/${attId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
    onError: (e) => toastError(e),
  });

  return (
    <Modal onClose={onClose} width={560} label={`${req.code} · Requirement`}>
      <DecLabel>Requirement</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} placeholder="What must the solution do?" style={{ marginBottom: 14 }} />
      <DecLabel>Description</DecLabel>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} placeholder="Acceptance criteria, context, notes…" style={{ minHeight: 72, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Type</DecLabel><Select value={type} onChange={(e) => setType(e.target.value)} disabled={!canEdit}>{REQ_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Priority</DecLabel><Select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!canEdit}>{REQ_PRIORITIES.map((t) => <option key={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit}>{REQ_STATUSES.map((t) => <option key={t}>{t}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Epic</DecLabel><Input value={epic} onChange={(e) => setEpic(e.target.value)} disabled={!canEdit} placeholder="Epic" /></div>
        <div style={{ flex: 1 }}><DecLabel>Story</DecLabel><Input value={story} onChange={(e) => setStory(e.target.value)} disabled={!canEdit} placeholder="e.g. CHK-204" /></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Test</DecLabel><Input value={test} onChange={(e) => setTest(e.target.value)} disabled={!canEdit} placeholder="e.g. TC-118" /></div>
        <div style={{ flex: 1 }}><DecLabel>Release</DecLabel><Input value={release} onChange={(e) => setRelease(e.target.value)} disabled={!canEdit} placeholder="e.g. R2.0 · Aug" /></div>
      </div>

      {/* Attachments */}
      <div style={{ borderTop: `1px solid ${color.bg}`, marginTop: 18, paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: color.ink }}>Attachments</span>
          <div style={{ flex: 1 }} />
          {canEdit && (
            <>
              <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={upload.isPending}><Icon name="paperclip" size={15} /> {upload.isPending ? "Uploading…" : "Attach file"}</Button>
            </>
          )}
        </div>
        {req.attachments.length === 0 ? (
          <div style={{ fontSize: 12, color: color.faint3 }}>No attachments.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {req.attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", border: `1px solid ${color.border}`, borderRadius: 9 }}>
                <Icon name="paperclip" size={15} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.fileName}</div>
                  <div style={{ fontSize: 11, color: color.faint3 }}>{fmtSize(a.size)} · {a.uploadedAt}</div>
                </div>
                <button onClick={() => apiDownload(`/requirement-attachments/${a.id}`, a.fileName)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: color.primary, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Icon name="download" size={14} /> Download</button>
                {canEdit && <button onClick={() => removeAtt.mutate(a.id)} title="Remove attachment" style={{ display: "inline-flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "#A1282B" }}><Icon name="trash" size={14} /></button>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22 }}>
        {canEdit && (
          confirmDel ? (
            <>
              <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this requirement?</span>
              <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
              <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete requirement</button>
          )
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>{canEdit ? "Cancel" : "Close"}</Button>
        {canEdit && <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>}
      </div>
    </Modal>
  );
}

function RaiseCrModal({ projectId, reqCodes, prefill, onClose }: { projectId: string; reqCodes: string[]; prefill: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [reqCode, setReqCode] = useState(prefill || reqCodes[0] || "");
  const [impact, setImpact] = useState("Medium");
  const [sdp, setSdp] = useState("");
  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/change-requests`, { method: "POST", body: JSON.stringify({ title: title.trim(), reqCode, impact, sdp: sdp.trim() }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["requirements", projectId] }); onClose(); },
  });
  return (
    <Modal onClose={onClose} width={480} label="Raise change request">
      <DecLabel>Change</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is changing?" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <DecLabel>Requirement</DecLabel>
          <Select value={reqCode} onChange={(e) => setReqCode(e.target.value)}>
            <option value="">—</option>
            {reqCodes.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div style={{ flex: 1 }}><DecLabel>Impact</DecLabel><Select value={impact} onChange={(e) => setImpact(e.target.value)}>{CR_IMPACTS.map((i) => <option key={i}>{i}</option>)}</Select></div>
      </div>
      <DecLabel>SDP change (optional)</DecLabel>
      <Input value={sdp} onChange={(e) => setSdp(e.target.value)} placeholder="e.g. SDP-48213" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => title.trim() && create.mutate()} disabled={create.isPending || !title.trim()}>{create.isPending ? "Raising…" : "Raise CR"}</Button>
      </div>
    </Modal>
  );
}


// ---- Architecture (TOGAF ADM) ----------------------------------------------
