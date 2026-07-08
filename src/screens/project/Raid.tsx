// Extracted from Project.tsx — the RAID tab and its modal/types.
// No behaviour change; shared presentational helpers come from ./shared.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, Button, Modal, Input, Select, Textarea } from "@/components/ui";
import { toastError } from "@/components/Toast";
import { DecLabel } from "./shared";

interface RaidItem { id: number; type: string; title: string; owner: string; status: string; auto?: boolean; }
const RAID_TYPE_COLORS: Record<string, { ink: string; tint: string }> = {
  Risk:       { ink: "#8A6300", tint: "#FBF2D7" },
  Issue:      { ink: "#A1282B", tint: "#FBE7E8" },
  Assumption: { ink: "#0C5798", tint: "#E6EFFB" },
  Dependency: { ink: "#5E2E89", tint: "#F0E8F7" },
};
const RAID_STATUS: Record<string, { ink: string; tint: string; dot: string }> = {
  Open:       { ink: "#A1282B", tint: "#FBE7E8", dot: "#D13438" },
  Mitigating: { ink: "#8A6300", tint: "#FBF2D7", dot: "#E0A100" },
  Validating: { ink: "#8A6300", tint: "#FBF2D7", dot: "#E0A100" },
  "On track": { ink: "#0B6B37", tint: "#E7F4EC", dot: "#15A34A" },
  Resolved:   { ink: "#0B6B37", tint: "#E7F4EC", dot: "#15A34A" },
  Closed:     { ink: "#0B6B37", tint: "#E7F4EC", dot: "#15A34A" },
};
const raidStatus = (s: string) => RAID_STATUS[s] ?? { ink: "#56607A", tint: "#EEF1F6", dot: "#8A92A6" };
const RAID_TYPES = ["Risk", "Issue", "Assumption", "Dependency"];
const RAID_STATUSES = ["Open", "Mitigating", "Validating", "On track", "Resolved", "Closed"];

export function Raid({ projectId }: { projectId: string | null }) {
  const [modal, setModal] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data } = useQuery({
    queryKey: ["raid", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; items: RaidItem[] }> =>
      (await api<{ canEdit: boolean; items: RaidItem[] }>(`/projects/${projectId}/raid`)) ?? { canEdit: false, items: [] },
  });
  const items = data?.items ?? [];
  const canEdit = data?.canEdit ?? false;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its RAID register." /></Card>;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Risks, issues, assumptions &amp; dependencies for this project.</div>
        <div style={{ flex: 1 }} />
        {canEdit && <Button onClick={() => setModal(true)}><Icon name="plus" size={16} /> New item</Button>}
      </div>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.9fr 3fr 1fr 1fr", padding: "14px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Type</div><div>Item</div><div>Owner</div><div>Status</div>
        </div>
        {items.length === 0 ? (
          <EmptyBlock message="No RAID items logged yet." minHeight={140} />
        ) : items.map((r) => {
          const tc = RAID_TYPE_COLORS[r.type] ?? RAID_TYPE_COLORS.Risk;
          const sc = raidStatus(r.status);
          const clickable = canEdit && !r.auto;
          return (
            <div key={r.id} onClick={() => clickable && setOpenId(r.id)}
              style={{ display: "grid", gridTemplateColumns: "0.9fr 3fr 1fr 1fr", alignItems: "start", padding: "14px 22px", borderBottom: "1px solid #F2F4F9", cursor: clickable ? "pointer" : "default" }}>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: tc.ink, background: tc.tint, padding: "3px 10px", borderRadius: 6 }}>{r.type}</span></div>
              <div style={{ fontSize: 13.5, color: color.text, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {r.title}
                {r.auto && <span title="Auto-raised by Atlas from live project data — clears automatically when resolved" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, color: "#0C5798", background: "#E6EFFB", borderRadius: 5, padding: "1px 7px", letterSpacing: "0.03em" }}>✦ AUTO</span>}
              </div>
              <div style={{ fontSize: 13, color: color.subtle }}>{r.owner}</div>
              <div><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 10px", borderRadius: 20 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />{r.status}</span></div>
            </div>
          );
        })}
      </Card>
      {modal && <RaidModal projectId={projectId} onClose={() => setModal(false)} />}
      {openId !== null && (() => {
        const r = items.find((x) => x.id === openId);
        if (!r) return null;
        return <RaidModal projectId={projectId} item={r} onClose={() => setOpenId(null)} />;
      })()}
    </>
  );
}

function RaidModal({ projectId, item, onClose }: { projectId: string; item?: RaidItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState(item?.type ?? RAID_TYPES[0]);
  const [title, setTitle] = useState(item?.title ?? "");
  const [owner, setOwner] = useState(item && item.owner !== "—" ? item.owner : "");
  const [status, setStatus] = useState(item?.status ?? RAID_STATUSES[0]);
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["raid", projectId] });

  const body = () => JSON.stringify({ type, title: title.trim(), owner: owner.trim(), status });
  const save = useMutation({
    mutationFn: () => item
      ? api(`/raid/${item.id}`, { method: "PATCH", body: body() })
      : api(`/projects/${projectId}/raid`, { method: "POST", body: body() }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/raid/${item!.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });

  return (
    <Modal onClose={onClose} width={480} label={item ? "RAID item" : "New RAID item"}>
      {!item && <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Log a risk, issue, assumption or dependency against this project.</div>}
      <DecLabel>Type</DecLabel>
      <Select value={type} onChange={(e) => setType(e.target.value)} style={{ marginBottom: 14 }}>
        {RAID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </Select>
      <DecLabel>Item</DecLabel>
      <Textarea value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Describe the risk / issue / assumption / dependency" style={{ minHeight: 60, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <DecLabel>Owner</DecLabel>
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" />
        </div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {RAID_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {item && (
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
        <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : item ? "Save changes" : "Add item"}</Button>
      </div>
    </Modal>
  );
}
