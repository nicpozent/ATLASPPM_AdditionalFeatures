import { describe, it, expect } from "vitest";
import { sceneToSvg } from "./exportScene";
import { type Scene } from "./types";

// The whiteboard exports to a standalone SVG. A scene is importable JSON, so a
// node's colour/points are attacker-controllable — they must never be able to
// break out of an SVG attribute and smuggle markup/script into the exported file.
describe("whiteboard SVG export sanitisation", () => {
  it("neutralises a malicious colour instead of interpolating it raw", () => {
    const scene: Scene = {
      nodes: [
        // A colour crafted to close the fill attribute and inject a script.
        { id: "n1", kind: "rect", x: 0, y: 0, w: 100, h: 60,
          color: '#000"><script>alert(1)</script>', text: "hi" } as any,
      ],
      edges: [],
    };
    const svg = sceneToSvg(scene);
    // The payload never reaches the output; the unsafe value is dropped for the
    // safe fallback fill.
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("alert(1)");
    expect(svg).toContain('fill="#ffffff"');
  });

  it("keeps a legitimate hex colour", () => {
    const scene: Scene = {
      nodes: [{ id: "n1", kind: "note", x: 0, y: 0, w: 100, h: 60, color: "#FFE8A3" } as any],
      edges: [],
    };
    expect(sceneToSvg(scene)).toContain('fill="#FFE8A3"');
  });

  it("coerces freehand points to numbers so they can't inject markup", () => {
    const scene: Scene = {
      nodes: [{ id: "d1", kind: "draw", x: 0, y: 0, w: 60, h: 40,
        points: [10, 10, '5"/><script>x</script>', 30] } as any],
      edges: [],
    };
    const svg = sceneToSvg(scene);
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("</script>");
  });
});
