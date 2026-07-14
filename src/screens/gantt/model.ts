// Gantt absolute-month model — the pure date/geometry core of the timeline,
// extracted from Gantt.tsx so it can be unit-tested without rendering (ADR-0041).
//
// Absolute month = year*12 + monthIndex(0..11). The visible window is a calendar
// range the user picks (From/To, capped at 5 years), so a project running e.g.
// 2027→2030 lays out correctly across years. Items with real dates are placed by
// them; a bare month-of-year (phases, derived sprints) is anchored to a base year
// supplied by its context.

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MAX_SPAN = 60; // 5 years

// The visible calendar window, in absolute months.
export interface Win { start: number; span: number }

// Current month as an absolute month (impure — reads the clock).
export const nowAbs = (): number => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); };

// Month-of-year (0..11) of an ISO date, or null if empty/invalid.
export const monthOfIso = (s: string): number | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.getMonth();
};

// Absolute month of an ISO date, or null if absent/invalid.
export const absOfIso = (s?: string | null): number | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.getFullYear() * 12 + d.getMonth();
};

// "YYYY-MM" → absolute month (1-based month in, 0-based index out).
export const ymToAbs = (ym: string): number => {
  const [y, m] = ym.split("-").map(Number);
  return (y || 0) * 12 + ((m || 1) - 1);
};

// Absolute month → "YYYY-MM" (1-based month out).
export const absToYm = (abs: number): string =>
  `${Math.floor(abs / 12)}-${String((abs % 12) + 1).padStart(2, "0")}`;

// Short month name of an absolute month (wraps negatives correctly).
export const monthAbbr = (abs: number): string => MONTHS[((abs % 12) + 12) % 12];

// Calendar year of an absolute month.
export const yearOf = (abs: number): number => Math.floor(abs / 12);

// Anchor a bare month-of-year to a base absolute month (its context's start).
export const anchored = (base: number, m: number): number => base + m;

// Build the visible window from the From/To pickers. Span is inclusive of both
// ends, never < 1 month, and capped at MAX_SPAN (5 years).
export function makeWindow(fromYM: string, toYM: string): Win {
  const start = ymToAbs(fromYM);
  let span = ymToAbs(toYM) - start + 1;
  if (span < 1) span = 1;
  if (span > MAX_SPAN) span = MAX_SPAN;
  return { start, span };
}

// Left/width (%) of a [a0,a1] span within the window, clipped to its edges, or
// null when the span is fully outside. `minWidth` keeps a hairline visible.
export function spanPct(a0: number, a1: number, win: Win, minWidth = 0.6): { left: number; width: number } | null {
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1), winEnd = win.start + win.span - 1;
  if (hi < win.start || lo > winEnd) return null;
  const s = Math.max(lo, win.start), e = Math.min(hi, winEnd);
  return { left: (s - win.start) / win.span * 100, width: Math.max(minWidth, (e - s + 1) / win.span * 100) };
}

// Bar geometry uses a slightly larger minimum than a plain segment.
export const barGeom = (a0: number, a1: number, win: Win) => spanPct(a0, a1, win, 0.7);
export const segPct = (a0: number, a1: number, win: Win) => spanPct(a0, a1, win, 0.6);

// Centre-of-month position (%) within the window, or null when outside it.
export const centerPct = (abs: number, win: Win): number | null =>
  abs < win.start || abs > win.start + win.span - 1 ? null : (abs - win.start + 0.5) / win.span * 100;

// Fit a From/To window (as "YYYY-MM") around a set of absolute-month positions —
// the span of a project's content (window, phases, sprints, milestones) — with a
// month of padding each side, a 12-month minimum so a short project still fills
// the grid, and the MAX_SPAN cap. Null when there's nothing to fit. Used to open
// the timeline on the selected project's own years instead of the current one.
export function fitWindowYM(abs: number[]): { from: string; to: string } | null {
  if (abs.length === 0) return null;
  let lo = Math.min(...abs) - 1, hi = Math.max(...abs) + 1;
  const span = hi - lo + 1;
  if (span < 12) { const pad = 12 - span; lo -= Math.floor(pad / 2); hi += Math.ceil(pad / 2); }
  if (span > MAX_SPAN) hi = lo + MAX_SPAN - 1;
  return { from: absToYm(lo), to: absToYm(hi) };
}
