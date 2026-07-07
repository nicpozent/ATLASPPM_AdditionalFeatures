// Roadmap "By year" grouping logic (see the Roadmap screen). Pure so it can be
// unit-tested without rendering the board.

export interface Yearable { plannedYear: number; startDate: string }

// Effective year for an initiative: the explicit planned year, else the
// start-date's year, else 0 (unscheduled).
export function yearOf(i: Yearable): number {
  if (i.plannedYear) return i.plannedYear;
  if (i.startDate) {
    const y = new Date(i.startDate).getFullYear();
    return Number.isNaN(y) ? 0 : y;
  }
  return 0;
}

// The ordered set of year columns to render: every year present on an item plus
// the current year and next, ascending. (The "Unscheduled" column is appended
// by the view, not here.)
export function yearColumns(items: Yearable[], thisYear: number): number[] {
  const set = new Set<number>([thisYear, thisYear + 1]);
  for (const i of items) { const y = yearOf(i); if (y > 0) set.add(y); }
  return Array.from(set).sort((a, b) => a - b);
}
