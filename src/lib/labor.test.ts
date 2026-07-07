import { describe, it, expect } from "vitest";
import { laborHours, laborCost, HOURS_PER_DAY, DAYS_PER_MONTH } from "./labor";

describe("labor maths", () => {
  it("sums months/days/hours into hours", () => {
    expect(laborHours(0, 0, 0)).toBe(0);
    expect(laborHours(0, 0, 5)).toBe(5);
    expect(laborHours(0, 1, 0)).toBe(HOURS_PER_DAY);
    expect(laborHours(1, 0, 0)).toBe(DAYS_PER_MONTH * HOURS_PER_DAY); // 168
    expect(laborHours(1, 2, 3)).toBe(DAYS_PER_MONTH * HOURS_PER_DAY + 2 * HOURS_PER_DAY + 3); // 187
  });

  it("clamps negatives and coerces non-numbers to 0", () => {
    expect(laborHours(-3, -1, -10)).toBe(0);
    expect(laborHours(NaN, NaN, NaN)).toBe(0);
  });

  it("multiplies hours by the rate", () => {
    expect(laborCost(1, 0, 0, 100)).toBe(16800); // 168 h × €100
    expect(laborCost(0, 1, 0, 95)).toBe(HOURS_PER_DAY * 95); // 760
    expect(laborCost(1, 1, 1, 0)).toBe(0); // no rate → no cost
    expect(laborCost(0, 0, 0, 100)).toBe(0); // no effort → no cost
  });
});
