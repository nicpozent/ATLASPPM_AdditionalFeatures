import { describe, it, expect } from "vitest";
import { yearOf, yearColumns } from "./roadmap";

const item = (plannedYear: number, startDate = "") => ({ plannedYear, startDate });

describe("yearOf", () => {
  it("prefers the explicit planned year", () => {
    expect(yearOf(item(2027, "2030-01-01"))).toBe(2027);
  });
  it("falls back to the start-date year", () => {
    expect(yearOf(item(0, "2026-05-10"))).toBe(2026);
  });
  it("is 0 (unscheduled) with neither", () => {
    expect(yearOf(item(0, ""))).toBe(0);
    expect(yearOf(item(0, "not-a-date"))).toBe(0);
  });
});

describe("yearColumns", () => {
  it("always includes this year and next, ascending, de-duped", () => {
    expect(yearColumns([], 2026)).toEqual([2026, 2027]);
  });
  it("merges years present on items and sorts them", () => {
    const items = [item(2025), item(2030), item(0, "2028-03-01"), item(2026)];
    expect(yearColumns(items, 2026)).toEqual([2025, 2026, 2027, 2028, 2030]);
  });
  it("ignores unscheduled items", () => {
    expect(yearColumns([item(0), item(0, "")], 2026)).toEqual([2026, 2027]);
  });
});
