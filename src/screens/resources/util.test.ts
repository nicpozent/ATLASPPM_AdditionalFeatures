import { describe, it, expect } from "vitest";
import { isoLocal, periodWindow } from "./util";

// The period toggle only changes the Resources utilisation because each id maps
// to a concrete calendar window the server averages over. These lock that map.
describe("periodWindow", () => {
  // Anchor on a fixed weekday (Wed 2026-07-15) so the windows are deterministic.
  const ref = new Date(2026, 6, 15); // month is 0-based → July

  it("day is a single day", () => {
    expect(periodWindow("day", ref)).toEqual({ from: "2026-07-15", to: "2026-07-15" });
  });

  it("week is the Monday→Sunday containing the ref", () => {
    // 2026-07-15 is a Wednesday → week is Mon 13th … Sun 19th.
    expect(periodWindow("week", ref)).toEqual({ from: "2026-07-13", to: "2026-07-19" });
  });

  it("month is the calendar month", () => {
    expect(periodWindow("month", ref)).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("quarter is the calendar quarter", () => {
    // July → Q3 (Jul–Sep).
    expect(periodWindow("quarter", ref)).toEqual({ from: "2026-07-01", to: "2026-09-30" });
  });

  it("half splits the year at July", () => {
    expect(periodWindow("half", ref)).toEqual({ from: "2026-07-01", to: "2026-12-31" });
    expect(periodWindow("half", new Date(2026, 2, 1))).toEqual({ from: "2026-01-01", to: "2026-06-30" });
  });

  it("year is the calendar year", () => {
    expect(periodWindow("year", ref)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("isoLocal uses local date parts, not UTC", () => {
    expect(isoLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
