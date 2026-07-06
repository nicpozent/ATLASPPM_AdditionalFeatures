import { describe, it, expect } from "vitest";
import {
  parseTs, toDisplay, confColor, isOverAllocated, iterationTotals, objectiveRollup,
  timelineSpan, barPos, monthTicks, type Iteration, type Objective, type IncrementDetail,
} from "./data";
import { chart } from "@/theme";

const iter = (o: Partial<Iteration>): Iteration =>
  ({ id: 1, name: "I", startDate: "", endDate: "", capacity: 0, load: 0, ...o });
const obj = (o: Partial<Objective>): Objective =>
  ({ id: 1, title: "T", description: "", entityType: "", entityId: "", entityName: "",
     businessValue: 0, actualValue: 0, committed: true, confidence: 0, status: "Planned", ...o });

describe("parseTs / toDisplay", () => {
  it("parses ISO dates at midnight and rejects junk", () => {
    expect(parseTs("2026-07-01")).toBe(Date.parse("2026-07-01T00:00:00"));
    expect(parseTs("")).toBeNull();
    expect(parseTs(undefined)).toBeNull();
    expect(parseTs("not-a-date")).toBeNull();
  });
  it("formats ISO dates and falls back gracefully", () => {
    expect(toDisplay("2026-09-30")).toBe("30 Sep 2026");
    expect(toDisplay("")).toBe("—");
    expect(toDisplay("garbage")).toBe("garbage");
  });
});

describe("confColor", () => {
  it("maps the fist-of-five vote to a status colour", () => {
    expect(confColor(5)).toBe(chart.onTrack);
    expect(confColor(4)).toBe(chart.onTrack);
    expect(confColor(3)).toBe(chart.atRisk);
    expect(confColor(2)).toBe(chart.critical);
    expect(confColor(1)).toBe(chart.critical);
    expect(confColor(0)).toBe(chart.onHold);
  });
});

describe("isOverAllocated / iterationTotals", () => {
  it("flags an iteration only when load exceeds a non-zero capacity", () => {
    expect(isOverAllocated(iter({ capacity: 40, load: 50 }))).toBe(true);
    expect(isOverAllocated(iter({ capacity: 40, load: 40 }))).toBe(false);
    expect(isOverAllocated(iter({ capacity: 0, load: 10 }))).toBe(false); // capacity unset
  });
  it("sums capacity/load and computes headroom, %loaded and over", () => {
    const t = iterationTotals([iter({ capacity: 40, load: 30 }), iter({ capacity: 20, load: 25 })]);
    expect(t.capacity).toBe(60);
    expect(t.load).toBe(55);
    expect(t.headroom).toBe(5);
    expect(t.loadedPct).toBe(92);
    expect(t.over).toBe(false);
  });
  it("reports over-allocation across the increment", () => {
    const t = iterationTotals([iter({ capacity: 10, load: 20 })]);
    expect(t.over).toBe(true);
    expect(t.headroom).toBe(-10);
  });
  it("handles the empty case without dividing by zero", () => {
    const t = iterationTotals([]);
    expect(t).toEqual({ capacity: 0, load: 0, headroom: 0, loadedPct: 0, over: false });
  });
});

describe("objectiveRollup", () => {
  it("splits committed vs stretch and rolls up value + confidence", () => {
    const r = objectiveRollup([
      obj({ committed: true, businessValue: 8, confidence: 4, status: "Done" }),
      obj({ committed: true, businessValue: 5, confidence: 2, status: "In Progress" }),
      obj({ committed: false, businessValue: 3, confidence: 5, status: "Planned" }),
    ]);
    expect(r.committed).toHaveLength(2);
    expect(r.stretch).toHaveLength(1);
    expect(r.plannedBV).toBe(13);          // committed only
    expect(r.doneBV).toBe(8);              // committed & Done
    expect(r.meanConf).toBe(3);            // (4+2)/2 — stretch excluded
  });
  it("ignores unvoted objectives in mean confidence", () => {
    const r = objectiveRollup([
      obj({ committed: true, confidence: 0 }),
      obj({ committed: true, confidence: 4 }),
    ]);
    expect(r.meanConf).toBe(4);            // the confidence:0 (unvoted) is excluded
  });
  it("returns zero mean confidence when nothing is voted", () => {
    expect(objectiveRollup([obj({ confidence: 0 })]).meanConf).toBe(0);
  });
});

describe("timelineSpan / barPos / monthTicks", () => {
  const inc = { startDate: "2026-07-01", endDate: "2026-09-30" } as Pick<IncrementDetail, "startDate" | "endDate">;

  it("spans the increment, widened to cover outlying iterations", () => {
    const { min, max, total } = timelineSpan(inc, [iter({ startDate: "2026-06-15", endDate: "2026-10-15" })]);
    expect(min).toBe(parseTs("2026-06-15"));
    expect(max).toBe(parseTs("2026-10-15"));
    expect(total).toBe(max! - min!);
  });
  it("returns nulls when there are no dates at all", () => {
    expect(timelineSpan({ startDate: "", endDate: "" }, [])).toEqual({ min: null, max: null, total: null });
  });

  it("positions a bar as left/width percentages within the span", () => {
    const { min, total } = timelineSpan(inc, []);
    const p = barPos(min, total, parseTs("2026-07-01"), parseTs("2026-09-30"));
    expect(p).not.toBeNull();
    expect(p!.left).toBe(0);
    expect(p!.width).toBeCloseTo(100, 5);
  });
  it("gives a minimum width and returns null when unplaceable", () => {
    const { min, total } = timelineSpan(inc, []);
    const point = barPos(min, total, parseTs("2026-07-01"), null);
    expect(point!.width).toBeGreaterThanOrEqual(2);
    expect(barPos(null, null, 1, 2)).toBeNull();
    expect(barPos(0, 0, 1, 2)).toBeNull();      // zero-length span
  });

  it("produces one month tick per month across the span", () => {
    const { min, max, total } = timelineSpan(inc, []);
    const ticks = monthTicks(min, max, total);
    expect(ticks.map((t) => t.label)).toEqual(["Jul 26", "Aug 26", "Sep 26"]);
    expect(ticks[0].pct).toBe(0);
  });
  it("returns no ticks for an empty span", () => {
    expect(monthTicks(null, null, null)).toEqual([]);
  });
});
