import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { useRole } from "@/components/RoleContext";
import { useRoomRealtime } from "@/realtime/useRoomRealtime";
import { LiveDot, PresenceRow, CursorLayer } from "@/realtime/Presence";
import {
  EMPTY_SCENE, PALETTE, SHAPE_TOOLS, ICONS, CLIP, type Scene, type WbNode, type WbEdge, type NodeKind,
} from "./types";
import { createNode, createStroke, translateNode, updateNode, removeNode, addEdge, removeEdge, edgeEndpoints, applyRemoteOp, type RemoteOp } from "./scene";
import { downloadPng, downloadSvg, downloadJson, jsonToScene } from "./exportScene";
import { toast, toastError } from "@/components/Toast";

// ============================================================================
//  Freeform Whiteboard (ADR-0064) — a per-entity brainstorming canvas: sticky
//  notes, shapes, text, icons and connectors, worked live by several people via
//  the shared room hub (ADR-0061). Data is a small JSON scene owned by the REST
//  API (server/Whiteboards.cs); the socket only carries presence/cursors and a
//  "refetch" ping (no domain data). Everything degrades to a solo canvas if the
//  hub is unreachable.
// ============================================================================
const CANVAS_W = 2400, CANVAS_H = 1600;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export default function Whiteboard({ scope }: { scope: { kind: string; id: string } }) {
  const { kind, id } = scope;
  const qc = useQueryClient();
  const { identity } = useRole();

  const q = useQuery({
    queryKey: ["whiteboard", kind, id], retry: false, staleTime: 0,
    queryFn: async (): Promise<{ canEdit: boolean; scene: Scene }> =>
      (await api<{ canEdit: boolean; scene: Scene }>(`/whiteboards/${kind}/${id}`)) ?? { canEdit: false, scene: EMPTY_SCENE },
  });
  const canEdit = q.data?.canEdit ?? false;

  // Local editable scene, mirrored to a ref so pointer handlers read the latest.
  const [scene, setScene] = useState<Scene>(EMPTY_SCENE);
  const sceneRef = useRef(scene);
  useEffect(() => { sceneRef.current = scene; }, [scene]);
  const lastSynced = useRef("");         // JSON we last adopted from the server
  const interacting = useRef(false);     // suppress remote adoption mid-drag / mid-edit

  // Live co-editing: persist each change as an authorized granular op (per node /
  // edge) rather than PUTting the whole scene. The server sanitises + persists it
  // and broadcasts the exact delta to peers. This makes concurrent edits to
  // *different* items independent (no whole-scene clobber). On any error we just
  // refetch the authoritative scene to reconcile.
  const reconcile = useCallback(() => { qc.invalidateQueries({ queryKey: ["whiteboard", kind, id] }); }, [qc, kind, id]);
  const persist = useCallback((run: Promise<unknown>) => { run.catch(() => reconcile()); }, [reconcile]);
  const base = `/whiteboards/${kind}/${id}`;
  const pushNode = useCallback((node: WbNode) => persist(api(`${base}/node`, { method: "PUT", body: JSON.stringify(node) })), [persist, base]);
  const pushDelNode = useCallback((nid: string) => persist(api(`${base}/node/${encodeURIComponent(nid)}`, { method: "DELETE" })), [persist, base]);
  const pushEdge = useCallback((edge: WbEdge) => persist(api(`${base}/edge`, { method: "PUT", body: JSON.stringify(edge) })), [persist, base]);
  const pushDelEdge = useCallback((eid: string) => persist(api(`${base}/edge/${encodeURIComponent(eid)}`, { method: "DELETE" })), [persist, base]);

  // Adopt the server's scene on first load and on reconnect/error reconcile — but
  // never while we're mid-interaction (a granular op we just sent may not be
  // reflected in this fetch yet). Live peer changes arrive as ops, not here.
  const serverScene = q.data?.scene;
  useEffect(() => {
    if (!serverScene || interacting.current) return;
    const incoming = JSON.stringify(serverScene);
    if (incoming !== lastSynced.current) {
      lastSynced.current = incoming;
      setScene({ nodes: serverScene.nodes ?? [], edges: serverScene.edges ?? [] });
    }
  }, [serverScene]);

  // A peer's authorized op → apply the delta live. Skip upserts to the node the
  // local user is actively dragging/editing so a peer can't fight the interaction.
  const editingRef = useRef<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const onOp = useCallback((op: unknown) => {
    setScene((s) => applyRemoteOp(s, op as RemoteOp, dragIdRef.current ?? editingRef.current));
  }, []);

  const roomKey = `wb:${kind}:${id}`.toLowerCase();
  const { peers, cursors, connected, sendCursor } = useRoomRealtime(roomKey, identity.name, reconcile, onOp);

  // --- Selection & tool state ---
  const [sel, setSel] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [pending, setPending] = useState<{ kind: NodeKind; icon?: string } | null>(null);
  const [tool, setTool] = useState<"select" | "connector" | "pen">("select");   // pointer mode
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newColor, setNewColor] = useState<string>(PALETTE[0]);
  const [inkColor, setInkColor] = useState<string>(color.primary);   // stroke colour for the pen / new icons
  const [iconMenu, setIconMenu] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: string; mode: "move" | "resize"; ox: number; oy: number; start: WbNode } | null>(null);
  const pen = useRef<number[] | null>(null);                 // in-progress freehand points
  const [penLive, setPenLive] = useState<number[] | null>(null);

  // Whole-scene persist (bulk PUT) — used by Clear and Import. Broadcasts a
  // refetch ping so peers converge; on error we reconcile.
  const putWholeScene = useCallback((sc: Scene) =>
    persist(api(`${base}`, { method: "PUT", body: JSON.stringify({ scene: sc }) })), [persist, base]);

  const clearBoard = () => {
    if (sceneRef.current.nodes.length === 0 && sceneRef.current.edges.length === 0) return;
    if (!window.confirm("Clear the whole whiteboard? This removes every note, shape and connector for everyone.")) return;
    setScene(EMPTY_SCENE); putWholeScene(EMPTY_SCENE); setSel(null); setSelEdge(null);
  };
  const doExport = (fmt: "png" | "svg" | "json") => {
    setExportMenu(false);
    const name = `whiteboard-${kind}-${id}`;
    if (fmt === "json") downloadJson(sceneRef.current, name);
    else if (fmt === "svg") downloadSvg(sceneRef.current, name);
    else downloadPng(sceneRef.current, name).catch(() => toastError(new Error("Couldn't render the image.")));
  };
  const onImportFile = (file: File) => {
    file.text().then((t) => {
      const sc = jsonToScene(t);
      setScene(sc); putWholeScene(sc); toast("Whiteboard imported.", "info");
    }).catch(() => toastError(new Error("That file isn't a valid whiteboard JSON.")));
  };

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // --- Pointer: background (pen / add tool / deselect) ---
  const onCanvasDown = (e: React.PointerEvent) => {
    if (!canEdit) { setSel(null); setSelEdge(null); return; }
    const p = toCanvas(e);
    if (tool === "pen") {
      pen.current = [p.x, p.y]; setPenLive([p.x, p.y]); interacting.current = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (pending) {
      const node = createNode(pending.kind, p.x, p.y, pending.icon ? { icon: pending.icon, color: inkColor } : { color: pending.kind === "text" ? color.ink : newColor });
      setScene((s) => ({ ...s, nodes: [...s.nodes, node] }));
      pushNode(node);
      setPending(null);
      return;
    }
    setSel(null); setSelEdge(null); setLinkFrom(null);
  };

  const onCanvasMove = (e: React.PointerEvent) => {
    const p = toCanvas(e);
    sendCursor(p.x / CANVAS_W, p.y / CANVAS_H);
    if (pen.current) { pen.current.push(p.x, p.y); setPenLive(pen.current.slice()); return; }
    const d = drag.current;
    if (!d) return;
    const node = sceneRef.current.nodes.find((n) => n.id === d.id);
    if (!node) return;
    if (d.mode === "move") {
      const nx = clamp(d.start.x + (p.x - d.ox), 0, CANVAS_W - node.w);
      const ny = clamp(d.start.y + (p.y - d.oy), 0, CANVAS_H - node.h);
      const patch = d.start.kind === "draw" ? translateNode(d.start, nx - d.start.x, ny - d.start.y) : { x: nx, y: ny };
      setScene((s) => updateNode(s, d.id, patch));
    } else {
      const nw = clamp(d.start.w + (p.x - d.ox), 44, CANVAS_W - node.x);
      const nh = clamp(d.start.h + (p.y - d.oy), 32, CANVAS_H - node.y);
      setScene((s) => updateNode(s, d.id, { w: nw, h: nh }));
    }
  };

  const endInteraction = () => {
    // Finish a freehand stroke → commit it as one node.
    if (pen.current) {
      const pts = pen.current; pen.current = null; setPenLive(null); interacting.current = false;
      if (pts.length >= 4) {
        const stroke = createStroke(pts, inkColor);
        setScene((s) => ({ ...s, nodes: [...s.nodes, stroke] }));
        pushNode(stroke);
      }
      return;
    }
    const d = drag.current;
    if (!d) return;
    drag.current = null; dragIdRef.current = null;
    interacting.current = false;
    const node = sceneRef.current.nodes.find((n) => n.id === d.id);
    if (node) pushNode(node);   // persist the moved/resized node (one granular op)
  };

  // --- Pointer: a node ---
  const onNodeDown = (e: React.PointerEvent, node: WbNode, mode: "move" | "resize") => {
    e.stopPropagation();
    if (!canEdit) { setSel(node.id); setSelEdge(null); return; }
    // Completing a connector (from the connector tool or the Connect button).
    if (linkFrom) {
      if (node.id !== linkFrom) {
        const after = addEdge(sceneRef.current, linkFrom, node.id, color.faint2);
        if (after !== sceneRef.current) { setScene(after); pushEdge(after.edges[after.edges.length - 1]); }
      }
      setLinkFrom(null);
      return;
    }
    if (tool === "connector") { setSel(node.id); setLinkFrom(node.id); return; }
    setSel(node.id); setSelEdge(null);
    interacting.current = true;
    const p = toCanvas(e);
    drag.current = { id: node.id, mode, ox: p.x, oy: p.y, start: node };
    dragIdRef.current = node.id;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  // --- Node text editing ---
  const startEdit = (node: WbNode) => {
    if (!canEdit || node.kind === "icon" || node.kind === "draw") return;
    setSel(node.id); interacting.current = true; editingRef.current = node.id; setEditing(node.id);
  };
  const changeText = (nodeId: string, text: string) => setScene((s) => updateNode(s, nodeId, { text }));
  const endEdit = () => {
    const nid = editingRef.current;
    setEditing(null); editingRef.current = null; interacting.current = false;
    const node = nid ? sceneRef.current.nodes.find((n) => n.id === nid) : null;
    if (node) pushNode(node);
  };

  // --- Toolbar actions on the selection ---
  const recolor = (c: string) => {
    setNewColor(c); setInkColor(c);
    if (sel) {
      const node = sceneRef.current.nodes.find((n) => n.id === sel);
      if (node) { const upd = { ...node, color: c }; setScene((s) => updateNode(s, sel, { color: c })); pushNode(upd); }
    }
  };
  const deleteSel = useCallback(() => {
    if (sel) { setScene((s) => removeNode(s, sel)); pushDelNode(sel); setSel(null); }
    else if (selEdge) { setScene((s) => removeEdge(s, selEdge)); pushDelEdge(selEdge); setSelEdge(null); }
  }, [sel, selEdge, pushDelNode, pushDelEdge]);

  // Pick a shape/pen/connector tool (clears the others).
  const armShape = (k: NodeKind) => { setPending({ kind: k }); setTool("select"); setLinkFrom(null); setIconMenu(false); };
  const armIcon = (icon: string) => { setPending({ kind: "icon", icon }); setTool("select"); setLinkFrom(null); setIconMenu(false); };
  const armTool = (t: "select" | "connector" | "pen") => { setTool(t); setPending(null); setLinkFrom(null); setIconMenu(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    if ((e.key === "Delete" || e.key === "Backspace") && (sel || selEdge)) { e.preventDefault(); deleteSel(); }
    if (e.key === "Escape") { setPending(null); setLinkFrom(null); setSel(null); setSelEdge(null); setTool("select"); }
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {canEdit ? (
          <>
            <div style={{ display: "flex", gap: 4, background: color.surfaceAlt, border: `1px solid ${color.border}`, borderRadius: 10, padding: 4, flexWrap: "wrap" }}>
              {SHAPE_TOOLS.map((t) => (
                <ToolBtn key={t.kind} title={t.label} active={pending?.kind === t.kind && !pending.icon} onClick={() => armShape(t.kind)}>
                  <ShapeGlyph kind={t.kind} />
                </ToolBtn>
              ))}
              {/* Icon tool with a small palette popover */}
              <div style={{ position: "relative" }}>
                <ToolBtn title="Icon" active={pending?.kind === "icon" || iconMenu} onClick={() => { setIconMenu((v) => !v); }}>
                  <Icon name={pending?.icon ?? "rocket"} size={17} />
                </ToolBtn>
                {iconMenu && (
                  <div style={{ position: "absolute", top: 40, left: 0, zIndex: 20, display: "grid", gridTemplateColumns: "repeat(4, 34px)", gap: 4, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 10, padding: 6, boxShadow: "0 6px 20px rgba(20,26,60,0.14)" }}>
                    {ICONS.map((ic) => (
                      <button key={ic} type="button" title={ic} onClick={() => armIcon(ic)}
                        style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${color.border2}`, borderRadius: 8, background: color.surface, cursor: "pointer", color: color.text }}>
                        <Icon name={ic} size={17} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Connector (arrow) + freehand pen tools */}
              <ToolBtn title="Connector — click two shapes to link them with an arrow" active={tool === "connector"} onClick={() => armTool(tool === "connector" ? "select" : "connector")}>
                <Icon name="gitBranch" size={17} />
              </ToolBtn>
              <ToolBtn title="Pen — draw freehand" active={tool === "pen"} onClick={() => armTool(tool === "pen" ? "select" : "pen")}>
                <Icon name="edit" size={16} />
              </ToolBtn>
            </div>

            {/* Colour palette (recolours the selection; sets the default for new shapes & the pen) */}
            <div style={{ display: "flex", gap: 4, background: color.surfaceAlt, border: `1px solid ${color.border}`, borderRadius: 10, padding: 4 }}>
              {PALETTE.map((c) => (
                <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => recolor(c)}
                  style={{ width: 22, height: 22, borderRadius: 6, background: c, cursor: "pointer", border: `2px solid ${newColor === c ? color.primary : "rgba(20,26,60,0.12)"}` }} />
              ))}
            </div>

            <button type="button" onClick={deleteSel} disabled={!sel && !selEdge} title="Delete selection (Del)"
              style={{ ...actionBtn(!!(sel || selEdge)), color: (sel || selEdge) ? color.danger : color.faint3 }}>
              <Icon name="trash" size={15} /> Delete
            </button>

            {/* Export / import / clear */}
            <div style={{ position: "relative" }}>
              <button type="button" onClick={() => setExportMenu((v) => !v)} title="Save / export this whiteboard" style={actionBtn(true)}>
                <Icon name="download" size={15} /> Save ▾
              </button>
              {exportMenu && (
                <div style={{ position: "absolute", top: 40, right: 0, zIndex: 20, minWidth: 180, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 10, padding: 6, boxShadow: "0 6px 20px rgba(20,26,60,0.14)" }}>
                  <MenuRow icon="download" label="Export as PNG (image)" onClick={() => doExport("png")} />
                  <MenuRow icon="download" label="Export as SVG (vector)" onClick={() => doExport("svg")} />
                  <MenuRow icon="download" label="Export as JSON (backup)" onClick={() => doExport("json")} />
                  <div style={{ height: 1, background: color.border, margin: "5px 0" }} />
                  <MenuRow icon="sheet" label="Import JSON…" onClick={() => { setExportMenu(false); fileRef.current?.click(); }} />
                  <MenuRow icon="trash" label="Clear board" danger onClick={() => { setExportMenu(false); clearBoard(); }} />
                </div>
              )}
              <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.currentTarget.value = ""; }} />
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: color.faint2, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="eye" size={15} /> View only — your role can’t edit this whiteboard.
          </div>
        )}
        <div style={{ flex: 1 }} />
        <LiveDot connected={connected} />
        <PresenceRow peers={peers} />
      </div>

      {/* Hints */}
      {pending && <Banner>Click on the canvas to drop a <b>{pending.icon ? pending.icon : pending.kind}</b>. <Esc /></Banner>}
      {tool === "connector" && !linkFrom && <Banner>Connector: click the first shape, then the second, to link them with an arrow. <Esc /></Banner>}
      {linkFrom && <Banner>Now click the shape to connect to. <Esc /></Banner>}
      {tool === "pen" && <Banner>Pen: click and drag on the canvas to draw freehand. <Esc /></Banner>}

      {/* Canvas */}
      <div style={{ overflow: "auto", height: 580, border: `1px solid ${color.border}`, borderRadius: 12, background: color.surface }}>
        <div
          ref={canvasRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={endInteraction}
          onPointerLeave={endInteraction}
          style={{
            position: "relative", width: CANVAS_W, height: CANVAS_H, outline: "none",
            cursor: pending ? "copy" : (linkFrom || tool === "connector") ? "crosshair" : tool === "pen" ? "crosshair" : "default",
            backgroundImage: `radial-gradient(${color.border2} 1px, transparent 1px)`,
            backgroundSize: "22px 22px",
            touchAction: "none",
          }}
        >
          {/* Connectors (under nodes) */}
          <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
            <defs>
              <marker id="wb-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={color.faint2} />
              </marker>
            </defs>
            {scene.edges.map((edge) => {
              const a = scene.nodes.find((n) => n.id === edge.from);
              const b = scene.nodes.find((n) => n.id === edge.to);
              if (!a || !b) return null;
              const { x1, y1, x2, y2 } = edgeEndpoints(a, b);
              const on = selEdge === edge.id;
              return (
                <g key={edge.id} style={{ pointerEvents: canEdit ? "stroke" : "none", cursor: "pointer" }}
                  onPointerDown={(e) => { e.stopPropagation(); setSelEdge(edge.id); setSel(null); }}>
                  {/* Wide invisible hit line for easy selection */}
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? color.primary : (edge.color ?? color.faint2)} strokeWidth={on ? 3 : 2} markerEnd="url(#wb-arrow)" />
                </g>
              );
            })}
            {/* Freehand strokes */}
            {scene.nodes.filter((n) => n.kind === "draw" && n.points && n.points.length >= 2).map((n) => (
              <polyline key={n.id} points={pointsAttr(n.points!)} fill="none" stroke={n.color ?? color.primary}
                strokeWidth={sel === n.id ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {/* Live pen preview */}
            {penLive && penLive.length >= 2 && (
              <polyline points={pointsAttr(penLive)} fill="none" stroke={inkColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
            )}
          </svg>

          {/* Nodes */}
          {scene.nodes.map((node) => (
            <NodeView
              key={node.id} node={node} selected={sel === node.id} canEdit={canEdit}
              editing={editing === node.id} linkSource={linkFrom === node.id}
              onDown={(e, mode) => onNodeDown(e, node, mode)}
              onDoubleClick={() => startEdit(node)}
              onText={(t) => changeText(node.id, t)}
              onTextBlur={endEdit}
            />
          ))}

          {/* Peer cursors */}
          <CursorLayer cursors={cursors} peers={peers} w={CANVAS_W} h={CANVAS_H} />
        </div>
      </div>
    </div>
  );
}

// ---- Node rendering --------------------------------------------------------
function NodeView({ node, selected, canEdit, editing, linkSource, onDown, onDoubleClick, onText, onTextBlur }: {
  node: WbNode; selected: boolean; canEdit: boolean; editing: boolean; linkSource: boolean;
  onDown: (e: React.PointerEvent, mode: "move" | "resize") => void;
  onDoubleClick: () => void; onText: (t: string) => void; onTextBlur: () => void;
}) {
  const base: React.CSSProperties = {
    position: "absolute", left: node.x, top: node.y, width: node.w, height: node.h,
    boxSizing: "border-box", cursor: canEdit ? "move" : "default",
    outline: selected ? `2px solid ${color.primary}` : linkSource ? `2px dashed ${color.primary}` : "none",
    outlineOffset: 2,
  };
  const textInk = node.kind === "note" ? color.ink : node.kind === "text" ? (node.color ?? color.ink) : color.text;

  const shape = (): React.CSSProperties => {
    const fill = node.color ?? "#fff";
    const bordered = { background: fill, border: `1.5px solid ${color.border2}` };
    const centered = { display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" as const };
    if (CLIP[node.kind]) return { ...bordered, clipPath: CLIP[node.kind], ...centered, padding: 16 };
    switch (node.kind) {
      case "note":
        return { background: node.color ?? "#FFE8A3", borderRadius: 6, boxShadow: "0 2px 6px rgba(20,26,60,0.12)", padding: 10 };
      case "rect":
        return { ...bordered, borderRadius: 10, padding: 10 };
      case "pill":
        return { ...bordered, borderRadius: node.h / 2, padding: "8px 14px", ...centered };
      case "ellipse":
        return { ...bordered, borderRadius: "50%", padding: 12, ...centered };
      case "text":
        return { background: "transparent", padding: 4, display: "flex", alignItems: "center" };
      default:
        return {};
    }
  };

  const label = (extra?: React.CSSProperties) =>
    editing ? (
      <textarea
        autoFocus defaultValue={node.text ?? ""}
        onChange={(e) => onText(e.target.value)} onBlur={onTextBlur}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ width: "100%", height: "100%", resize: "none", border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: node.kind === "text" ? 15 : 12.5, color: textInk, textAlign: node.kind === "text" ? "left" : "center", ...extra }}
      />
    ) : (
      <div style={{ width: "100%", height: "100%", overflow: "hidden", fontSize: node.kind === "text" ? 15 : 12.5, fontWeight: node.kind === "text" ? 600 : 500, lineHeight: 1.35, color: textInk, whiteSpace: "pre-wrap", wordBreak: "break-word", display: "flex", alignItems: node.kind === "note" ? "flex-start" : "center", justifyContent: node.kind === "text" ? "flex-start" : "center", textAlign: node.kind === "text" ? "left" : "center", ...extra }}>
        {node.text || (node.kind === "text" ? "" : "")}
      </div>
    );

  // Freehand strokes render in the SVG layer; here we only need a transparent
  // hit box so the stroke can be selected, moved and deleted like any node.
  if (node.kind === "draw") {
    return (
      <div style={{ ...base, background: "transparent", cursor: canEdit ? "move" : "default" }}
        onPointerDown={(e) => onDown(e, "move")} title="Freehand drawing" />
    );
  }

  return (
    <div style={base} onPointerDown={(e) => onDown(e, "move")} onDoubleClick={onDoubleClick}>
      {node.kind === "icon" ? (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={node.icon ?? "rocket"} size={Math.max(16, Math.min(node.w, node.h) * 0.7)} color={node.color ?? color.primary} />
        </div>
      ) : node.kind === "actor" ? (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <ActorGlyph color={node.color && node.color !== "#FFFFFF" ? "#5B6472" : color.subtle} />
          <div style={{ fontSize: 11.5, fontWeight: 600, color: color.text, textAlign: "center", maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{node.text || "Actor"}</div>
        </div>
      ) : node.kind === "cylinder" ? (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <CylinderGlyph color={node.color ?? "#fff"} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>{label()}</div>
        </div>
      ) : (
        <div style={{ width: "100%", height: "100%", ...shape() }}>{label()}</div>
      )}

      {/* Resize handle */}
      {selected && canEdit && node.kind !== "text" && (
        <div onPointerDown={(e) => { e.stopPropagation(); onDown(e, "resize"); }}
          style={{ position: "absolute", right: -6, bottom: -6, width: 14, height: 14, borderRadius: 4, background: color.surface, border: `2px solid ${color.primary}`, cursor: "nwse-resize" }} />
      )}
    </div>
  );
}

// Flatten [x0,y0,x1,y1,…] into an SVG points attribute.
function pointsAttr(pts: number[]): string {
  let s = "";
  for (let i = 0; i + 1 < pts.length; i += 2) s += `${pts[i]},${pts[i + 1]} `;
  return s.trim();
}

// A database/cylinder shape drawn as scalable SVG.
function CylinderGlyph({ color: c }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block" }}>
      <path d="M4 14 A46 12 0 0 1 96 14 L96 86 A46 12 0 0 1 4 86 Z" fill={c} stroke="#c7ccd6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path d="M4 14 A46 12 0 0 0 96 14" fill="none" stroke="#c7ccd6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// A simple stick-figure actor drawn in SVG so it scales with the node.
function ActorGlyph({ color: c }: { color: string }) {
  return (
    <svg width={40} height={56} viewBox="0 0 40 56" fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
      <circle cx="20" cy="11" r="8" />
      <path d="M20 19v20M6 26h28M20 39l-9 13M20 39l9 13" />
    </svg>
  );
}

// Tiny glyph shown on each shape tool button.
function ShapeGlyph({ kind }: { kind: NodeKind }) {
  const s = 16;
  const outline = `2px solid ${color.text}`;
  const clip = (poly: string) => <div style={{ width: s, height: s, background: color.text, clipPath: poly }} />;
  if (kind === "note") return <div style={{ width: s, height: s, background: "#FFE8A3", borderRadius: 3, border: `1px solid rgba(20,26,60,0.15)` }} />;
  if (kind === "rect") return <div style={{ width: s, height: s - 3, border: outline, borderRadius: 3 }} />;
  if (kind === "pill") return <div style={{ width: s, height: s - 5, border: outline, borderRadius: 999 }} />;
  if (kind === "ellipse") return <div style={{ width: s, height: s - 2, border: outline, borderRadius: "50%" }} />;
  if (kind === "diamond") return <div style={{ width: s - 3, height: s - 3, border: outline, transform: "rotate(45deg)" }} />;
  if (kind === "triangle") return clip("polygon(50% 0, 100% 100%, 0 100%)");
  if (kind === "hexagon") return clip("polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)");
  if (kind === "parallelogram") return clip("polygon(22% 0, 100% 0, 78% 100%, 0 100%)");
  if (kind === "star") return clip("polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)");
  if (kind === "cylinder") return <Icon name="box" size={17} />;
  if (kind === "actor") return <Icon name="users" size={17} />;
  return <span style={{ fontFamily: font.head, fontWeight: 700, fontSize: 15, color: color.text }}>T</span>;
}

// A row in the Save/export dropdown.
function MenuRow({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", fontSize: 12.5, fontWeight: 500, fontFamily: "inherit", color: danger ? color.danger : color.text, background: "transparent", border: "none", borderRadius: 7, padding: "8px 9px", cursor: "pointer" }}>
      <Icon name={icon} size={14} /> {label}
    </button>
  );
}

function ToolBtn({ children, active, title, onClick }: { children: React.ReactNode; active: boolean; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick} aria-pressed={active}
      style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 8, cursor: "pointer", background: active ? color.primaryTint : "transparent", color: color.text, boxShadow: active ? `inset 0 0 0 1.5px ${color.primary}` : "none" }}>
      {children}
    </button>
  );
}

const actionBtn = (enabled: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
  color: enabled ? color.text : color.faint3, background: color.surface, border: `1px solid ${color.border}`,
  borderRadius: 9, padding: "8px 11px", cursor: enabled ? "pointer" : "not-allowed",
});

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "7px 12px", background: color.primaryTint, border: `1px solid ${color.primaryTint2}`, borderRadius: 8, fontSize: 12.5, color: color.primaryDark }}>
      <Icon name="info" size={14} /> {children}
    </div>
  );
}
function Esc() { return <span style={{ color: color.primary }}>Press Esc to cancel.</span>; }
