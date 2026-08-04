import { describe, it, expect } from "vitest";
import { vacationWindow, clipToWindow } from "./util";

// The Vacations calendar window must roll with the current date (it used to be
// hardcoded to Jul–Dec 2026, silently breaking on 1 Jan 2027), and absences
// outside the window must be filtered — not clamped to a sliver at the edge.
describe("vacationWindow", () => {
  it("rolls six months from the first of the current month", () => {
    const w = vacationWindow(new Date(Date.UTC(2026, 6, 15))); // mid-July 2026
    expect(w.months).toEqual(["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
    expect(w.startMs).toBe(Date.UTC(2026, 6, 1));
    expect(w.endMs).toBe(Date.UTC(2026, 11, 31));
    expect(w.days).toBe(184);
    expect(w.label).toBe("Jul–Dec 2026");
  });

  it("crosses a year boundary and labels both years", () => {
    const w = vacationWindow(new Date(Date.UTC(2026, 10, 3))); // November 2026
    expect(w.months).toEqual(["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"]);
    expect(w.startMs).toBe(Date.UTC(2026, 10, 1));
    expect(w.endMs).toBe(Date.UTC(2027, 3, 30));
    expect(w.label).toBe("Nov 2026 – Apr 2027");
  });
});

describe("clipToWindow", () => {
  const win = vacationWindow(new Date(Date.UTC(2026, 6, 15))); // Jul–Dec 2026

  it("positions an absence fully inside the window", () => {
    const bar = clipToWindow("2026-08-01", "2026-08-15", win)!;
    expect(bar).not.toBeNull();
    expect(bar.leftPct).toBeGreaterThan(0);
    expect(bar.leftPct).toBeLessThan(100);
    expect(bar.widthPct).toBeGreaterThan(1.5);
  });

  it("filters an absence fully before the window", () => {
    expect(clipToWindow("2026-05-01", "2026-06-30", win)).toBeNull();
  });

  it("filters an absence fully after the window", () => {
    expect(clipToWindow("2027-01-05", "2027-01-20", win)).toBeNull();
  });

  it("clips an absence straddling the start to the left edge", () => {
    const bar = clipToWindow("2026-06-20", "2026-07-10", win)!;
    expect(bar.leftPct).toBe(0);
    expect(bar.widthPct).toBeGreaterThan(1.5);
  });

  it("clips an absence straddling the end to the right edge", () => {
    const bar = clipToWindow("2026-12-20", "2027-02-01", win)!;
    expect(bar.leftPct).toBeLessThan(100);
    expect(bar.leftPct + bar.widthPct).toBeLessThanOrEqual(100.001);
  });

  it("keeps a 1.5% minimum width for a genuine one-day absence", () => {
    const bar = clipToWindow("2026-09-10", "2026-09-10", win)!;
    expect(bar.widthPct).toBe(1.5);
  });

  it("returns null for an unparseable date", () => {
    expect(clipToWindow("not-a-date", "2026-08-01", win)).toBeNull();
  });
});
