// Task components shared by the Tasks / Backlog / Sprints / Epics tabs: the
// linked-name dropdown, the compact sprint/epic task row, the read-only Jira
// detail panel, and the new-/edit-task modals. Extracted from Project.tsx
// unchanged (ADR-0041).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api, apiDownload } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Modal, Input, Select } from "@/components/ui";
import { toast, toastError } from "@/components/Toast";
import { ChipRow, KV, SectionTitle, DecLabel } from "./shared";
import { type CommentItem, fmtCommentTime } from "./util";
import { type Task, type TaskAttachment, BOARD_COLS, TASK_PRIORITIES, TASK_STATUSES, TASK_SIZES, fmtBytes } from "./taskModel";

// A dropdown over known names that still accepts a legacy/free value (kept as an
// extra option) and offers a blank. Used for task → epic / sprint linking.
export function LinkSelect({ value, options, placeholder, disabled, onChange }: { value: string; options: string[]; placeholder: string; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
    </Select>
  );
}

// One task line — code, name, completion tick and a status pill. Shared by the
// Sprints cards and the Epic detail modal so both read the same way.
export function SprintTaskRow({ t }: { t: Task }) {
  const col = BOARD_COLS.find((c) => c.label === t.status) ?? BOARD_COLS[0];
  const done = t.status === "Done";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, background: color.bg }}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", background: done ? "#15A34A" : "transparent", border: done ? "none" : `2px solid ${col.color}` }}>
        {done && <Icon name="check" size={11} color="#fff" />}
      </span>
      <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3, flex: "none" }}>{t.code}</span>
      <span style={{ fontSize: 12.5, color: color.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: done ? "line-through" : "none" }}>{t.name}</span>
      {t.assignee && t.assignee !== "Unassigned" && <span style={{ fontSize: 11, color: color.faint2, flex: "none" }}>{t.assignee}</span>}
      <span style={{ fontSize: 10, fontWeight: 700, color: col.ink, background: col.tint, padding: "2px 8px", borderRadius: 20, flex: "none" }}>{t.status}</span>
    </div>
  );
}

// Read-only detail carried across from Jira — shown only for synced tasks. The
// editable fields above stay authoritative; this surfaces everything the sync
// imports that Atlas doesn't otherwise edit (description, people, labels,
// components, versions, resolution, time, timestamps) plus the file list.
export function JiraTaskPanel({ task }: { task: Task }) {
  const { data: attachments } = useQuery({
    queryKey: ["task-attachments", task.id], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<TaskAttachment[]> => (await api<TaskAttachment[]>(`/tasks/${task.id}/attachments`)) ?? [],
  });
  if (!task.jiraKey) return null;
  return (
    <div style={{ borderTop: `1px solid ${color.bg}`, marginTop: 20, paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <SectionTitle>Jira details</SectionTitle>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: color.primary, background: color.primaryTint, borderRadius: 6, padding: "2px 8px" }}>SYNCED · {task.jiraKey}</span>
        <div style={{ flex: 1 }} />
        {task.jiraUrl && (
          <a href={task.jiraUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: color.primary, textDecoration: "none" }}>
            <Icon name="externalLink" size={14} /> View in Jira
          </a>
        )}
      </div>

      {task.description && (
        <div style={{ fontSize: 12.5, color: color.subtle, whiteSpace: "pre-wrap", background: color.surfaceAlt, border: `1px solid ${color.border2}`, borderRadius: 9, padding: "10px 12px", marginBottom: 12, maxHeight: 220, overflow: "auto" }}>{task.description}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {task.issueType && <KV label="Type">{task.issueType}</KV>}
        {task.statusName && <KV label="Jira status">{task.statusName}</KV>}
        {task.reporter && <KV label="Reporter">{task.reporter}</KV>}
        {task.resolution && <KV label="Resolution">{task.resolution}</KV>}
        {task.parentKey && <KV label="Parent">{task.parentKey}</KV>}
        {!!task.timeSpentHours && <KV label="Time spent">{task.timeSpentHours}h logged</KV>}
        <ChipRow label="Labels" items={task.labels} />
        <ChipRow label="Components" items={task.components} />
        <ChipRow label="Fix versions" items={task.fixVersions} />
        {(task.jiraCreated || task.jiraUpdated) && (
          <KV label="Jira dates">
            <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint }}>
              {task.jiraCreated ? `created ${task.jiraCreated.slice(0, 10)}` : ""}{task.jiraUpdated ? ` · updated ${task.jiraUpdated.slice(0, 10)}` : ""}
            </span>
          </KV>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: color.faint2, marginBottom: 6 }}>Attachments ({attachments?.length ?? 0})</div>
        {attachments && attachments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${color.border2}`, borderRadius: 8, padding: "7px 10px" }}>
                <Icon name="paperclip" size={15} color={color.faint2} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: color.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fileName}</div>
                  <div style={{ fontSize: 10.5, color: color.faint3, fontFamily: font.mono }}>{fmtBytes(a.size)}{a.author ? ` · ${a.author}` : ""}</div>
                </div>
                <button onClick={() => apiDownload(`/task-attachments/${a.id}`, a.fileName)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: color.primary, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Icon name="download" size={14} /> Download</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: color.faint3 }}>No files attached in Jira.</div>
        )}
      </div>
    </div>
  );
}

export function TaskDetailModal({ projectId, task, canEdit, assigneeOptions, epicOptions, sprintOptions, onClose }: { projectId: string; task: Task; canEdit: boolean; assigneeOptions: string[]; epicOptions: string[]; sprintOptions: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(task.name);
  const [epic, setEpic] = useState(task.epic);
  const [assignee, setAssignee] = useState(task.assignee);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [sprint, setSprint] = useState(task.sprint);
  const [startDate, setStartDate] = useState(task.startDate);
  const [targetDate, setTargetDate] = useState(task.targetDate);
  const [points, setPoints] = useState(String(task.points || ""));
  const [size, setSize] = useState(task.size);
  const [estimate, setEstimate] = useState(String(task.estimateHours || ""));
  const [confirmDel, setConfirmDel] = useState(false);
  const [text, setText] = useState("");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    qc.invalidateQueries({ queryKey: ["spillover", projectId] });
    qc.invalidateQueries({ queryKey: ["raid", projectId] });
    qc.invalidateQueries({ queryKey: ["spillover-summary"] });
  };

  const save = useMutation({
    mutationFn: () => api(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({
      name: name.trim(), epic: epic.trim(), assignee: assignee.trim(), status, priority,
      sprint: sprint.trim(), startDate: startDate.trim(), targetDate: targetDate.trim(),
      points: Number(points) || 0, size, estimateHours: Number(estimate) || 0,
    }) }),
    onSuccess: () => { invalidateAll(); toast("Task saved"); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/tasks/${task.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidateAll(); toast("Task deleted"); onClose(); },
    onError: (e) => toastError(e),
  });

  const { data: cData } = useQuery({
    queryKey: ["task-comments", task.id], retry: false, staleTime: 15_000,
    queryFn: async (): Promise<{ canPost: boolean; comments: CommentItem[] }> =>
      (await api<{ canPost: boolean; comments: CommentItem[] }>(`/tasks/${task.id}/comments`)) ?? { canPost: false, comments: [] },
  });
  const comments = cData?.comments ?? [];
  const canPost = cData?.canPost ?? false;
  const post = useMutation({
    mutationFn: (body: string) => api(`/tasks/${task.id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["task-comments", task.id] }); },
  });

  const onLeave = task.assigneeOnLeave;

  return (
    <Modal onClose={onClose} width={620} label={`${task.code} · Task`}>
      {onLeave && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: color.dangerInk, background: color.dangerTint, border: `1px solid ${color.dangerBorder}`, borderRadius: 9, padding: "9px 12px", marginBottom: 16 }}>
          <Icon name="alert" size={15} /> {task.assignee} is on leave during this task's scheduled window ({startDate || "—"} → {targetDate || startDate || "—"}).
        </div>
      )}
      <DecLabel>Task</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} placeholder="What needs doing?" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Epic</DecLabel><LinkSelect value={epic} options={epicOptions} placeholder="No epic" disabled={!canEdit} onChange={setEpic} /></div>
        <div style={{ flex: 1 }}>
          <DecLabel>Assignee</DecLabel>
          {assigneeOptions.length > 0 ? (
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={!canEdit}>
              <option value="">Unassigned</option>
              {assigneeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              {assignee && !assigneeOptions.includes(assignee) && <option value={assignee}>{assignee}</option>}
            </Select>
          ) : (
            <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={!canEdit} placeholder="Assignee" />
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit}>{TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Priority</DecLabel><Select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={!canEdit}>{TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Sprint</DecLabel><LinkSelect value={sprint} options={sprintOptions} placeholder="Backlog (no sprint)" disabled={!canEdit} onChange={setSprint} /></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Start date</DecLabel><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canEdit} /></div>
        <div style={{ flex: 1 }}><DecLabel>Target date</DecLabel><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} disabled={!canEdit} /></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
        <div style={{ flex: 1 }}><DecLabel>Story points</DecLabel><Input type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} disabled={!canEdit} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>T-shirt size</DecLabel><Select value={size} onChange={(e) => setSize(e.target.value)} disabled={!canEdit}><option value="">—</option>{TASK_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Estimate (h)</DecLabel><Input type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} disabled={!canEdit} placeholder="0" /></div>
      </div>

      {/* Jira-sourced detail (read-only) — only for synced tasks */}
      <JiraTaskPanel task={task} />

      {/* Comments */}
      <div style={{ borderTop: `1px solid ${color.bg}`, marginTop: 20, paddingTop: 16 }}>
        <SectionTitle>Comments</SectionTitle>
        {comments.length === 0 ? (
          <div style={{ fontSize: 12.5, color: color.faint3, padding: "8px 0" }}>No comments yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "12px 0 4px" }}>
            {comments.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", flex: "none", background: "linear-gradient(135deg,#0F6CBD,#1E2C7C)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 }}>{c.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: color.text }}>{c.author}</span>
                    <span style={{ fontSize: 10.5, color: color.faint3, fontFamily: font.mono }}>{fmtCommentTime(c.at)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: color.subtle, whiteSpace: "pre-wrap", marginTop: 2 }}>{c.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder={canPost ? "Write a comment…" : "Your role can't post comments (needs Edit on “Projects & tasks”)"}
            disabled={!canPost || post.isPending}
            style={{ flex: 1, minHeight: 40, resize: "vertical", border: `1px solid ${color.border2}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5, fontFamily: "inherit", color: color.text, outline: "none" }}
          />
          <Button style={{ alignSelf: "flex-end" }} disabled={!canPost || post.isPending || !text.trim()} onClick={() => post.mutate(text.trim())}>{post.isPending ? "Posting…" : "Comment"}</Button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22 }}>
        {canEdit && (
          confirmDel ? (
            <>
              <span style={{ fontSize: 12, color: color.dangerInk, fontWeight: 600 }}>Delete this task?</span>
              <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: color.danger }}>{del.isPending ? "Deleting…" : "Confirm delete"}</Button>
              <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.dangerInk, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete task</button>
          )
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {canEdit && <Button onClick={() => { if (name.trim()) save.mutate(); }} disabled={save.isPending || !name.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>}
      </div>
    </Modal>
  );
}

export function NewTaskModal({ projectId, assigneeOptions, epicOptions, sprintOptions, defaultSprint, onClose }: { projectId: string; assigneeOptions: string[]; epicOptions: string[]; sprintOptions: string[]; defaultSprint?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [epic, setEpic] = useState("");
  const [assignee, setAssignee] = useState("");
  const [sprint, setSprint] = useState(defaultSprint ?? "");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("To Do");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [points, setPoints] = useState("");
  const [size, setSize] = useState("");
  const [estimate, setEstimate] = useState("");

  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify({
      name: name.trim(), epic: epic.trim(), assignee: assignee.trim(), sprint: sprint.trim(),
      baseline: sprint.trim(), priority, status, startDate: startDate.trim(), targetDate: targetDate.trim(),
      points: Number(points) || 0, size, estimateHours: Number(estimate) || 0,
    }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks", projectId] }); onClose(); },
  });
  const submit = () => { if (name.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={520} label="New task">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Add a task to this project's board.</div>
      <DecLabel>Task</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="What needs doing?" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Epic</DecLabel><LinkSelect value={epic} options={epicOptions} placeholder="No epic" onChange={setEpic} /></div>
        <div style={{ flex: 1 }}>
          <DecLabel>Assignee</DecLabel>
          {assigneeOptions.length > 0 ? (
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {assigneeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          ) : (
            <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Assignee" />
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Sprint</DecLabel><LinkSelect value={sprint} options={sprintOptions} placeholder="Backlog (no sprint)" onChange={setSprint} /></div>
        <div style={{ flex: 1 }}>
          <DecLabel>Priority</DecLabel>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>{TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
        </div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>{BOARD_COLS.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}</Select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Start date</DecLabel><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div style={{ flex: 1 }}><DecLabel>Target date</DecLabel><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><DecLabel>Story points</DecLabel><Input type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} placeholder="0" /></div>
        <div style={{ flex: 1 }}><DecLabel>T-shirt size</DecLabel><Select value={size} onChange={(e) => setSize(e.target.value)}><option value="">—</option>{TASK_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Estimate (h)</DecLabel><Input type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="0" /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !name.trim()}>{create.isPending ? "Adding…" : "Add task"}</Button>
      </div>
    </Modal>
  );
}
