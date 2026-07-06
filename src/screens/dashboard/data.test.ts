import { describe, it, expect } from "vitest";
import { normalizeDashboard, EMPTY_DASHBOARD } from "./data";

// Guards the intermittent "Something went wrong" crash: a partial or null-field
// dashboard payload must be coalesced into a fully-shaped, render-safe object so
// no child dereferences a null array/record.
describe("normalizeDashboard", () => {
  it("returns the empty dataset for null/undefined", () => {
    expect(normalizeDashboard(null)).toEqual(EMPTY_DASHBOARD);
    expect(normalizeDashboard(undefined)).toEqual(EMPTY_DASHBOARD);
  });

  it("coalesces null array/record fields to safe defaults", () => {
    // A malformed payload — every collection nulled — used to crash the render.
    const bad = {
      kpis: null, health: null, pipeline: null, budget: null,
      projects: null, attention: null, activity: null, tasks: null, approvals: null,
    } as unknown as Parameters<typeof normalizeDashboard>[0];
    const d = normalizeDashboard(bad);
    expect(Array.isArray(d.projects)).toBe(true);
    expect(d.projects).toHaveLength(0);
    expect(d.attention).toEqual([]);
    expect(d.activity).toEqual([]);
    expect(d.tasks).toEqual([]);
    expect(d.approvals).toEqual([]);
    expect(d.kpis).toEqual({});
    expect(d.health).toEqual({});
    expect(d.pipeline).toEqual({});
    expect(d.budget).toBeNull();
  });

  it("coalesces null budget sub-arrays and a zero max", () => {
    const d = normalizeDashboard({
      budget: { allocated: "€1M", spent: "€0", spentPct: 0, months: null, planned: null, actual: null, max: 0 },
    } as unknown as Parameters<typeof normalizeDashboard>[0]);
    expect(d.budget).not.toBeNull();
    expect(d.budget!.months).toEqual([]);
    expect(d.budget!.planned).toEqual([]);
    expect(d.budget!.actual).toEqual([]);
    expect(d.budget!.max).toBe(1); // zero max would divide-by-zero the chart
  });

  it("preserves well-formed data unchanged", () => {
    const good = {
      kpis: { active: { value: "12", delta: "+2", good: true, spark: [1, 2, 3] } },
      health: { ontrack: { value: 5 } }, pipeline: { draft: { count: 3 } }, budget: null,
      projects: [{ id: "P1", name: "Alpha", dept: "IT", owner: "A", methodology: "Scrum", status: "green", health: "On track", progress: 40, budget: 100, spent: 50 }],
      attention: [], activity: [], tasks: [], approvals: [],
    } as unknown as Parameters<typeof normalizeDashboard>[0];
    const d = normalizeDashboard(good);
    expect(d.projects).toHaveLength(1);
    expect(d.projects[0].name).toBe("Alpha");
    expect(d.kpis.active.spark).toEqual([1, 2, 3]);
  });
});
