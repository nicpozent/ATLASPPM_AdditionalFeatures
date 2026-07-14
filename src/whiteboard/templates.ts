// ============================================================================
//  Whiteboard templates (ADR-0064). Each template is a pure builder that returns
//  a scene fragment (nodes + connectors) laid out around an origin, ready to drop
//  onto the canvas. Covers brainstorming shapes (mindmap, fishbone) and a starter
//  for every methodology in the tool (see CLAUDE.md §5) plus the named SDLC
//  models. No I/O — just geometry — so it stays trivially testable.
// ============================================================================
import { uid } from "./scene";
import { type WbNode, type WbEdge, type NodeKind, PALETTE } from "./types";

export interface Fragment { nodes: WbNode[]; edges: WbEdge[] }

// Small builder: add(kind,x,y,w,h,text,color) → id; link(a,b,color).
function builder() {
  const nodes: WbNode[] = [];
  const edges: WbEdge[] = [];
  const add = (kind: NodeKind, x: number, y: number, w: number, h: number, text?: string, color?: string) => {
    const id = uid();
    nodes.push({ id, kind, x: Math.round(x), y: Math.round(y), w, h, text, color });
    return id;
  };
  const link = (from: string, to: string, color?: string) => { edges.push({ id: uid("e"), from, to, color }); };
  return { nodes, edges, add, link };
}

const INK = "#8a93a6";

// ---- Brainstorm ------------------------------------------------------------
function mindmap(ox: number, oy: number): Fragment {
  const b = builder();
  const cx = ox + 340, cy = oy + 220;
  const root = b.add("ellipse", cx - 80, cy - 40, 160, 80, "Central idea", PALETTE[4]);
  const branches = ["Theme A", "Theme B", "Theme C", "Theme D"];
  const pos = [[-260, -140], [200, -140], [-260, 120], [200, 120]];
  branches.forEach((t, i) => {
    const [dx, dy] = pos[i];
    const nid = b.add("pill", cx + dx, cy + dy, 150, 56, t, PALETTE[i % PALETTE.length]);
    b.link(root, nid, INK);
    for (let k = 0; k < 2; k++) {
      const sx = cx + dx + (dx < 0 ? -170 : 170);
      const sub = b.add("note", sx, cy + dy - 10 + k * 74, 140, 60, "Sub-idea", PALETTE[0]);
      b.link(nid, sub, INK);
    }
  });
  return { nodes: b.nodes, edges: b.edges };
}

function fishbone(ox: number, oy: number): Fragment {
  const b = builder();
  const spineY = oy + 250;
  const headX = ox + 960;
  // The effect ("fish head") sits on the right; the backbone runs into it.
  b.add("hexagon", headX, spineY - 62, 168, 124, "Effect / Problem", PALETTE[1]);
  // Horizontal spine (backbone) drawn as a thin bar from the left to the head.
  const spineX0 = ox + 60;
  b.add("rect", spineX0, spineY - 3, headX - spineX0, 6, undefined, INK);
  // Six standard cause categories (6M): three ribs above, three below, each
  // attaching to the backbone at its own joint (stepping toward the head) — this
  // is what makes it an Ishikawa diagram rather than a hub-and-spoke.
  const cats = ["People", "Process", "Equipment", "Materials", "Environment", "Management"];
  const colX = [ox + 150, ox + 420, ox + 690];   // rib joints along the spine
  cats.forEach((c, i) => {
    const above = i < 3;
    const bx = colX[i % 3];
    const by = above ? spineY - 190 : spineY + 132;
    const cid = b.add("rect", bx, by, 156, 58, c, PALETTE[(i + 2) % PALETTE.length]);
    // Joint where this rib meets the backbone (small node on the spine).
    const joint = b.add("ellipse", bx + 71, spineY - 7, 14, 14, undefined, INK);
    b.link(cid, joint, INK);
    // A sub-cause offshoot further out along the rib.
    const cause = b.add("note", bx + 10, above ? by - 76 : by + 68, 136, 54, "Cause…", PALETTE[0]);
    b.link(cause, cid, INK);
  });
  return { nodes: b.nodes, edges: b.edges };
}

// ---- Generic linear / cyclic helpers ---------------------------------------
function linear(ox: number, oy: number, title: string, steps: string[], kind: NodeKind = "rect"): Fragment {
  const b = builder();
  b.add("text", ox, oy - 46, 300, 34, title, "#141a3c");
  let prev = "";
  steps.forEach((s, i) => {
    const id = b.add(kind, ox + i * 200, oy, 160, 70, s, PALETTE[i % PALETTE.length]);
    if (prev) b.link(prev, id, INK);
    prev = id;
  });
  return { nodes: b.nodes, edges: b.edges };
}

function cycle(ox: number, oy: number, title: string, steps: string[]): Fragment {
  const b = builder();
  const cx = ox + 320, cy = oy + 220, R = 190;
  b.add("text", ox + 200, oy - 20, 300, 34, title, "#141a3c");
  const ids = steps.map((s, i) => {
    const a = (i / steps.length) * Math.PI * 2 - Math.PI / 2;
    return b.add("pill", cx + Math.cos(a) * R - 80, cy + Math.sin(a) * R - 30, 160, 60, s, PALETTE[i % PALETTE.length]);
  });
  ids.forEach((id, i) => b.link(id, ids[(i + 1) % ids.length], INK));
  return { nodes: b.nodes, edges: b.edges };
}

// ---- Methodologies (CLAUDE.md §5) + named SDLC models ----------------------
// Waterfall cascades down-and-right (each phase spills into the next) — the shape
// the name implies, not a flat row.
function waterfall(ox: number, oy: number): Fragment {
  const b = builder();
  b.add("text", ox, oy - 46, 320, 34, "Waterfall", "#141a3c");
  const steps = ["Requirements", "Design", "Implementation", "Verification", "Maintenance"];
  let prev = "";
  steps.forEach((s, i) => {
    const id = b.add("rect", ox + i * 180, oy + i * 96, 168, 68, s, PALETTE[i % PALETTE.length]);
    if (prev) b.link(prev, id, INK);
    prev = id;
  });
  return { nodes: b.nodes, edges: b.edges };
}
const rad = (x: number, y: number) => linear(x, y, "RAD", ["Business modeling", "Data modeling", "Process modeling", "Application", "Testing & turnover"]);
const scrum = (x: number, y: number) => cycle(x, y, "Scrum", ["Product backlog", "Sprint planning", "Sprint", "Daily scrum", "Review", "Retrospective"]);
const iterative = (x: number, y: number) => cycle(x, y, "Iterative / Incremental", ["Plan", "Requirements", "Design", "Build", "Test", "Evaluate"]);
const devops = (x: number, y: number) => cycle(x, y, "DevOps", ["Plan", "Code", "Build", "Test", "Release", "Deploy", "Operate", "Monitor"]);

function stagegate(x: number, y: number): Fragment {
  const b = builder();
  b.add("text", x, y - 46, 300, 34, "Stage-Gate (G0–G5)", "#141a3c");
  let prev = "";
  for (let g = 0; g <= 5; g++) {
    const gate = b.add("diamond", x + g * 230, y, 96, 96, `G${g}`, PALETTE[3]);
    if (prev) b.link(prev, gate, INK);
    if (g < 5) {
      const stage = b.add("rect", x + g * 230 + 108, y + 12, 120, 64, `Stage ${g + 1}`, PALETTE[2]);
      b.link(gate, stage, INK);
      prev = stage;
    }
  }
  return { nodes: b.nodes, edges: b.edges };
}

function kanban(x: number, y: number): Fragment {
  const b = builder();
  b.add("text", x, y - 46, 300, 34, "Kanban", "#141a3c");
  ["Backlog", "To Do", "In Progress", "Review", "Done"].forEach((c, i) => {
    const colId = b.add("rect", x + i * 190, y, 170, 70, c, PALETTE[i % PALETTE.length]);
    for (let k = 0; k < 2; k++) b.add("note", x + i * 190 + 10, y + 84 + k * 66, 150, 56, "Card", PALETTE[0]);
    void colId;
  });
  return { nodes: b.nodes, edges: b.edges };
}

function scrumban(x: number, y: number): Fragment {
  const b = builder();
  b.add("text", x, y - 46, 320, 34, "Scrumban", "#141a3c");
  ["Backlog", "Ready (pull)", "In Progress (WIP)", "Review", "Done"].forEach((c, i) => {
    b.add("rect", x + i * 190, y, 170, 70, c, PALETTE[i % PALETTE.length]);
  });
  return { nodes: b.nodes, edges: b.edges };
}

function vmodel(x: number, y: number): Fragment {
  const b = builder();
  b.add("text", x + 250, y - 30, 300, 34, "V-Model", "#141a3c");
  const left = ["Requirements", "System design", "Architecture", "Module design"];
  const right = ["Unit testing", "Integration testing", "System testing", "Acceptance testing"];
  const leftIds: string[] = [], rightIds: string[] = [];
  left.forEach((t, i) => leftIds.push(b.add("rect", x + i * 70, y + i * 90, 150, 60, t, PALETTE[i % PALETTE.length])));
  const code = b.add("rect", x + 4 * 70 + 40, y + 4 * 90, 150, 60, "Coding", PALETTE[5]);
  right.forEach((t, i) => rightIds.push(b.add("rect", x + 560 - i * 70, y + (3 - i) * 90, 150, 60, t, PALETTE[i % PALETTE.length])));
  for (let i = 0; i < leftIds.length - 1; i++) b.link(leftIds[i], leftIds[i + 1], INK);
  b.link(leftIds[3], code, INK); b.link(code, rightIds[3], INK);
  for (let i = 3; i > 0; i--) b.link(rightIds[i], rightIds[i - 1], INK);
  // Verification/validation links across the V.
  left.forEach((_, i) => b.link(leftIds[i], rightIds[i], "#d9488b"));
  return { nodes: b.nodes, edges: b.edges };
}

function spiral(x: number, y: number): Fragment {
  const b = builder();
  const cx = x + 300, cy = y + 220;
  b.add("text", x + 180, y - 20, 300, 34, "Spiral", "#141a3c");
  const quad = [
    ["Determine objectives", -1, -1],
    ["Identify & resolve risks", 1, -1],
    ["Develop & test", 1, 1],
    ["Plan next iteration", -1, 1],
  ] as const;
  const ids = quad.map(([t, sx, sy], i) => b.add("rect", cx + (sx as number) * 200 - 80, cy + (sy as number) * 140 - 30, 170, 64, t as string, PALETTE[i % PALETTE.length]));
  ids.forEach((id, i) => b.link(id, ids[(i + 1) % ids.length], INK));
  b.add("ellipse", cx - 44, cy - 30, 88, 60, "Start", PALETTE[7]);
  return { nodes: b.nodes, edges: b.edges };
}

function safe(x: number, y: number): Fragment {
  const b = builder();
  b.add("text", x, y - 46, 400, 34, "SAFe (levels)", "#141a3c");
  const port = b.add("rect", x + 180, y, 200, 64, "Portfolio · Epics", PALETTE[4]);
  const prog = b.add("rect", x + 180, y + 110, 200, 64, "Program · ART / PI", PALETTE[2]);
  const team = b.add("rect", x + 180, y + 220, 200, 64, "Team · Stories", PALETTE[3]);
  b.link(port, prog, INK); b.link(prog, team, INK);
  ["Team A", "Team B", "Team C"].forEach((t, i) => { const tid = b.add("note", x + 40 + i * 150, y + 320, 130, 56, t, PALETTE[0]); b.link(team, tid, INK); });
  return { nodes: b.nodes, edges: b.edges };
}

export interface TemplateDef { key: string; label: string; group: string; build: (ox: number, oy: number) => Fragment }

export const TEMPLATES: TemplateDef[] = [
  { key: "mindmap", label: "Mind map", group: "Brainstorm", build: mindmap },
  { key: "fishbone", label: "Fishbone (Ishikawa)", group: "Brainstorm", build: fishbone },
  { key: "iterative", label: "Iterative / Incremental", group: "SDLC", build: iterative },
  { key: "spiral", label: "Spiral", group: "SDLC", build: spiral },
  { key: "waterfall", label: "Waterfall", group: "SDLC", build: waterfall },
  { key: "vmodel", label: "V-Model", group: "SDLC", build: vmodel },
  { key: "rad", label: "RAD", group: "SDLC", build: rad },
  { key: "devops", label: "DevOps", group: "SDLC", build: devops },
  { key: "scrum", label: "Scrum", group: "Agile", build: scrum },
  { key: "kanban", label: "Kanban", group: "Agile", build: kanban },
  { key: "scrumban", label: "Scrumban", group: "Agile", build: scrumban },
  { key: "safe", label: "SAFe", group: "Agile", build: safe },
  { key: "stagegate", label: "Stage-Gate (G0–G5)", group: "Governance", build: stagegate },
];
