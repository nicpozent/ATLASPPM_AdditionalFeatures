import { describe, it, expect } from "vitest";
import { addNode, updateNode, removeNode, addEdge, removeEdge, edgeEndpoints, uid } from "./scene";
import { EMPTY_SCENE, type Scene } from "./types";

describe("whiteboard scene helpers", () => {
  it("adds a node centred on the drop point", () => {
    const s = addNode(EMPTY_SCENE, "note", 300, 200);
    expect(s.nodes).toHaveLength(1);
    const n = s.nodes[0];
    expect(n.kind).toBe("note");
    // Centred: x + w/2 ≈ 300, y + h/2 ≈ 200.
    expect(n.x + n.w / 2).toBeCloseTo(300, 0);
    expect(n.y + n.h / 2).toBeCloseTo(200, 0);
    // Original scene is untouched (immutability).
    expect(EMPTY_SCENE.nodes).toHaveLength(0);
  });

  it("updates a node immutably", () => {
    const s1 = addNode(EMPTY_SCENE, "rect", 0, 0);
    const id = s1.nodes[0].id;
    const s2 = updateNode(s1, id, { x: 42, text: "hi" });
    expect(s2.nodes[0].x).toBe(42);
    expect(s2.nodes[0].text).toBe("hi");
    expect(s1.nodes[0].x).not.toBe(42);
  });

  it("removes a node and its connected edges", () => {
    let s: Scene = addNode(EMPTY_SCENE, "rect", 0, 0);
    s = addNode(s, "ellipse", 400, 0);
    const [a, b] = s.nodes;
    s = addEdge(s, a.id, b.id);
    expect(s.edges).toHaveLength(1);
    s = removeNode(s, a.id);
    expect(s.nodes).toHaveLength(1);
    expect(s.edges).toHaveLength(0); // dangling edge dropped
  });

  it("won't create self-links or duplicate connectors", () => {
    let s: Scene = addNode(EMPTY_SCENE, "rect", 0, 0);
    s = addNode(s, "rect", 300, 0);
    const [a, b] = s.nodes;
    s = addEdge(s, a.id, a.id);           // self-link ignored
    expect(s.edges).toHaveLength(0);
    s = addEdge(s, a.id, b.id);
    s = addEdge(s, b.id, a.id);           // reverse duplicate ignored
    expect(s.edges).toHaveLength(1);
  });

  it("removes an edge by id", () => {
    let s: Scene = addNode(EMPTY_SCENE, "rect", 0, 0);
    s = addNode(s, "rect", 300, 0);
    s = addEdge(s, s.nodes[0].id, s.nodes[1].id);
    const eid = s.edges[0].id;
    s = removeEdge(s, eid);
    expect(s.edges).toHaveLength(0);
  });

  it("clips connector endpoints to node borders", () => {
    const a = { id: "a", kind: "rect" as const, x: 0, y: 0, w: 100, h: 100 };
    const b = { id: "b", kind: "rect" as const, x: 300, y: 0, w: 100, h: 100 };
    const { x1, x2 } = edgeEndpoints(a, b);
    // a's right border is x=100, b's left border is x=300.
    expect(x1).toBeCloseTo(100, 0);
    expect(x2).toBeCloseTo(300, 0);
  });

  it("mints charset-safe ids", () => {
    for (let i = 0; i < 50; i++) expect(uid()).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });
});
