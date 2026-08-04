import { describe, it, expect } from "vitest";
import { SHAPES, CLIP, SHAPE_TOOLS, defaultSize, defaultColor, PALETTE, type NodeKind } from "./types";
import { color } from "@/theme";

// ADR-0064 shape registry (R12 / #98). SHAPES is the single source of truth for
// every NodeKind; CLIP / SHAPE_TOOLS / defaultSize / defaultColor are DERIVED
// from it. These tests lock the derivation and the canonical kind set (the
// server keeps a matching whitelist — WhiteboardKindDriftTests guards the pair).

const CANONICAL: NodeKind[] = [
  "note", "rect", "ellipse", "diamond", "actor", "text", "icon",
  "triangle", "hexagon", "parallelogram", "star", "cylinder", "pill", "draw",
];

describe("whiteboard shape registry", () => {
  it("describes exactly the canonical set of kinds", () => {
    expect(Object.keys(SHAPES).sort()).toEqual([...CANONICAL].sort());
  });

  it("gives every kind a positive default size", () => {
    for (const k of CANONICAL) {
      const { w, h } = defaultSize(k);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
    }
  });

  it("derives defaultSize from the registry", () => {
    expect(defaultSize("note")).toEqual({ w: 160, h: 150 });
    expect(defaultSize("draw")).toEqual({ w: 2, h: 2 });
    // returns a fresh object (callers translate/mutate it)
    expect(defaultSize("note")).not.toBe(defaultSize("note"));
  });

  it("derives defaultColor from the registry", () => {
    expect(defaultColor("note")).toBe(PALETTE[0]);
    expect(defaultColor("text")).toBe(color.ink);
    expect(defaultColor("icon")).toBe(color.primary);
    expect(defaultColor("draw")).toBe(color.primary);
    expect(defaultColor("rect")).toBe(PALETTE[7]); // white
  });

  it("derives CLIP from exactly the clipped shapes", () => {
    expect(Object.keys(CLIP).sort()).toEqual(
      ["diamond", "hexagon", "parallelogram", "star", "triangle"].sort(),
    );
    for (const k of Object.keys(CLIP) as NodeKind[]) {
      expect(CLIP[k]).toBe(SHAPES[k].clip);
      expect(CLIP[k]).toMatch(/^polygon\(/);
    }
  });

  it("derives the toolbar from inTools, in registry order", () => {
    const expected = (Object.keys(SHAPES) as NodeKind[]).filter((k) => SHAPES[k].inTools);
    expect(SHAPE_TOOLS.map((t) => t.kind)).toEqual(expected);
    // icon + draw are internal kinds, never offered as drop tools
    expect(SHAPE_TOOLS.map((t) => t.kind)).not.toContain("icon");
    expect(SHAPE_TOOLS.map((t) => t.kind)).not.toContain("draw");
    // labels come straight off the registry
    for (const t of SHAPE_TOOLS) expect(t.label).toBe(SHAPES[t.kind].label);
  });
});
