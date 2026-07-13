import { describe, it, expect } from "vitest";
import {
  MONTHS, MAX_SPAN, monthOfIso, absOfIso, ymToAbs, absToYm, monthAbbr, yearOf,
  anchored, makeWindow, spanPct, barGeom, segPct, centerPct, type Win,
} from "./model";

describe("gantt absolute-month conversions", () => {
  it("round-trips YYYY-MM ↔ absolute month (1-based in/out, 0-based index)", () => {
    expect(ymToAbs("2026-01")).toBe(2026 * 12 + 0);
    expect(ymToAbs("2026-12")).toBe(2026 * 12 + 11);
    expect(absToYm(2026 * 12 + 0)).toBe("2026-01");
    expect(absToYm(2026 * 12 + 11)).toBe("2026-12");
    expect(absToYm(ymToAbs("2030-07"))).toBe("2030-07");
  });

  it("reads ISO dates into month-of-year and absolute month", () => {
    expect(monthOfIso("2026-03-15")).toBe(2); // March = index 2
    expect(absOfIso("2026-03-15")).toBe(2026 * 12 + 2);
    expect(yearOf(absOfIso("2027-05-01")!)).toBe(2027);
  });

  it("returns null for empty / invalid dates", () => {
    expect(monthOfIso("")).toBeNull();
    expect(monthOfIso("not-a-date")).toBeNull();
    expect(absOfIso(null)).toBeNull();
    expect(absOfIso(undefined)).toBeNull();
    expect(absOfIso("garbage")).toBeNull();
  });

  it("names months and wraps negatives correctly", () => {
    expect(monthAbbr(2026 * 12 + 0)).toBe("Jan");
    expect(monthAbbr(2026 * 12 + 11)).toBe("Dec");
    expect(monthAbbr(-1)).toBe(MONTHS[11]); // wrap: one before Jan is Dec
  });

  it("anchors a bare month-of-year onto a base", () => {
    expect(anchored(2026 * 12, 4)).toBe(2026 * 12 + 4);
  });
});

describe("makeWindow", () => {
  it("spans inclusive of both ends", () => {
    expect(makeWindow("2026-01", "2026-12")).toEqual({ start: ymToAbs("2026-01"), span: 12 });
    expect(makeWindow("2026-01", "2026-01")).toEqual({ start: ymToAbs("2026-01"), span: 1 });
  });

  it("crosses year boundaries", () => {
    expect(makeWindow("2027-06", "2030-05")).toEqual({ start: ymToAbs("2027-06"), span: 36 });
  });

  it("clamps a reversed range to a minimum of one month", () => {
    expect(makeWindow("2026-06", "2026-01").span).toBe(1);
  });

  it("caps the span at MAX_SPAN (5 years)", () => {
    expect(makeWindow("2020-01", "2030-01").span).toBe(MAX_SPAN);
  });
});

describe("spanPct / barGeom / segPct geometry", () => {
  const win: Win = { start: ymToAbs("2026-01"), span: 12 }; // Jan..Dec 2026

  const jan = ymToAbs("2026-01");
  const apr = ymToAbs("2026-04");
  const dec = ymToAbs("2026-12");

  it("places a full-window span at 0%..100%", () => {
    expect(spanPct(jan, dec, win)).toEqual({ left: 0, width: 100 });
  });

  it("places an interior span proportionally (inclusive months)", () => {
    // Apr..Apr = 1 of 12 months, starting at index 3.
    const g = spanPct(apr, apr, win)!;
    expect(g.left).toBeCloseTo(25, 5);   // 3/12
    expect(g.width).toBeCloseTo(100 / 12, 5); // 1 inclusive month
  });

  it("is order-independent (a0/a1 swapped)", () => {
    expect(spanPct(dec, jan, win)).toEqual(spanPct(jan, dec, win));
  });

  it("clips a span crossing the left edge", () => {
    const g = spanPct(ymToAbs("2025-10"), apr, win)!; // starts before the window
    expect(g.left).toBe(0);
    expect(g.width).toBeCloseTo(100 / 12 * 4, 5); // Jan..Apr = 4 months in-window
  });

  it("clips a span crossing the right edge", () => {
    const g = spanPct(ymToAbs("2026-11"), ymToAbs("2027-06"), win)!; // Nov..Dec in-window
    expect(g.left).toBeCloseTo(100 / 12 * 10, 5);
    expect(g.width).toBeCloseTo(100 / 12 * 2, 5);
  });

  it("returns null when fully outside the window", () => {
    expect(spanPct(ymToAbs("2020-01"), ymToAbs("2020-06"), win)).toBeNull();
    expect(spanPct(ymToAbs("2030-01"), ymToAbs("2030-06"), win)).toBeNull();
  });

  it("enforces a minimum hairline width (bar 0.7 vs segment 0.6)", () => {
    // A zero-length span at the edge would compute a tiny width; the floors apply.
    const b = barGeom(jan, jan, { start: jan, span: 1200 })!;
    const s = segPct(jan, jan, { start: jan, span: 1200 })!;
    expect(b.width).toBeCloseTo(0.7, 5);
    expect(s.width).toBeCloseTo(0.6, 5);
  });
});

describe("centerPct", () => {
  const win: Win = { start: ymToAbs("2026-01"), span: 12 };
  it("returns the mid-month position within the window", () => {
    expect(centerPct(ymToAbs("2026-01"), win)).toBeCloseTo(0.5 / 12 * 100, 5);
    expect(centerPct(ymToAbs("2026-12"), win)).toBeCloseTo(11.5 / 12 * 100, 5);
  });
  it("returns null outside the window", () => {
    expect(centerPct(ymToAbs("2025-12"), win)).toBeNull();
    expect(centerPct(ymToAbs("2027-01"), win)).toBeNull();
  });
});
