// Internal-labour cost maths, shared by the My Team rate card / calculator
// (see ADR-0031). Kept pure and separate so the arithmetic can be unit-tested
// independently of the React component.

export const HOURS_PER_DAY = 8;
export const DAYS_PER_MONTH = 21; // working days/month (≈ 168 h)

// Total hours from a months/days/hours effort estimate. Negative inputs and
// non-numbers are treated as 0.
export function laborHours(months: number, days: number, hours: number): number {
  const m = Math.max(0, Number(months) || 0);
  const d = Math.max(0, Number(days) || 0);
  const h = Math.max(0, Number(hours) || 0);
  return m * DAYS_PER_MONTH * HOURS_PER_DAY + d * HOURS_PER_DAY + h;
}

// Internal-labour cost = total hours × blended €/hour rate.
export function laborCost(months: number, days: number, hours: number, rate: number): number {
  return laborHours(months, days, hours) * Math.max(0, Number(rate) || 0);
}
