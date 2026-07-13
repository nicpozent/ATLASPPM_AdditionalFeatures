// ============================================================================
//  Whiteboard scene model (ADR-0064). A scene is a flat list of freeform nodes
//  (sticky notes, shapes, text, icons, actors) plus connectors between them.
//  Kept deliberately small and JSON-serialisable — it round-trips through the
//  REST API and is sanitised server-side (see server/Whiteboards.cs).
// ============================================================================
import { color } from "@/theme";

export type NodeKind = "note" | "rect" | "ellipse" | "diamond" | "actor" | "text" | "icon";

export interface WbNode {
  id: string;
  kind: NodeKind;
  x: number; y: number; w: number; h: number;
  text?: string;
  color?: string;   // #RRGGBB — fill for shapes/notes, ink for text/icon
  icon?: string;    // icon name (kind === "icon")
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

// Starter shape/tool set shown in the palette (order = toolbar order).
export const SHAPE_TOOLS: { kind: NodeKind; label: string }[] = [
  { kind: "note", label: "Sticky note" },
  { kind: "rect", label: "Rectangle" },
  { kind: "ellipse", label: "Ellipse" },
  { kind: "diamond", label: "Diamond" },
  { kind: "actor", label: "Actor" },
  { kind: "text", label: "Text" },
];

// Starter icon set — names must exist in components/Icon.tsx.
export const ICONS = [
  "rocket", "target", "flag", "bell", "alert", "clock",
  "coins", "building", "megaphone", "award", "globe", "users",
] as const;

// Default geometry per kind (px), used when a tool drops a new node.
export function defaultSize(kind: NodeKind): { w: number; h: number } {
  switch (kind) {
    case "note": return { w: 160, h: 150 };
    case "text": return { w: 180, h: 44 };
    case "icon": return { w: 64, h: 64 };
    case "actor": return { w: 96, h: 120 };
    case "ellipse": return { w: 150, h: 110 };
    case "diamond": return { w: 150, h: 120 };
    default: return { w: 170, h: 110 };
  }
}

export function defaultColor(kind: NodeKind): string {
  if (kind === "note") return PALETTE[0];
  if (kind === "text") return color.ink;
  if (kind === "icon") return color.primary;
  return "#FFFFFF";
}
