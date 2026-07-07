import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font, radius } from "@/theme";
import { api } from "@/api";
import { Card, EmptyBlock, Button, Input, Textarea, Select, Modal, RowMenu, MenuItem } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { Icon } from "@/components/Icon";
import { toast, toastError } from "@/components/Toast";
import { yearOf, yearColumns } from "@/lib/roadmap";

// ============================================================================
//  Roadmap — strategic initiatives on the Now / Next / Later horizons, with a
//  toggle to a time-based timeline of the same items. Each initiative carries
//  confidence / effort / value, milestones, dependencies on other initiatives,
//  and links to portfolio entities (OKRs, projects, programs, products,
//  releases). Data-driven with tasteful empty states; edits gated on the
//  "Roadmap" capability (cap-roadmap). Reading is open.
// ============================================================================

interface Milestone { id: number; title: string; date: string; done: boolean; }
interface Link { entityType: string; entityId: string; label: string; }
interface Item {
  id: number; ref: string; title: string; description: string; lane: string;
  status: string; theme: string; owner: string; startDate: string; endDate: string;
  confidence: number; effort: number; value: number; plannedYear: number;
  milestones: Milestone[]; links: Link[]; dependsOn: number[]; blocks: number[];
}
interface LinkOption { entityType: string; entityId: string; label: string; }
interface Board { canEdit: boolean; items: Item[]; themes: string[]; linkOptions: LinkOption[]; }

const LANES = ["Now", "Next", "Later"] as const;
// Year choices for the planned-year selector: last year through +5.
const YEAR_OPTIONS = (() => { const y = new Date().getFullYear(); return Array.from({ length: 7 }, (_, i) => y - 1 + i); })();
const LANE_ACCENT: Record<string, string> = { Now: color.success, Next: color.primary, Later: color.accent };
const STATUSES = ["Proposed", "Committed", "In progress", "Done", "Cancelled"];
const LINK_TYPES = ["okr", "project", "program", "product", "release"] as const;
const LINK_LABEL: Record<string, string> = { okr: "OKR", project: "Project", program: "Program", product: "Product", release: "Release" };

const STATUS_TINT: Record<string, { ink: string; bg: string }> = {
  Proposed: { ink: color.subtle, bg: color.bg },
  Committed: { ink: "#0C5798", bg: "#E6EFFB" },
  "In progress": { ink: "#7A3FB0", bg: color.accentTint },
  Done: { ink: "#0B6B37", bg: "#E7F4EC" },
  Cancelled: { ink: color.faint2, bg: color.bg },
};

function StatusPill({ value }: { value: string }) {
  const t = STATUS_TINT[value] ?? { ink: color.subtle, bg: color.bg };
  return <span style={{ fontSize: 11, fontWeight: 600, color: t.ink, background: t.bg, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{value}</span>;
}

function confColor(c: number) { return c >= 67 ? color.success : c >= 34 ? color.warning : color.danger; }

// ---- month math for the timeline ------------------------------------------
function monthKey(d: Date) { return d.getFullYear() * 12 + d.getMonth(); }
function monthLabel(k: number) {
  const y = Math.floor(k / 12), m = k % 12;
  return { m: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m], y };
}
function parseD(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export default function Roadmap() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const mayEdit = can("cap-roadmap", "E");
  const [view, setView] = useState<"board" | "year" | "timeline">("board");
  const [theme, setTheme] = useState("all");
  const [status, setStatus] = useState("all");
  const [newItem, setNewItem] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ["roadmap"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<Board> =>
      (await api<Board>("/roadmap")) ?? { canEdit: false, items: [], themes: [], linkOptions: [] },
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const filtered = items.filter((i) =>
    (theme === "all" || i.theme === theme) && (status === "all" || i.status === status));
  const titleOf = useMemo(() => new Map(items.map((i) => [i.id, i.title])), [items]);

  const move = useMutation({
    mutationFn: ({ id, lane }: { id: number; lane: string }) =>
      api(`/roadmap/${id}`, { method: "PATCH", body: JSON.stringify({ lane }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roadmap"] }),
    onError: (e) => toastError(e),
  });
  const setYear = useMutation({
    mutationFn: ({ id, plannedYear }: { id: number; plannedYear: number }) =>
      api(`/roadmap/${id}`, { method: "PATCH", body: JSON.stringify({ plannedYear }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roadmap"] }),
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/roadmap/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roadmap"] }); toast("Initiative removed"); },
    onError: (e) => toastError(e),
  });

  const onDrop = (lane: string) => {
    if (dragId == null) return;
    const it = items.find((i) => i.id === dragId);
    setDragId(null);
    if (it && it.lane !== lane && mayEdit) move.mutate({ id: dragId, lane });
  };
  // Effective year + year columns for the "By year" view (see src/lib/roadmap).
  const onDropYear = (year: number) => {
    if (dragId == null) return;
    const it = items.find((i) => i.id === dragId);
    setDragId(null);
    if (it && yearOf(it) !== year && mayEdit) setYear.mutate({ id: dragId, plannedYear: year });
  };
  const thisYear = new Date().getFullYear();
  const years = yearColumns(filtered, thisYear);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: color.surface, border: `1px solid ${color.border2}`, borderRadius: radius.md, padding: 3 }}>
          {(["board", "year", "timeline"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
                border: "none", borderRadius: radius.sm, padding: "6px 12px", cursor: "pointer",
                background: view === v ? color.primary : "transparent", color: view === v ? "#fff" : color.textMuted,
              }}>
              <Icon name={v === "board" ? "grid" : v === "year" ? "calendar" : "gantt"} size={14} /> {v === "board" ? "Now / Next / Later" : v === "year" ? "By year" : "Timeline"}
            </button>
          ))}
        </div>
        <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Filter by theme" style={selectStyle}>
          <option value="all">All themes</option>
          {(data?.themes ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" style={selectStyle}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <Button onClick={() => setNewItem(true)} disabled={!mayEdit} title={mayEdit ? undefined : "Your role can't edit the roadmap"}>
          <Icon name="plus" size={16} /> New initiative
        </Button>
      </div>

      {items.length === 0 ? (
        <Card><EmptyBlock message="No roadmap initiatives yet. Add one to plan strategic work across the Now / Next / Later horizons — set dates to see it on the timeline, and link it to OKRs, projects, programs, products or releases." minHeight={150} /></Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyBlock message="No initiatives match these filters." minHeight={120} /></Card>
      ) : view === "board" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
          {LANES.map((lane) => {
            const laneItems = filtered.filter((i) => i.lane === lane);
            return (
              <div key={lane}
                onDragOver={(e) => { if (dragId != null) e.preventDefault(); }}
                onDrop={() => onDrop(lane)}
                style={{ background: color.surfaceAlt, border: `1px solid ${color.border2}`, borderRadius: radius.lg, padding: 12, minHeight: 120 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 4px 12px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: LANE_ACCENT[lane] }} />
                  <span style={{ fontFamily: font.head, fontSize: 14, fontWeight: 700, color: color.ink }}>{lane}</span>
                  <span style={{ fontSize: 11.5, color: color.faint2, fontWeight: 600 }}>{laneItems.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {laneItems.length === 0
                    ? <div style={{ fontSize: 12, color: color.faint3, padding: "6px 4px 10px" }}>Nothing here yet.</div>
                    : laneItems.map((i) => (
                      <ItemCard key={i.id} item={i} mayEdit={mayEdit} titleOf={titleOf}
                        onEdit={() => setEditItem(i)} onDelete={() => del.mutate(i.id)}
                        draggable={mayEdit} onDragStart={() => setDragId(i.id)} onDragEnd={() => setDragId(null)} />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "year" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
          {[...years, 0].map((year) => {
            const yearItems = filtered.filter((i) => yearOf(i) === year);
            const label = year === 0 ? "Unscheduled" : String(year);
            return (
              <div key={year}
                onDragOver={(e) => { if (dragId != null) e.preventDefault(); }}
                onDrop={() => onDropYear(year)}
                style={{ background: color.surfaceAlt, border: `1px solid ${color.border2}`, borderRadius: radius.lg, padding: 12, minHeight: 120 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 4px 12px" }}>
                  <Icon name="calendar" size={14} color={year === thisYear ? color.primary : color.faint2} />
                  <span style={{ fontFamily: font.head, fontSize: 14, fontWeight: 700, color: year === 0 ? color.faint2 : color.ink }}>{label}</span>
                  {year === thisYear && <span style={{ fontSize: 9.5, fontWeight: 700, color: color.primary, background: color.primaryTint, borderRadius: 5, padding: "1px 6px" }}>THIS YEAR</span>}
                  <span style={{ fontSize: 11.5, color: color.faint2, fontWeight: 600 }}>{yearItems.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {yearItems.length === 0
                    ? <div style={{ fontSize: 12, color: color.faint3, padding: "6px 4px 10px" }}>{year === 0 ? "Everything is scheduled." : "Nothing planned for this year yet."}</div>
                    : yearItems.map((i) => (
                      <ItemCard key={i.id} item={i} mayEdit={mayEdit} titleOf={titleOf}
                        onEdit={() => setEditItem(i)} onDelete={() => del.mutate(i.id)}
                        draggable={mayEdit} onDragStart={() => setDragId(i.id)} onDragEnd={() => setDragId(null)} />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Timeline items={filtered} onEdit={(i) => mayEdit && setEditItem(i)} />
      )}

      {newItem && <ItemModal board={data!} onClose={() => setNewItem(false)} />}
      {editItem && <ItemModal board={data!} item={editItem} onClose={() => setEditItem(null)} />}
    </div>
  );
}

function ItemCard({ item, mayEdit, titleOf, onEdit, onDelete, draggable, onDragStart, onDragEnd }: {
  item: Item; mayEdit: boolean; titleOf: Map<number, string>;
  onEdit: () => void; onDelete: () => void; draggable: boolean; onDragStart: () => void; onDragEnd: () => void;
}) {
  const range = item.startDate || item.endDate
    ? `${item.startDate || "?"} → ${item.endDate || "?"}` : "";
  return (
    <div draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}
      style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: "12px 13px", cursor: draggable ? "grab" : "default" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3 }}>{item.ref}</span>
            <StatusPill value={item.status} />
          </div>
          <button onClick={onEdit} disabled={!mayEdit}
            style={{ display: "block", textAlign: "left", background: "none", border: "none", padding: 0, marginTop: 5, cursor: mayEdit ? "pointer" : "default", fontFamily: "inherit" }}>
            <span style={{ fontFamily: font.head, fontSize: 14, fontWeight: 700, color: color.ink, lineHeight: 1.25 }}>{item.title}</span>
          </button>
        </div>
        {mayEdit && (
          <RowMenu>
            {(close) => (
              <>
                <MenuItem label="Edit initiative" icon="edit" onClick={() => { close(); onEdit(); }} />
                <MenuItem label="Delete initiative" icon="trash" danger onClick={() => { close(); onDelete(); }} />
              </>
            )}
          </RowMenu>
        )}
      </div>

      {item.theme && (
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: color.textMuted, background: color.bg, borderRadius: 5, padding: "2px 7px" }}>{item.theme}</span>
        </div>
      )}

      {/* Confidence + value/effort */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: color.faint2, marginBottom: 3 }}>
            <span>Confidence</span><span style={{ fontWeight: 700, color: confColor(item.confidence) }}>{item.confidence}%</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: color.bg, overflow: "hidden" }}>
            <div style={{ width: `${item.confidence}%`, height: "100%", background: confColor(item.confidence) }} />
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: color.faint2, whiteSpace: "nowrap" }}>
          <span title="Strategic value">V{item.value}</span> · <span title="Effort">E{item.effort}</span>
        </div>
      </div>

      {/* Meta chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap", fontSize: 11, color: color.faint2 }}>
        {item.owner && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="users" size={12} /> {item.owner}</span>}
        {(item.startDate || item.endDate) && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="calendar" size={12} /> {range}</span>}
        {item.milestones.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="flag" size={12} /> {item.milestones.filter((m) => m.done).length}/{item.milestones.length}</span>}
        {item.links.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="link" size={12} /> {item.links.length}</span>}
        {item.dependsOn.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={item.dependsOn.map((d) => titleOf.get(d) ?? `#${d}`).join(", ")}><Icon name="gitBranch" size={12} /> {item.dependsOn.length}</span>}
      </div>
    </div>
  );
}

// ---- Timeline view ---------------------------------------------------------
function Timeline({ items, onEdit }: { items: Item[]; onEdit: (i: Item) => void }) {
  const dated = items.filter((i) => parseD(i.startDate) || parseD(i.endDate));
  const undated = items.filter((i) => !parseD(i.startDate) && !parseD(i.endDate));

  const bounds = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const i of dated) {
      const s = parseD(i.startDate) ?? parseD(i.endDate)!;
      const e = parseD(i.endDate) ?? parseD(i.startDate)!;
      min = Math.min(min, monthKey(s)); max = Math.max(max, monthKey(e));
    }
    if (!isFinite(min)) return null;
    return { min, max, count: max - min + 1 };
  }, [dated]);

  const COL = 74, LABEL = 220, ROW = 40;

  if (!bounds) {
    return (
      <Card>
        <EmptyBlock message="No dated initiatives to place on the timeline. Add start/end dates to an initiative to see it here — undated ones still live on the Now / Next / Later board." minHeight={130} />
      </Card>
    );
  }

  const months = Array.from({ length: bounds.count }, (_, k) => bounds.min + k);
  const gridW = LABEL + bounds.count * COL;

  // Group dated items by theme swimlane.
  const groups = new Map<string, Item[]>();
  for (const i of dated) {
    const key = i.theme || "No theme";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(i);
  }

  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: gridW }}>
          {/* Month header */}
          <div style={{ display: "flex", borderBottom: `1px solid ${color.border}`, position: "sticky", top: 0 }}>
            <div style={{ width: LABEL, flex: "none", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: color.faint2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Initiative</div>
            {months.map((k) => {
              const { m, y } = monthLabel(k);
              const jan = k % 12 === 0;
              return (
                <div key={k} style={{ width: COL, flex: "none", padding: "10px 0", textAlign: "center", fontSize: 11, color: color.faint2, borderLeft: `1px solid ${jan ? color.border2 : color.bg}` }}>
                  <div style={{ fontWeight: 600, color: color.textMuted }}>{m}</div>
                  <div style={{ fontSize: 9.5 }}>{y}</div>
                </div>
              );
            })}
          </div>

          {[...groups.entries()].map(([themeName, rows]) => (
            <div key={themeName}>
              <div style={{ background: color.surfaceAlt, borderBottom: `1px solid ${color.bg}`, padding: "6px 14px", fontSize: 11, fontWeight: 700, color: color.subtle }}>{themeName}</div>
              {rows.map((i) => {
                const s = parseD(i.startDate) ?? parseD(i.endDate)!;
                const e = parseD(i.endDate) ?? parseD(i.startDate)!;
                const startK = Math.max(monthKey(s), bounds.min);
                const endK = Math.min(monthKey(e), bounds.max);
                const left = LABEL + (startK - bounds.min) * COL;
                const width = Math.max((endK - startK + 1) * COL - 8, 26);
                return (
                  <div key={i.id} style={{ display: "flex", alignItems: "center", height: ROW, borderBottom: `1px solid ${color.bg}`, position: "relative" }}>
                    <button onClick={() => onEdit(i)} title={i.title}
                      style={{ width: LABEL, flex: "none", padding: "0 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {i.title}
                    </button>
                    <div style={{ position: "absolute", left, top: (ROW - 18) / 2, width, height: 18, borderRadius: 5, background: LANE_ACCENT[i.lane] ?? color.primary, opacity: i.status === "Cancelled" ? 0.4 : 0.9, display: "flex", alignItems: "center", paddingLeft: 7 }}
                      title={`${i.lane} · ${i.status} · ${i.confidence}% confidence`}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{i.confidence}%</span>
                    </div>
                    {/* Milestone diamonds */}
                    {i.milestones.map((m) => {
                      const md = parseD(m.date); if (!md) return null;
                      const mk = monthKey(md);
                      if (mk < bounds.min || mk > bounds.max) return null;
                      const day = md.getDate(), frac = Math.min(day / 30, 1);
                      const mLeft = LABEL + (mk - bounds.min) * COL + frac * COL - 5;
                      return <span key={m.id} title={`${m.title}${m.date ? ` · ${m.date}` : ""}`}
                        style={{ position: "absolute", left: mLeft, top: ROW / 2 - 5, width: 10, height: 10, background: m.done ? color.success : color.warning, transform: "rotate(45deg)", border: "1.5px solid #fff", borderRadius: 2 }} />;
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {undated.length > 0 && (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${color.border}`, fontSize: 11.5, color: color.faint2 }}>
          {undated.length} undated initiative{undated.length === 1 ? "" : "s"} not shown here — add dates to place {undated.length === 1 ? "it" : "them"} on the timeline: {undated.map((i) => i.title).join(", ")}
        </div>
      )}
    </Card>
  );
}

// ---- Create / edit modal ---------------------------------------------------
function ItemModal({ board, item, onClose }: { board: Board; item?: Item; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = !!item;
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [lane, setLane] = useState(item?.lane ?? "Now");
  const [status, setStatus] = useState(item?.status ?? "Proposed");
  const [theme, setTheme] = useState(item?.theme ?? "");
  const [owner, setOwner] = useState(item?.owner ?? "");
  const [startDate, setStartDate] = useState(item?.startDate ?? "");
  const [endDate, setEndDate] = useState(item?.endDate ?? "");
  const [confidence, setConfidence] = useState(item?.confidence ?? 60);
  const [effort, setEffort] = useState(item?.effort ?? 3);
  const [value, setValue] = useState(item?.value ?? 3);
  const [plannedYear, setPlannedYear] = useState(item?.plannedYear ?? 0);
  const [milestones, setMilestones] = useState<{ title: string; date: string; done: boolean }[]>(
    item?.milestones.map((m) => ({ title: m.title, date: m.date, done: m.done })) ?? []);
  const [links, setLinks] = useState<{ entityType: string; entityId: string }[]>(
    item?.links.map((l) => ({ entityType: l.entityType, entityId: l.entityId })) ?? []);
  const [dependsOn, setDependsOn] = useState<number[]>(item?.dependsOn ?? []);
  const [confirmDel, setConfirmDel] = useState(false);

  const others = board.items.filter((i) => i.id !== item?.id);
  const optionsByType = (t: string) => board.linkOptions.filter((o) => o.entityType === t);
  const linkOn = (t: string, id: string) => links.some((l) => l.entityType === t && l.entityId === id);
  const toggleLink = (t: string, id: string) =>
    setLinks((cur) => linkOn(t, id) ? cur.filter((l) => !(l.entityType === t && l.entityId === id)) : [...cur, { entityType: t, entityId: id }]);

  const body = () => JSON.stringify({
    title: title.trim(), description: description.trim(), lane, status, theme: theme.trim(), owner: owner.trim(),
    startDate, endDate, confidence, effort, value, plannedYear,
    milestones: milestones.filter((m) => m.title.trim()).map((m) => ({ title: m.title.trim(), date: m.date, done: m.done })),
    links, dependsOn,
  });
  const save = useMutation({
    mutationFn: () => editing
      ? api(`/roadmap/${item!.id}`, { method: "PATCH", body: body() })
      : api(`/roadmap`, { method: "POST", body: body() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roadmap"] }); toast(editing ? "Initiative saved" : "Initiative created"); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/roadmap/${item!.id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roadmap"] }); toast("Initiative removed"); onClose(); },
    onError: (e) => toastError(e),
  });

  return (
    <Modal onClose={onClose} width={640} label={editing ? "Edit initiative" : "New roadmap initiative"}>
      <DecLabel>Title</DecLabel>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unified checkout across markets" style={{ marginBottom: 14 }} />

      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Horizon</DecLabel><Select value={lane} onChange={(e) => setLane(e.target.value)}>{LANES.map((l) => <option key={l} value={l}>{l}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Planned year</DecLabel>
          <Select value={String(plannedYear)} onChange={(e) => setPlannedYear(Number(e.target.value))}>
            <option value="0">Unscheduled</option>
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Theme</DecLabel><Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Swimlane" list="roadmap-themes" />
          <datalist id="roadmap-themes">{board.themes.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 2 }}><DecLabel>Owner</DecLabel><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Accountable person" /></div>
        <div style={{ flex: 1 }}><DecLabel>Start</DecLabel><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div style={{ flex: 1 }}><DecLabel>End</DecLabel><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><DecLabel>Confidence</DecLabel><span style={{ fontSize: 11, fontWeight: 700, color: confColor(confidence) }}>{confidence}%</span></div>
          <input type="range" min={0} max={100} step={5} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} style={{ width: "100%", accentColor: confColor(confidence) }} />
        </div>
        <div style={{ flex: 1 }}><DecLabel>Value (1–5)</DecLabel><Select value={String(value)} onChange={(e) => setValue(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Effort (1–5)</DecLabel><Select value={String(effort)} onChange={(e) => setEffort(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select></div>
      </div>

      <DecLabel>Description</DecLabel>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this initiative delivers and why…" style={{ minHeight: 60, marginBottom: 16 }} />

      {/* Milestones */}
      <SectionTitle>Milestones</SectionTitle>
      {milestones.map((m, idx) => (
        <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <Input value={m.title} onChange={(e) => setMilestones((cur) => cur.map((x, j) => j === idx ? { ...x, title: e.target.value } : x))} placeholder="Milestone" style={{ flex: 2 }} />
          <Input type="date" value={m.date} onChange={(e) => setMilestones((cur) => cur.map((x, j) => j === idx ? { ...x, date: e.target.value } : x))} style={{ flex: 1 }} />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: color.textMuted, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={m.done} onChange={(e) => setMilestones((cur) => cur.map((x, j) => j === idx ? { ...x, done: e.target.checked } : x))} /> done
          </label>
          <button onClick={() => setMilestones((cur) => cur.filter((_, j) => j !== idx))} aria-label="Remove milestone"
            style={{ background: "none", border: "none", cursor: "pointer", color: color.faint2, padding: 4 }}><Icon name="trash" size={15} /></button>
        </div>
      ))}
      <button onClick={() => setMilestones((cur) => [...cur, { title: "", date: "", done: false }])}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: color.primary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 0", marginBottom: 16 }}>
        <Icon name="plus" size={14} /> Add milestone
      </button>

      {/* Dependencies */}
      {others.length > 0 && (
        <>
          <SectionTitle>Depends on</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
            {others.map((o) => {
              const on = dependsOn.includes(o.id);
              return (
                <button key={o.id} onClick={() => setDependsOn((cur) => on ? cur.filter((x) => x !== o.id) : [...cur, o.id])}
                  style={{ fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", borderRadius: 6, padding: "5px 10px", border: `1px solid ${on ? color.primary : color.border2}`, background: on ? color.primaryTint : color.surface, color: on ? color.primaryDark : color.textMuted }}>
                  {o.title}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Links */}
      <SectionTitle>Linked to</SectionTitle>
      {board.linkOptions.length === 0 ? (
        <div style={{ fontSize: 12, color: color.faint3, marginBottom: 16 }}>No OKRs, projects, programs, products or releases to link yet.</div>
      ) : (
        <div style={{ marginBottom: 8 }}>
          {LINK_TYPES.filter((t) => optionsByType(t).length > 0).map((t) => (
            <div key={t} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: color.faint2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{LINK_LABEL[t]}s</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {optionsByType(t).map((o) => {
                  const on = linkOn(t, o.entityId);
                  return (
                    <button key={o.entityId} onClick={() => toggleLink(t, o.entityId)}
                      style={{ fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", borderRadius: 6, padding: "5px 10px", border: `1px solid ${on ? color.accent : color.border2}`, background: on ? color.accentTint : color.surface, color: on ? color.accent : color.textMuted }}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12 }}>
        {editing && (
          confirmDel ? (
            <>
              <span style={{ fontSize: 12, color: color.dangerInk, fontWeight: 600 }}>Delete this initiative?</span>
              <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: color.danger, borderColor: color.danger }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
              <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.dangerInk, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
          )
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (title.trim()) save.mutate(); }} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Create initiative"}</Button>
      </div>
    </Modal>
  );
}

const selectStyle: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: color.textMuted, background: color.surface,
  border: `1px solid ${color.border2}`, borderRadius: radius.md, padding: "7px 10px", fontFamily: "inherit", cursor: "pointer",
};

function DecLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: color.faint2, marginBottom: 5, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>{children}</div>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: font.head, fontSize: 12.5, fontWeight: 700, color: color.ink, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${color.bg}` }}>{children}</div>;
}
