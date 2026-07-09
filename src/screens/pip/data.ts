// ============================================================================
//  PIP data layer — types, constants, and the pure derivations behind the PI
//  Planning screen (rollups, capacity math, calendar positioning). Kept out of
//  the component so the logic is unit-testable and the screen stays thin.
// ============================================================================
import { chart, color } from "@/theme";

export interface IncrementSummary {
  id: number; key: string; name: string; startDate: string; endDate: string; state: string;
  objectives: number; iterations: number; dependencies: number;
}
export interface Iteration { id: number; name: string; startDate: string; endDate: string; capacity: number; load: number }
export interface Objective {
  id: number; title: string; description: string; entityType: string; entityId: string; entityName: string;
  businessValue: number; actualValue: number; committed: boolean; confidence: number; status: string;
  objectiveLink?: string; okrTitle?: string;
}
export interface Dependency {
  id: number; title: string; fromType: string; fromId: string; fromName: string;
  toType: string; toId: string; toName: string; owner: string; dueDate: string; status: string;
}
export interface LinkTarget { type: string; id: string; name: string }
export interface IncrementDetail {
  id: number; key: string; name: string; startDate: string; endDate: string; state: string; canEdit: boolean;
  iterationList: Iteration[]; objectiveList: Objective[]; dependencyList: Dependency[]; targets: LinkTarget[];
}

export const STATES = ["Planning", "Active", "Completed", "Cancelled"];
export const OBJ_STATUSES = ["Planned", "In Progress", "Done", "Missed"];
export const DEP_STATUSES = ["Identified", "Committed", "Resolved", "Blocked"];
export const LINK_TYPES = [
  { key: "", label: "No link" },
  { key: "project", label: "Project" },
  { key: "program", label: "Program" },
  { key: "product", label: "Product" },
  { key: "release", label: "Release" },
];

export const STATE_PILL: Record<string, { ink: string; tint: string }> = {
  Planning: { ink: color.subtle, tint: color.bg },
  Active: { ink: color.primaryDark, tint: color.primaryTint2 },
  Completed: { ink: color.successInk, tint: color.successTint },
  Cancelled: { ink: color.dangerInk, tint: color.dangerTint },
};
export const OBJ_PILL: Record<string, { ink: string; tint: string; dot: string }> = {
  Planned: { ink: color.subtle, tint: color.bg, dot: chart.onHold },
  "In Progress": { ink: color.primaryDark, tint: color.primaryTint2, dot: chart.pipeBacklog },
  Done: { ink: color.successInk, tint: color.successTint, dot: chart.onTrack },
  Missed: { ink: color.dangerInk, tint: color.dangerTint, dot: chart.critical },
};
export const DEP_COL: Record<string, { ink: string; tint: string; bar: string }> = {
  Identified: { ink: color.subtle, tint: color.bg, bar: chart.onHold },
  Committed: { ink: color.primaryDark, tint: color.primaryTint2, bar: chart.pipeBacklog },
  Resolved: { ink: color.successInk, tint: color.successTint, bar: chart.onTrack },
  Blocked: { ink: color.dangerInk, tint: color.dangerTint, bar: chart.critical },
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ISO/loose date → epoch ms (or null). Dates without a time are read at midnight.
export function parseTs(d?: string): number | null {
  if (!d) return null;
  const t = Date.parse(d.length === 10 ? `${d}T00:00:00` : d);
  return isNaN(t) ? null : t;
}
export function toDisplay(iso: string): string {
  if (!iso) return "—";
  const [y, m, dd] = iso.split("-").map(Number);
  return y && m && dd ? `${dd} ${MONTHS[m - 1]} ${y}` : iso;
}
// Fist-of-five confidence colour: 4–5 green, 3 amber, 1–2 red, 0 grey.
export function confColor(v: number): string {
  return v >= 4 ? chart.onTrack : v === 3 ? chart.atRisk : v > 0 ? chart.critical : chart.onHold;
}

export function isOverAllocated(it: Pick<Iteration, "capacity" | "load">): boolean {
  return it.capacity > 0 && it.load > it.capacity;
}

// Increment-wide capacity vs planned load.
export function iterationTotals(iterations: Iteration[]) {
  const capacity = iterations.reduce((s, i) => s + i.capacity, 0);
  const load = iterations.reduce((s, i) => s + i.load, 0);
  const loadedPct = capacity > 0 ? Math.round((load / capacity) * 100) : 0;
  return { capacity, load, headroom: capacity - load, loadedPct, over: load > capacity && capacity > 0 };
}

// Objective rollup: committed vs stretch, planned/delivered business value, and
// mean confidence across *committed* objectives that have actually been voted.
export function objectiveRollup(objectives: Objective[]) {
  const committed = objectives.filter((o) => o.committed);
  const stretch = objectives.filter((o) => !o.committed);
  const voted = committed.filter((o) => o.confidence > 0);
  const meanConf = voted.length ? voted.reduce((s, o) => s + o.confidence, 0) / voted.length : 0;
  const plannedBV = committed.reduce((s, o) => s + o.businessValue, 0);
  const doneBV = committed.filter((o) => o.status === "Done").reduce((s, o) => s + o.businessValue, 0);
  return { committed, stretch, meanConf, plannedBV, doneBV };
}

// Timeline span across the increment and all its iterations.
export function timelineSpan(inc: Pick<IncrementDetail, "startDate" | "endDate">, iterations: Iteration[]) {
  const spans = [parseTs(inc.startDate), parseTs(inc.endDate),
    ...iterations.flatMap((i) => [parseTs(i.startDate), parseTs(i.endDate)])].filter((x): x is number => x != null);
  const min = spans.length ? Math.min(...spans) : null;
  const max = spans.length ? Math.max(...spans) : null;
  const total = min != null && max != null && max > min ? max - min : null;
  return { min, max, total };
}

// Left/width percentages for a bar within [min, min+total]. Null when unplaceable.
export function barPos(min: number | null, total: number | null, a: number | null, b: number | null) {
  if (min == null || total == null || total <= 0 || a == null) return null;
  const left = ((a - min) / total) * 100;
  const right = b != null ? ((b - min) / total) * 100 : left + 2;
  return { left: Math.max(0, left), width: Math.max(2, right - left) };
}

// Month ticks (first of each month) across the span, as percentages.
export function monthTicks(min: number | null, max: number | null, total: number | null): { pct: number; label: string }[] {
  if (min == null || max == null || total == null || total <= 0) return [];
  const ticks: { pct: number; label: string }[] = [];
  const d = new Date(min); d.setDate(1);
  // Guard against pathological spans producing thousands of ticks.
  for (let i = 0; i < 240 && d.getTime() <= max; i++) {
    const pct = ((d.getTime() - min) / total) * 100;
    if (pct >= 0 && pct <= 100) ticks.push({ pct, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
    d.setMonth(d.getMonth() + 1);
  }
  return ticks;
}
