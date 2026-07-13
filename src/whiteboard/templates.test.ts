import { describe, it, expect } from "vitest";
import { TEMPLATES } from "./templates";

describe("whiteboard templates", () => {
  it("exposes the named brainstorm + methodology templates", () => {
    const keys = TEMPLATES.map((t) => t.key);
    for (const k of ["mindmap", "fishbone", "iterative", "spiral", "waterfall", "vmodel", "scrum", "kanban", "stagegate", "devops", "safe", "scrumban", "rad"])
      expect(keys).toContain(k);
  });

  it("every template builds valid, self-consistent nodes and edges", () => {
    for (const t of TEMPLATES) {
      const { nodes, edges } = t.build(100, 100);
      expect(nodes.length, `${t.key} has nodes`).toBeGreaterThan(0);
      const ids = new Set(nodes.map((n) => n.id));
      // No duplicate node ids.
      expect(ids.size).toBe(nodes.length);
      for (const n of nodes) {
        expect(n.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
        expect(n.w).toBeGreaterThan(0);
        expect(n.h).toBeGreaterThan(0);
        expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
      }
      // Every connector references real endpoints (no dangling arrows).
      for (const e of edges) {
        expect(ids.has(e.from), `${t.key} edge from`).toBe(true);
        expect(ids.has(e.to), `${t.key} edge to`).toBe(true);
        expect(e.from).not.toBe(e.to);
      }
    }
  });
});
