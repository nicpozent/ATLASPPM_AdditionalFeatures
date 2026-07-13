import { describe, it, expect } from "vitest";
import { summariseThemes, type SoaControl } from "./soa";

const THEMES = ["Organizational", "People", "Physical", "Technological"] as const;

const c = (ref: string, theme: string, applicable: boolean, status: string): SoaControl =>
  ({ ref, title: ref, theme, applicable, justification: "", status, owner: "" });

describe("summariseThemes", () => {
  it("groups controls by theme in the given order and drops empty themes", () => {
    const controls = [
      c("A.5.1", "Organizational", true, "Implemented"),
      c("A.8.1", "Technological", true, "Planned"),
      c("A.5.2", "Organizational", true, "Not started"),
    ];
    const out = summariseThemes(controls, THEMES);
    expect(out.map((t) => t.theme)).toEqual(["Organizational", "Technological"]); // People/Physical dropped
    expect(out[0].count).toBe(2);
    expect(out[0].controls.map((x) => x.ref)).toEqual(["A.5.1", "A.5.2"]);
  });

  it("counts applicable and implemented per theme", () => {
    const controls = [
      c("A.5.1", "Organizational", true, "Implemented"),
      c("A.5.2", "Organizational", true, "Partial"),
      c("A.5.3", "Organizational", false, "Not started"), // excluded → not applicable
    ];
    const [org] = summariseThemes(controls, THEMES);
    expect(org.count).toBe(3);
    expect(org.applicable).toBe(2);
    expect(org.implemented).toBe(1);
  });

  it("does not count an excluded control as implemented even if its status says so", () => {
    // Applicability wins: a control marked Implemented but not applicable is not
    // counted toward implemented coverage.
    const controls = [c("A.7.1", "Physical", false, "Implemented")];
    const [phys] = summariseThemes(controls, THEMES);
    expect(phys.applicable).toBe(0);
    expect(phys.implemented).toBe(0);
  });

  it("returns an empty array when there are no controls", () => {
    expect(summariseThemes([], THEMES)).toEqual([]);
  });
});
