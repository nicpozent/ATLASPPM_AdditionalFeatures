// Extracted from Project.tsx — the Artifacts tab and its modals/types.
// No behaviour change; shared presentational helpers come from ./shared.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api, apiUpload, apiDownload } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, Button, Modal, Input, Select } from "@/components/ui";
import { DecLabel } from "./shared";
import { fmtSize } from "./util";

// ---- Artifacts -------------------------------------------------------------
interface ArtifactVersion { id: number; version: number; fileName: string; size: number; uploadedAt: string; }
interface ArtifactItem { id: number; name: string; type: string; owner: string; status: string; versions: ArtifactVersion[]; }
const ARTIFACT_TYPES = ["Governance", "Waterfall", "Agile", "Design", "Test", "Other"];
const ARTIFACT_STATUSES = ["Draft", "In review", "Approved", "Living"];
const ARTIFACT_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved:    { ink: color.successInk, tint: color.successTint },
  "In review": { ink: color.warningInk, tint: color.warningTint },
  Living:      { ink: color.primaryDark, tint: color.primaryTint2 },
  Draft:       { ink: color.subtle, tint: color.bg },
};

export function Artifacts({ projectId }: { projectId: string | null }) {
  const [modal, setModal] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data } = useQuery({
    queryKey: ["artifacts", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; artifacts: ArtifactItem[] }> =>
      (await api<{ canEdit: boolean; artifacts: ArtifactItem[] }>(`/projects/${projectId}/artifacts`)) ?? { canEdit: false, artifacts: [] },
  });
  const artifacts = data?.artifacts ?? [];
  const canEdit = data?.canEdit ?? false;
  const open = artifacts.find((a) => a.id === openId) ?? null;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its artifacts." /></Card>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Waterfall &amp; agile artifacts — each carries its own file versions.</div>
        <div style={{ flex: 1 }} />
        <Button onClick={() => setModal(true)} disabled={!canEdit} title={canEdit ? undefined : "Your role can't add artifacts (needs Edit on “Comments & artifacts”)"}><Icon name="plus" size={16} /> New artifact</Button>
      </div>
      <Card padding={0} style={{ overflow: "hidden" }}>
        {artifacts.length === 0 ? (
          <EmptyBlock message="No artifacts yet." minHeight={140} />
        ) : artifacts.map((a) => {
          const sc = ARTIFACT_STATUS[a.status] ?? ARTIFACT_STATUS.Draft;
          return (
            <div key={a.id} onClick={() => setOpenId(a.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, cursor: "pointer" }}>
              <span style={{ color: color.primary, display: "flex" }}><Icon name="sheet" size={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: color.text }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: color.faint3 }}>{a.type} · Owner {a.owner}</div>
              </div>
              <span style={{ fontSize: 12, color: color.faint }}>{a.versions.length ? `${a.versions.length} version${a.versions.length > 1 ? "s" : ""}` : "No file yet"}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 11px", borderRadius: 20 }}>{a.status}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: color.primary }}><Icon name="externalLink" size={15} /> Open</span>
            </div>
          );
        })}
      </Card>
      {modal && <NewArtifactModal projectId={projectId} onClose={() => setModal(false)} />}
      {open && <ArtifactWindow projectId={projectId} artifact={open} canEdit={canEdit} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function NewArtifactModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState(ARTIFACT_TYPES[0]);
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("Draft");
  const [file, setFile] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const art = await api<{ id: number }>(`/projects/${projectId}/artifacts`, { method: "POST", body: JSON.stringify({ name: name.trim(), type, owner: owner.trim(), status }) });
      if (art?.id && file) { const fd = new FormData(); fd.append("file", file); await apiUpload(`/artifacts/${art.id}/versions`, fd); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["artifacts", projectId] }); onClose(); },
  });
  const submit = () => { if (name.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={480} label="New artifact">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Register a document; attach its first file version now or later.</div>
      <DecLabel>Name</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Solution Architecture (SAD)" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Type</DecLabel><Select value={type} onChange={(e) => setType(e.target.value)}>{ARTIFACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{ARTIFACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <DecLabel>Owner</DecLabel>
      <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Document owner" style={{ marginBottom: 14 }} />
      <DecLabel>First version (optional)</DecLabel>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5, color: color.subtle }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !name.trim()}>{create.isPending ? "Saving…" : "Create artifact"}</Button>
      </div>
    </Modal>
  );
}

function ArtifactWindow({ projectId, artifact, canEdit, onClose }: { projectId: string; artifact: ArtifactItem; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const sc = ARTIFACT_STATUS[artifact.status] ?? ARTIFACT_STATUS.Draft;
  const upload = useMutation({
    mutationFn: async (file: File) => { const fd = new FormData(); fd.append("file", file); await apiUpload(`/artifacts/${artifact.id}/versions`, fd); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["artifacts", projectId] }),
  });
  const changeStatus = useMutation({
    mutationFn: (status: string) => api(`/artifacts/${artifact.id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["artifacts", projectId] }),
  });

  return (
    <Modal onClose={onClose} width={560} label={artifact.name}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: color.faint3 }}>{artifact.type} · Owner {artifact.owner}</span>
        <span style={{ flex: 1 }} />
        {canEdit ? (
          <Select
            value={artifact.status}
            disabled={changeStatus.isPending}
            onChange={(e) => changeStatus.mutate(e.target.value)}
            style={{ width: "auto", fontSize: 12, fontWeight: 600, color: sc.ink, background: sc.tint, borderColor: "transparent", padding: "4px 8px" }}
          >
            {ARTIFACT_STATUSES.map((s) => <option key={s} value={s} style={{ color: color.ink, background: color.surface }}>{s}</option>)}
          </Select>
        ) : (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 11px", borderRadius: 20 }}>{artifact.status}</span>
        )}
      </div>
      <div style={{ fontFamily: font.head, fontSize: 14, fontWeight: 600, color: color.ink, margin: "18px 0 10px" }}>Versions</div>
      {artifact.versions.length === 0 ? (
        <div style={{ fontSize: 12.5, color: color.faint3, padding: "14px 0" }}>No file versions uploaded yet.</div>
      ) : (
        <div style={{ border: `1px solid ${color.border}`, borderRadius: 12, overflow: "hidden" }}>
          {artifact.versions.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
              <span style={{ fontFamily: font.mono, fontSize: 11.5, fontWeight: 700, color: color.primary, background: color.primaryTint, padding: "2px 8px", borderRadius: 6 }}>v{v.version}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: color.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.fileName}</div>
                <div style={{ fontSize: 11, color: color.faint3 }}>{fmtSize(v.size)} · {v.uploadedAt}</div>
              </div>
              <button onClick={() => apiDownload(`/artifact-versions/${v.id}`, v.fileName)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: color.primary, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Icon name="download" size={15} /> Download</button>
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <label style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 14, fontSize: 12.5, fontWeight: 600, color: color.primary, background: color.primaryTint, border: `1px solid ${color.border}`, borderRadius: 8, padding: "8px 13px", cursor: upload.isPending ? "default" : "pointer" }}>
          <Icon name="paperclip" size={15} /> {upload.isPending ? "Uploading…" : "Upload new version"}
          <input type="file" style={{ display: "none" }} disabled={upload.isPending} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
        </label>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
