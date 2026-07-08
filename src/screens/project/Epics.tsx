// Epics tab — epic cards with progress + dependency chips, and the create/edit
// epic modal (with its linked-tasks list). Extracted from Project.tsx unchanged
// (ADR-0041).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, Button, Modal, Input, Select } from "@/components/ui";
import { toastError } from "@/components/Toast";
import { DecLabel } from "./shared";
import { type Task } from "./taskModel";
import { SprintTaskRow } from "./TaskModals";

interface EpicRef { id: number; name: string; }
interface EpicItem { id: number; name: string; stories: number; done: number; pct: number; status: string; dependsOn: string; deps: EpicRef[]; }
const EPIC_STATUS: Record<string, { ink: string; tint: string; bar: string }> = {
  Complete:      { ink: "#0B6B37", tint: "#E7F4EC", bar: "#15A34A" },
  "In progress": { ink: "#0C5798", tint: "#E6EFFB", bar: "#0F6CBD" },
  Upcoming:      { ink: "#56607A", tint: "#EEF1F6", bar: "#8A93A6" },
  "At risk":     { ink: "#8A6300", tint: "#FBF2D7", bar: "#E0A100" },
};
const EPIC_STATUSES = ["Complete", "In progress", "Upcoming", "At risk"];

export function Epics({ projectId }: { projectId: string | null }) {
  const [modal, setModal] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data } = useQuery({
    queryKey: ["epics", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; epics: EpicItem[]; canCreate?: boolean }> =>
      (await api<{ canEdit: boolean; epics: EpicItem[]; canCreate?: boolean }>(`/projects/${projectId}/epics`)) ?? { canEdit: false, epics: [] },
  });
  const epics = data?.epics ?? [];
  const canEdit = data?.canEdit ?? false;
  const canCreate = data?.canCreate ?? false;

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its epics." /></Card>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Epics group the delivery stories for this project.</div>
        <div style={{ flex: 1 }} />
        <Button onClick={() => setModal(true)} disabled={!canCreate} title={canCreate ? undefined : "Your role can't create epics (needs the Project schedule right)"}><Icon name="plus" size={16} /> New epic</Button>
      </div>
      {epics.length === 0 ? (
        <Card><EmptyBlock minHeight={180} message="No epics yet." /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {epics.map((e) => {
            const sc = EPIC_STATUS[e.status] ?? EPIC_STATUS.Upcoming;
            const depLabel = e.deps.length > 0 ? `↳ after ${e.deps.map((d) => d.name).join(", ")}` : (e.dependsOn ? `↳ after ${e.dependsOn}` : "No dependencies");
            return (
              <button key={e.id} onClick={() => setOpenId(e.id)}
                style={{ textAlign: "left", background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 20, cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: color.text }}>{e.name}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: sc.ink, background: sc.tint, padding: "3px 10px", borderRadius: 20 }}>{e.status}</span>
                </div>
                <div style={{ height: 9, background: color.bg, borderRadius: 5, overflow: "hidden", marginBottom: 9 }}>
                  <div style={{ height: "100%", width: `${e.pct}%`, background: sc.bar, borderRadius: 5 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: color.faint }}>
                  <span>{e.done} of {e.stories} stories done</span>
                  <span style={{ fontFamily: font.head, fontWeight: 700, color: color.ink }}>{e.pct}%</span>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F2F4F9", display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "#7A6BB0" }}>
                  <Icon name="link" size={14} /><span>{depLabel}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {modal && <EpicModal projectId={projectId} epics={epics} onClose={() => setModal(false)} />}
      {openId !== null && (() => {
        const e = epics.find((x) => x.id === openId);
        if (!e) return null;
        return <EpicModal projectId={projectId} epic={e} epics={epics} canEdit={canEdit} onClose={() => setOpenId(null)} />;
      })()}
    </div>
  );
}

function EpicModal({ projectId, epic, epics, canEdit = true, onClose }: { projectId: string; epic?: EpicItem; epics: EpicItem[]; canEdit?: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(epic?.name ?? "");
  const [stories, setStories] = useState(String(epic?.stories ?? ""));
  const [done, setDone] = useState(String(epic?.done ?? ""));
  const [status, setStatus] = useState(epic?.status ?? "Upcoming");
  const [dependsOn, setDependsOn] = useState(epic?.dependsOn ?? "");
  const [depIds, setDepIds] = useState<number[]>(epic?.deps.map((d) => d.id) ?? []);
  const [confirmDel, setConfirmDel] = useState(false);
  const readOnly = !!epic && !canEdit;

  // An epic can depend on any other epic (not itself).
  const candidates = epics.filter((e) => e.id !== epic?.id);
  const toggleDep = (id: number) => setDepIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

  const body = () => JSON.stringify({
    name: name.trim(), stories: Number(stories) || 0, done: Number(done) || 0, status,
    dependsOn: dependsOn.trim(), dependsOnIds: depIds,
  });
  const save = useMutation({
    mutationFn: () => epic
      ? api(`/epics/${epic.id}`, { method: "PATCH", body: body() })
      : api(`/projects/${projectId}/epics`, { method: "POST", body: body() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epics", projectId] }); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/epics/${epic!.id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["epics", projectId] }); onClose(); },
    onError: (e) => toastError(e),
  });
  // Tasks referencing this epic (linked by name), shown when viewing an epic.
  const { data: taskData } = useQuery({
    queryKey: ["tasks", projectId], enabled: !!projectId && !!epic, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ tasks: Task[] }> => (await api<{ tasks: Task[] }>(`/projects/${projectId}/tasks`)) ?? { tasks: [] },
  });
  const epicTasks = (taskData?.tasks ?? []).filter((t) => epic && t.epic === epic.name);

  return (
    <Modal onClose={onClose} width={480} label={epic ? "Epic" : "New epic"}>
      {!epic && <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Group a set of delivery stories under an epic.</div>}
      <DecLabel>Epic name</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} placeholder="e.g. Checkout & Payments" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Stories</DecLabel><Input type="number" min={0} value={stories} onChange={(e) => setStories(e.target.value)} disabled={readOnly} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>Done</DecLabel><Input type="number" min={0} value={done} onChange={(e) => setDone(e.target.value)} disabled={readOnly} placeholder="0" /></div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={readOnly}>{EPIC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        </div>
      </div>
      <DecLabel>Depends on</DecLabel>
      {candidates.length === 0 ? (
        <div style={{ fontSize: 12, color: color.faint3, marginBottom: 12 }}>No other epics to depend on yet.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
          {candidates.map((c) => {
            const on = depIds.includes(c.id);
            return (
              <button key={c.id} type="button" disabled={readOnly} onClick={() => toggleDep(c.id)}
                style={{ fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: readOnly ? "default" : "pointer", padding: "5px 11px", borderRadius: 20, border: `1px solid ${on ? "#7A6BB0" : color.border}`, background: on ? "#F0E8F7" : "#fff", color: on ? "#5E2E89" : color.faint }}>
                {on ? "✓ " : ""}{c.name}
              </button>
            );
          })}
        </div>
      )}
      <DecLabel>Dependency note (optional)</DecLabel>
      <Input value={dependsOn} onChange={(e) => setDependsOn(e.target.value)} disabled={readOnly} placeholder="e.g. external vendor sign-off" />

      {epic && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${color.bg}` }}>
          <DecLabel>Tasks in this epic ({epicTasks.length})</DecLabel>
          {epicTasks.length === 0 ? (
            <div style={{ fontSize: 12, color: color.faint3 }}>No tasks reference this epic yet. Set a task's epic to “{epic.name}” to link it.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
              {epicTasks.map((t) => <SprintTaskRow key={t.id} t={t} />)}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22 }}>
        {epic && canEdit && (
          confirmDel ? (
            <>
              <span style={{ fontSize: 12, color: "#A1282B", fontWeight: 600 }}>Delete this epic?</span>
              <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: "#D13438" }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
              <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#A1282B", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete epic</button>
          )
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</Button>
        {!readOnly && <Button onClick={() => { if (name.trim()) save.mutate(); }} disabled={save.isPending || !name.trim()}>{save.isPending ? "Saving…" : epic ? "Save changes" : "Add epic"}</Button>}
      </div>
    </Modal>
  );
}
