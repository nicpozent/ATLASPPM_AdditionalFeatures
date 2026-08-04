// ============================================================================
//  NOTE: literal #RRGGBB hex is intentional here — the exported SVG/PNG leaves the
//  app and cannot carry CSS variables. Allowlisted from the eslint colour ban.
//  Whiteboard export / import (ADR-0064). Dependency-free: the scene is our own
//  model, so we serialise it to JSON (perfect fidelity, re-importable) and to a
//  standalone SVG, then rasterise that SVG to PNG via a canvas. No html-to-image
//  or other library — nothing leaves the browser.
// ============================================================================
import { type Scene, type WbNode, type NodeKind } from "./types";

// Polygon vertices (as fractions of the node box) for clip-path shapes — kept in
// sync with CLIP in types.ts so SVG export matches the on-screen rendering.
const POLY: Partial<Record<NodeKind, [number, number][]>> = {
  diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  triangle: [[0.5, 0.02], [1, 1], [0, 1]],
  hexagon: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]],
  parallelogram: [[0.22, 0], [1, 0], [0.78, 1], [0, 1]],
  star: [[0.5, 0], [0.61, 0.35], [0.98, 0.35], [0.68, 0.57], [0.79, 0.91], [0.5, 0.7], [0.21, 0.91], [0.32, 0.57], [0.02, 0.35], [0.39, 0.35]],
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Whitelist a colour to a known-safe CSS syntax (hex / rgb[a] / hsl[a] / a bare
// named colour). A scene is importable JSON, so a node's colour is attacker-
// controllable; interpolated raw into an SVG `fill="…"` a value like
// `#000"><script>…` would break out of the attribute and run when the exported
// .svg is opened. Anything not matching falls back to a safe default.
const SAFE_COLOR = /^#[0-9a-f]{3,8}$|^rgba?\([\d.,\s%]+\)$|^hsla?\([\d.,\s%]+\)$|^[a-z]+$/i;
const col = (c: string | undefined, fallback: string) =>
  c && SAFE_COLOR.test(c.trim()) ? c.trim() : fallback;
// Coerce a coordinate to a finite number so an imported point can't inject
// markup through a path `d` attribute either.
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function wrapText(x: number, y: number, w: number, text: string, ink: string, align: "start" | "middle"): string {
  const lines = text.split("\n").slice(0, 12);
  const anchorX = align === "middle" ? x + w / 2 : x + 6;
  return lines.map((ln, i) =>
    `<text x="${anchorX}" y="${y + 16 + i * 15}" font-family="sans-serif" font-size="12" fill="${col(ink, "#141a3c")}" text-anchor="${align}">${esc(ln.slice(0, 80))}</text>`).join("");
}

function nodeSvg(n: WbNode): string {
  const fill = col(n.color, "#ffffff");
  const stroke = "#c7ccd6";
  const box = { x: n.x, y: n.y, w: n.w, h: n.h };
  switch (n.kind) {
    case "note":
      return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="6" fill="${fill}"/>${wrapText(box.x, box.y + 4, box.w, n.text || "", "#141a3c", "start")}`;
    case "rect": case "pill": {
      const rx = n.kind === "pill" ? Math.min(box.h, box.w) / 2 : 10;
      return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>${wrapText(box.x, box.y + box.h / 2 - 8, box.w, n.text || "", "#2a3040", "middle")}`;
    }
    case "ellipse":
      return `<ellipse cx="${box.x + box.w / 2}" cy="${box.y + box.h / 2}" rx="${box.w / 2}" ry="${box.h / 2}" fill="${fill}" stroke="${stroke}"/>${wrapText(box.x, box.y + box.h / 2 - 8, box.w, n.text || "", "#2a3040", "middle")}`;
    case "cylinder": {
      const ry = Math.min(16, box.h / 4);
      return `<path d="M${box.x} ${box.y + ry} A ${box.w / 2} ${ry} 0 0 1 ${box.x + box.w} ${box.y + ry} L ${box.x + box.w} ${box.y + box.h - ry} A ${box.w / 2} ${ry} 0 0 1 ${box.x} ${box.y + box.h - ry} Z" fill="${fill}" stroke="${stroke}"/>`
        + `<ellipse cx="${box.x + box.w / 2}" cy="${box.y + ry}" rx="${box.w / 2}" ry="${ry}" fill="${fill}" stroke="${stroke}"/>${wrapText(box.x, box.y + box.h / 2 - 8, box.w, n.text || "", "#2a3040", "middle")}`;
    }
    case "diamond": case "triangle": case "hexagon": case "parallelogram": case "star": {
      const pts = (POLY[n.kind] || []).map(([fx, fy]) => `${box.x + fx * box.w},${box.y + fy * box.h}`).join(" ");
      return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}"/>${wrapText(box.x, box.y + box.h / 2 - 8, box.w, n.text || "", "#2a3040", "middle")}`;
    }
    case "text":
      return wrapText(box.x - 6, box.y, box.w, n.text || "", n.color || "#141a3c", "start");
    case "actor": {
      const cx = box.x + box.w / 2, top = box.y + 6, r = 10;
      return `<g stroke="#5b6472" stroke-width="2.4" fill="none" stroke-linecap="round"><circle cx="${cx}" cy="${top + r}" r="${r}"/>`
        + `<path d="M${cx} ${top + 2 * r} v20 M${cx - 14} ${top + 2 * r + 6} h28 M${cx} ${top + 2 * r + 20} l-9 13 M${cx} ${top + 2 * r + 20} l9 13"/></g>`
        + wrapText(box.x, box.y + box.h - 18, box.w, n.text || "Actor", "#2a3040", "middle");
    }
    case "icon":
      return `<circle cx="${box.x + box.w / 2}" cy="${box.y + box.h / 2}" r="${Math.min(box.w, box.h) / 2 - 2}" fill="none" stroke="${col(n.color, "#5b7cfa")}" stroke-width="2"/>`;
    case "draw": {
      if (!n.points || n.points.length < 2) return "";
      const d = n.points.reduce((acc, v, i) => acc + (i % 2 === 0 ? (i === 0 ? "M" : "L") + num(v) : " " + num(v) + " "), "");
      return `<path d="${d}" fill="none" stroke="${col(n.color, "#5b7cfa")}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    default:
      return "";
  }
}

// Build a standalone SVG string for the whole scene, tightly cropped with a margin.
export function sceneToSvg(scene: Scene): string {
  const M = 40;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of scene.nodes) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
  }
  if (!isFinite(minX)) { minX = minY = 0; maxX = maxY = 400; }
  minX -= M; minY -= M; maxX += M; maxY += M;
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);

  const edges = scene.edges.map((e) => {
    const a = scene.nodes.find((n) => n.id === e.from), b = scene.nodes.find((n) => n.id === e.to);
    if (!a || !b) return "";
    const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2, x2 = b.x + b.w / 2, y2 = b.y + b.h / 2;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col(e.color, "#8a93a6")}" stroke-width="2" marker-end="url(#arw)"/>`;
  }).join("");
  const nodes = scene.nodes.map(nodeSvg).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX} ${minY} ${w} ${h}">`
    + `<defs><marker id="arw" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#8a93a6"/></marker></defs>`
    + `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#ffffff"/>${edges}${nodes}</svg>`;
}

export function sceneToJson(scene: Scene): string {
  return JSON.stringify({ version: 1, ...scene }, null, 2);
}

// Parse an imported JSON scene, tolerating unknown fields.
export function jsonToScene(text: string): Scene {
  const raw = JSON.parse(text) as Partial<Scene>;
  return { nodes: Array.isArray(raw.nodes) ? raw.nodes : [], edges: Array.isArray(raw.edges) ? raw.edges : [] };
}

// Trigger a browser download of a blob.
function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(scene: Scene, name: string) {
  download(`${name}.json`, new Blob([sceneToJson(scene)], { type: "application/json" }));
}

export function downloadSvg(scene: Scene, name: string) {
  download(`${name}.svg`, new Blob([sceneToSvg(scene)], { type: "image/svg+xml" }));
}

// Rasterise the SVG to a PNG via an offscreen canvas (self-contained SVG only).
export function downloadPng(scene: Scene, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const svg = sceneToSvg(scene);
    const img = new Image();
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    img.onload = () => {
      const scale = 2; // crisp export
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no 2d context")); return; }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => { if (blob) { download(`${name}.png`, blob); resolve(); } else reject(new Error("toBlob failed")); }, "image/png");
    };
    img.onerror = () => reject(new Error("render failed"));
    img.src = url;
  });
}
