// ============================================================================
//  Pure scene helpers (ADR-0064) — no React, no I/O, so they're unit-testable.
//  Every mutation returns a NEW scene (immutable updates) so React state and the
//  real-time refetch path stay predictable.
// ============================================================================
import { type Scene, type WbNode, type WbEdge, type NodeKind, defaultSize, defaultColor } from "./types";

// Short, URL/charset-safe id (matches the server's ^[A-Za-z0-9_-]{1,64}$).
export function uid(prefix = "n"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const t = Date.now().toString(36);
  return `${prefix}-${t}-${rand}`;
}

export function addNode(scene: Scene, kind: NodeKind, x: number, y: number, extra?: Partial<WbNode>): Scene {
  const { w, h } = defaultSize(kind);
  const node: WbNode = {
    id: uid(),
    kind,
    // Drop centred on the requested point.
    x: Math.round(x - w / 2),
    y: Math.round(y - h / 2),
    w, h,
    color: defaultColor(kind),
    ...(kind === "text" ? { text: "Text" } : {}),
    ...extra,
  };
  return { ...scene, nodes: [...scene.nodes, node] };
}

export function updateNode(scene: Scene, id: string, patch: Partial<WbNode>): Scene {
  return { ...scene, nodes: scene.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

export function removeNode(scene: Scene, id: string): Scene {
  return {
    nodes: scene.nodes.filter((n) => n.id !== id),
    // Drop any connectors that touched the removed node.
    edges: scene.edges.filter((e) => e.from !== id && e.to !== id),
  };
}

// Link two nodes. No self-links, no duplicate pair (either direction).
export function addEdge(scene: Scene, from: string, to: string, color?: string): Scene {
  if (from === to) return scene;
  if (scene.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from))) return scene;
  if (!scene.nodes.some((n) => n.id === from) || !scene.nodes.some((n) => n.id === to)) return scene;
  const edge: WbEdge = { id: uid("e"), from, to, color };
  return { ...scene, edges: [...scene.edges, edge] };
}

export function removeEdge(scene: Scene, id: string): Scene {
  return { ...scene, edges: scene.edges.filter((e) => e.id !== id) };
}

export interface Point { x: number; y: number }
export function center(n: WbNode): Point {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

// Clip a segment from a node's centre to the point where it meets the node's
// bounding box, so connectors touch the edge of a shape rather than its middle.
export function edgeEndpoints(a: WbNode, b: WbNode): { x1: number; y1: number; x2: number; y2: number } {
  const ca = center(a), cb = center(b);
  const p1 = boxIntersect(a, ca, cb);
  const p2 = boxIntersect(b, cb, ca);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

// Where the ray from a node's centre toward `toward` crosses the node's border.
function boxIntersect(n: WbNode, from: Point, toward: Point): Point {
  const dx = toward.x - from.x, dy = toward.y - from.y;
  if (dx === 0 && dy === 0) return from;
  const hw = n.w / 2, hh = n.h / 2;
  // Scale so the larger of |dx|/hw, |dy|/hh reaches 1 (the box edge).
  const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}
