import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Input, Select, Field, Modal, EmptyBlock } from "@/components/ui";
import { toast, toastError } from "@/components/Toast";
import { useRole } from "@/components/RoleContext";
import type { IncrementDetail, Objective } from "./data";
import { DEP_COL, DEP_STATUSES, OBJ_PILL } from "./data";
import {
  type Lane, columns, deriveLanes, cardsFor, dependencyLaneLinks, arrowPath,
} from "./board";
import { useBoardRealtime } from "./useBoardRealtime";

interface BoardData { canEdit: boolean; placements: Record<string, number> }

// ============================================================================
//  PI Program Board (ADR-0061) — a live swimlane board. Rows are the linked
//  deliverables, columns the increment's iterations; PI objectives are cards
//  you drag between iterations, and dependencies are arrows drawn between lanes.
//  Presence, peer cursors and change-sync come from the SignalR hub; the data
//  itself is read/written through the existing REST API (cap-schedule).
// ============================================================================
export default function ProgramBoard({ inc }: { inc: IncrementDetail }) {
  const qc = useQueryClient();
  const { identity } = useRole();
  const canEdit = inc.canEdit;

  const boardQ = useQuery({
    queryKey: ["increment-board", inc.id], retry: false, staleTime: 0,
    queryFn: async () => (await api<BoardData>(`/increments/${inc.id}/board`)) ?? { canEdit: false, placements: {} },
  });
  const placements = useMemo(() => boardQ.data?.placements ?? {}, [boardQ.data]);

  // A peer changed the board → refetch the authoritative state.
  const onChanged = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["increment", inc.id] });
    qc.invalidateQueries({ queryKey: ["increment-board", inc.id] });
  }, [qc, inc.id]);
  // Peers are refreshed by the server-side broadcast (the REST mutation endpoints
  // ping the increment group), so the client doesn't relay changes itself — it
  // just optimistically refetches its own view for instant feedback.
  const { peers, cursors, connected, sendCursor } = useBoardRealtime(inc.id, identity.name, onChanged);

  const move = useMutation({
    mutationFn: (v: { objectiveId: number; iterationId: number | null }) =>
      api(`/increments/${inc.id}/board/placement`, { method: "PUT", body: JSON.stringify(v) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["increment-board", inc.id] }),
    onError: toastError,
  });

  const lanes = useMemo(() => deriveLanes(inc.objectiveList, inc.dependencyList), [inc.objectiveList, inc.dependencyList]);
  const cols = useMemo(() => columns(inc.iterationList), [inc.iterationList]);
  const iterationIds = useMemo(() => new Set(inc.iterationList.map((i) => i.id)), [inc.iterationList]);
  const links = useMemo(() => dependencyLaneLinks(inc.dependencyList), [inc.dependencyList]);

  // --- Geometry: measure lane-row centres + surface size for arrows/cursors ---
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const laneEls = useRef<Record<string, HTMLDivElement | null>>({});
  const [laneY, setLaneY] = useState<Record<string, number>>({});
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tick, setTick] = useState(0);
  useLayoutEffect(() => {
    const surf = surfaceRef.current;
    if (!surf) return;
    const base = surf.getBoundingClientRect();
    const ys: Record<string, number> = {};
    for (const [key, el] of Object.entries(laneEls.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      ys[key] = r.top - base.top + r.height / 2;
    }
    setLaneY(ys);
    setSize({ w: surf.offsetWidth, h: surf.offsetHeight });
  }, [lanes, cols, placements, inc.dependencyList, tick]);
  useLayoutEffect(() => {
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const surf = surfaceRef.current;
    if (!surf) return;
    const r = surf.getBoundingClientRect();
    if (r.width && r.height) sendCursor((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }, [sendCursor]);

  // --- Dependency linking (click a lane's link handle, then a target lane) ----
  const [linkFrom, setLinkFrom] = useState<Lane | null>(null);
  const [linkTo, setLinkTo] = useState<Lane | null>(null);
  const onLaneLink = (lane: Lane) => {
    if (!canEdit) return;
    if (!linkFrom) { setLinkFrom(lane); return; }
    if (lane.key === linkFrom.key) { setLinkFrom(null); return; } // cancel
    setLinkTo(lane);
  };

  const RAIL = 220, ARROW_X = RAIL - 16;
  const gridCols = `${RAIL}px repeat(${cols.length}, minmax(190px, 1fr))`;

  if (lanes.length === 0) {
    return <EmptyBlock message="No PI objectives or dependencies yet. Add objectives (with a linked deliverable) and dependencies, and they'll lay out here as a live board." />;
  }

  return (
    <div>
      {/* Toolbar: live status + presence + legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: connected ? color.successInk : color.faint }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#16A34A" : color.border2, boxShadow: connected ? "0 0 0 3px rgba(22,163,74,0.15)" : "none" }} />
          {connected ? "Live" : "Offline"}
        </div>
        <PresenceRow peers={peers} />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {DEP_STATUSES.map((s) => (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: color.faint }}>
              <span style={{ width: 16, height: 3, borderRadius: 2, background: DEP_COL[s].bar }} /> {s}
            </span>
          ))}
        </div>
      </div>

      {linkFrom && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 12px", background: color.primaryTint, border: `1px solid ${color.primaryTint2}`, borderRadius: 8, fontSize: 12.5, color: color.primaryDark }}>
          <Icon name="gitBranch" size={14} /> Linking dependency from <b>{linkFrom.name}</b> — click another lane's link handle to set the target.
          <button onClick={() => setLinkFrom(null)} style={{ marginLeft: "auto", border: "none", background: "transparent", color: color.primary, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Cancel</button>
        </div>
      )}

      <div style={{ overflowX: "auto", border: `1px solid ${color.border}`, borderRadius: 12, background: color.surface }}>
        <div
          ref={surfaceRef}
          onMouseMove={onMouseMove}
          style={{ position: "relative", minWidth: RAIL + cols.length * 190, display: "grid", gridTemplateColumns: gridCols }}
        >
          {/* Header row */}
          <div style={{ ...headCell, borderLeft: "none", background: color.bg }} />
          {cols.map((c) => (
            <div key={String(c.id)} style={{ ...headCell, background: c.id == null ? color.bg : color.surfaceAlt }}>
              {c.name}
            </div>
          ))}

          {/* Lane rows */}
          {lanes.map((lane) => (
            <LaneRow
              key={lane.key} lane={lane} cols={cols} objectives={inc.objectiveList}
              placements={placements} iterationIds={iterationIds} canEdit={canEdit}
              linking={!!linkFrom} isLinkSource={linkFrom?.key === lane.key}
              onLink={() => onLaneLink(lane)}
              onDropCard={(objId, colId) => move.mutate({ objectiveId: objId, iterationId: colId })}
              railWidth={RAIL}
              anchorRef={(el) => { laneEls.current[lane.key] = el; }}
            />
          ))}

          {/* Dependency arrows (overlay, non-interactive) */}
          <svg width={size.w} height={size.h} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }} aria-hidden>
            <defs>
              {DEP_STATUSES.map((s) => (
                <marker key={s} id={`arrow-${s}`} markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill={DEP_COL[s].bar} />
                </marker>
              ))}
            </defs>
            {links.map((l) => {
              const y1 = laneY[l.from], y2 = laneY[l.to];
              if (y1 == null || y2 == null) return null;
              return (
                <path key={l.id} d={arrowPath(ARROW_X, y1, ARROW_X, y2)} fill="none"
                  stroke={DEP_COL[l.status]?.bar ?? color.border2} strokeWidth={2}
                  markerEnd={`url(#arrow-${l.status})`} opacity={0.9}>
                  <title>{l.title} ({l.status})</title>
                </path>
              );
            })}
          </svg>

          {/* Peer cursors (overlay, non-interactive) */}
          {cursors.map((cur) => {
            const peer = peers.find((p) => p.id === cur.id);
            if (!peer) return null;
            return (
              <div key={cur.id} style={{ position: "absolute", left: cur.x * size.w, top: cur.y * size.h, pointerEvents: "none", transform: "translate(-2px,-2px)", transition: "left .08s linear, top .08s linear", zIndex: 5 }}>
                <Icon name="mousePointer" size={16} color={peer.color} />
                <span style={{ marginLeft: 2, fontSize: 10.5, fontWeight: 700, color: "#fff", background: peer.color, padding: "1px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>{peer.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {linkFrom && linkTo && (
        <LinkDependencyModal
          incId={inc.id} from={linkFrom} to={linkTo}
          onClose={() => { setLinkFrom(null); setLinkTo(null); }}
          onDone={() => { setLinkFrom(null); setLinkTo(null); qc.invalidateQueries({ queryKey: ["increment", inc.id] }); }}
        />
      )}
    </div>
  );
}

const headCell: React.CSSProperties = {
  padding: "10px 12px", fontSize: 12, fontWeight: 700, color: color.subtle,
  borderBottom: `1px solid ${color.border}`, borderLeft: `1px solid ${color.border}`,
  position: "sticky", top: 0, zIndex: 2, whiteSpace: "nowrap",
};

function PresenceRow({ peers }: { peers: { id: string; name: string; initials: string; color: string }[] }) {
  if (peers.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center" }} aria-label={`${peers.length} on this board`}>
      {peers.slice(0, 6).map((p, i) => (
        <span key={p.id} title={p.name}
          style={{ width: 26, height: 26, borderRadius: "50%", background: p.color, color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid " + color.surface, marginLeft: i ? -8 : 0 }}>
          {p.initials}
        </span>
      ))}
      {peers.length > 6 && <span style={{ marginLeft: 6, fontSize: 11.5, color: color.faint }}>+{peers.length - 6}</span>}
    </div>
  );
}

function LaneRow({
  lane, cols, objectives, placements, iterationIds, canEdit, linking, isLinkSource, onLink, onDropCard, railWidth, anchorRef,
}: {
  lane: Lane; cols: { id: number | null; name: string }[]; objectives: Objective[];
  placements: Record<string, number>; iterationIds: ReadonlySet<number>;
  canEdit: boolean; linking: boolean; isLinkSource: boolean;
  onLink: () => void; onDropCard: (objId: number, colId: number | null) => void;
  railWidth: number; anchorRef: (el: HTMLDivElement | null) => void;
}) {
  const [over, setOver] = useState<number | "nil" | null>(null);
  return (
    <>
      <div ref={anchorRef}
        style={{ width: railWidth, padding: "12px 12px", borderBottom: `1px solid ${color.border}`, display: "flex", alignItems: "flex-start", gap: 8, background: isLinkSource ? color.primaryTint : color.bg, position: "sticky", left: 0, zIndex: 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: color.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lane.name}</div>
          {lane.type && <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: color.faint3, marginTop: 2 }}>{lane.type}</div>}
        </div>
        {canEdit && lane.key !== "unassigned" && (
          <button onClick={onLink} title={linking ? "Set as dependency target" : "Link a dependency from this lane"} aria-label="Link dependency"
            style={{ border: "none", background: isLinkSource ? color.primary : "transparent", color: isLinkSource ? "#fff" : color.faint2, cursor: "pointer", padding: 4, borderRadius: 6, lineHeight: 0, flex: "none" }}>
            <Icon name="gitBranch" size={14} />
          </button>
        )}
      </div>
      {cols.map((c) => {
        const cards = cardsFor(objectives, lane.key, c.id, placements, iterationIds);
        const key = c.id ?? "nil";
        return (
          <div key={String(c.id)}
            onDragOver={canEdit ? (e) => { e.preventDefault(); setOver(key); } : undefined}
            onDragLeave={() => setOver((o) => (o === key ? null : o))}
            onDrop={canEdit ? (e) => { e.preventDefault(); setOver(null); const id = Number(e.dataTransfer.getData("text/plain")); if (id) onDropCard(id, c.id); } : undefined}
            style={{ padding: 8, borderBottom: `1px solid ${color.border}`, borderLeft: `1px solid ${color.border}`, background: over === key ? color.primaryTint : c.id == null ? color.bg : color.surface, minHeight: 64, display: "flex", flexDirection: "column", gap: 7 }}>
            {cards.map((o) => <ObjectiveCard key={o.id} obj={o} canEdit={canEdit} />)}
          </div>
        );
      })}
    </>
  );
}

function ObjectiveCard({ obj, canEdit }: { obj: Objective; canEdit: boolean }) {
  const pill = OBJ_PILL[obj.status] ?? OBJ_PILL.Planned;
  return (
    <div draggable={canEdit}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(obj.id))}
      style={{ border: `1px solid ${color.border}`, borderLeft: `3px solid ${pill.dot}`, borderRadius: 8, padding: "8px 10px", background: color.surface, cursor: canEdit ? "grab" : "default", boxShadow: "0 1px 2px rgba(20,26,60,0.05)" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: color.ink, lineHeight: 1.35, marginBottom: 5 }}>{obj.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: pill.ink, background: pill.tint, padding: "2px 7px", borderRadius: 5 }}>{obj.status}</span>
        <span title="Business value" style={{ fontSize: 10, fontWeight: 700, color: color.subtle, background: color.bg, padding: "2px 7px", borderRadius: 5, fontFamily: font.mono }}>BV {obj.businessValue}</span>
        {!obj.committed && <span style={{ fontSize: 10, fontWeight: 700, color: color.faint, background: color.bg, padding: "2px 7px", borderRadius: 5 }}>Stretch</span>}
      </div>
    </div>
  );
}

function LinkDependencyModal({ incId, from, to, onClose, onDone }: {
  incId: number; from: Lane; to: Lane; onClose: () => void; onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Identified");
  const create = useMutation({
    mutationFn: () => api(`/increments/${incId}/dependencies`, {
      method: "POST",
      body: JSON.stringify({ title: title.trim(), fromType: from.type, fromId: from.id, toType: to.type, toId: to.id, status }),
    }),
    onSuccess: () => { toast("Dependency linked.", "info"); onDone(); },
    onError: toastError,
  });
  return (
    <Modal onClose={onClose} width={460} label="Link dependency">
      <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, marginBottom: 4 }}>Link dependency</div>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
        <b>{from.name}</b> <Icon name="arrowRight" size={13} /> <b>{to.name}</b>
      </div>
      <Field label="What's needed">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Auth API ready before checkout" />}</Field>
      <Field label="Status" style={{ marginTop: 12 }}>{(id) => (
        <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
          {DEP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      )}</Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => title.trim() && create.mutate()} disabled={!title.trim() || create.isPending}>{create.isPending ? "Linking…" : "Link"}</Button>
      </div>
    </Modal>
  );
}
