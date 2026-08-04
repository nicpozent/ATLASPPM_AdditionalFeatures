// ============================================================================
//  NOTE: the PALETTE/SHAPES constants below carry literal #RRGGBB by design (persisted
//  scene data validated server-side). Allowlisted from the eslint colour ban.
//  Whiteboard scene model (ADR-0064). A scene is a flat list of freeform nodes
//  (sticky notes, shapes, text, icons, actors) plus connectors between them.
//  Kept deliberately small and JSON-serialisable — it round-trips through the
//  REST API and is sanitised server-side (see server/Platform/Whiteboards.cs).
// ============================================================================
import { color } from "@/theme";

export type NodeKind =
  | "note" | "rect" | "ellipse" | "diamond" | "actor" | "text" | "icon"
  | "triangle" | "hexagon" | "parallelogram" | "star" | "cylinder" | "pill" | "draw";

export interface WbNode {
  id: string;
  kind: NodeKind;
  x: number; y: number; w: number; h: number;
  text?: string;
  color?: string;    // #RRGGBB — fill for shapes/notes, ink for text/icon/draw
  icon?: string;     // icon name (kind === "icon")
  points?: number[]; // freehand polyline [x0,y0,x1,y1,…] in absolute coords (kind === "draw")
}

export interface WbEdge { id: string; from: string; to: string; color?: string }
export interface Scene { nodes: WbNode[]; edges: WbEdge[] }

export const EMPTY_SCENE: Scene = { nodes: [], edges: [] };

// A warm, on-brand palette (hand-picked to sit well on the app surface; every
// value is a literal #RRGGBB so the server's colour validator accepts it).
export const PALETTE = [
  "#FFE8A3", // sticky yellow
  "#FFD1DC", // pink
  "#C8E7FF", // sky
  "#CDEFD6", // mint
  "#E4D4FF", // lilac
  "#FFD8B0", // peach
  "#D7DCE5", // slate
  "#FFFFFF", // white
] as const;

// ----------------------------------------------------------------------------
//  Single source of truth for every NodeKind (ADR-0064 shape registry).
//  One row per kind — label, whether it appears in the toolbar, optional
//  clip-path polygon, default drop geometry and default colour. Everything
//  downstream (CLIP, SHAPE_TOOLS, defaultSize, defaultColor) is DERIVED from
//  this map, and the `Record<NodeKind, …>` type forces every new kind to be
//  described here (no silent misses). Kept in toolbar order so SHAPE_TOOLS
//  reads straight off it. The server keeps a matching whitelist
//  (server/Platform/Whiteboards.cs `Kinds`) — a test guards the two against drift.
// ----------------------------------------------------------------------------
export interface ShapeSpec {
  /** Human label shown in the toolbar / a11y name. */
  label: string;
  /** True when the kind is offered as a drop tool in the palette toolbar. */
  inTools: boolean;
  /** CSS clip-path polygon() for non-rectangular shapes (absent = plain box/oval). */
  clip?: string;
  /** Geometry (px) applied when a tool drops a fresh node. */
  size: { w: number; h: number };
  /** Fill (shapes/notes) or ink (text/icon/draw) applied to a fresh node. */
  color: string;
}

export const SHAPES: Record<NodeKind, ShapeSpec> = {
  note:          { label: "Sticky note",   inTools: true,  size: { w: 160, h: 150 }, color: PALETTE[0] },
  rect:          { label: "Rectangle",     inTools: true,  size: { w: 170, h: 110 }, color: "#FFFFFF" },
  pill:          { label: "Rounded",       inTools: true,  size: { w: 170, h: 70 },  color: "#FFFFFF" },
  ellipse:       { label: "Ellipse",       inTools: true,  size: { w: 150, h: 110 }, color: "#FFFFFF" },
  diamond:       { label: "Diamond",       inTools: true,  size: { w: 140, h: 120 }, color: "#FFFFFF", clip: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" },
  triangle:      { label: "Triangle",      inTools: true,  size: { w: 140, h: 120 }, color: "#FFFFFF", clip: "polygon(50% 2%, 100% 100%, 0 100%)" },
  hexagon:       { label: "Hexagon",       inTools: true,  size: { w: 140, h: 120 }, color: "#FFFFFF", clip: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)" },
  parallelogram: { label: "Parallelogram", inTools: true,  size: { w: 170, h: 110 }, color: "#FFFFFF", clip: "polygon(22% 0, 100% 0, 78% 100%, 0 100%)" },
  star:          { label: "Star",          inTools: true,  size: { w: 140, h: 120 }, color: "#FFFFFF", clip: "polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)" },
  cylinder:      { label: "Cylinder / DB", inTools: true,  size: { w: 130, h: 130 }, color: "#FFFFFF" },
  actor:         { label: "Actor",         inTools: true,  size: { w: 96,  h: 120 }, color: "#FFFFFF" },
  text:          { label: "Text",          inTools: true,  size: { w: 180, h: 44 },  color: color.ink },
  icon:          { label: "Icon",          inTools: false, size: { w: 64,  h: 64 },  color: color.primary },
  draw:          { label: "Freehand",      inTools: false, size: { w: 2,   h: 2 },   color: color.primary },
};

// Shapes rendered via a CSS clip-path polygon (derived — the value is the polygon()).
// sync target for exportScene.ts's SVG export (matches the on-screen rendering).
export const CLIP: Partial<Record<NodeKind, string>> = Object.fromEntries(
  (Object.entries(SHAPES) as [NodeKind, ShapeSpec][])
    .filter(([, s]) => s.clip)
    .map(([k, s]) => [k, s.clip!]),
) as Partial<Record<NodeKind, string>>;

// Shape/tool set shown in the palette (order = toolbar order = registry order).
export const SHAPE_TOOLS: { kind: NodeKind; label: string }[] =
  (Object.entries(SHAPES) as [NodeKind, ShapeSpec][])
    .filter(([, s]) => s.inTools)
    .map(([kind, s]) => ({ kind, label: s.label }));

// Starter icon set — names must exist in components/Icon.tsx.
export const ICONS = [
  "rocket", "target", "flag", "bell", "alert", "clock",
  "coins", "building", "megaphone", "award", "globe", "users",
] as const;

// Default geometry per kind (px), used when a tool drops a new node.
export function defaultSize(kind: NodeKind): { w: number; h: number } {
  return { ...SHAPES[kind].size };
}

export function defaultColor(kind: NodeKind): string {
  return SHAPES[kind].color;
}
