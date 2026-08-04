// Non-component helpers for the Project tabs (kept out of shared.tsx so that
// file only exports components — clean React fast-refresh).
import type React from "react";
import { color, font } from "@/theme";

export const sectionTitleS: React.CSSProperties = { fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink };

export const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

// Project/task comments (shared by the Comments tab and the task detail modal).
export interface CommentItem { id: number; author: string; initials: string; body: string; at: string; }

export function fmtCommentTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ---- Vacations calendar window (pure; unit-tested) -------------------------
// A rolling six-month window starting at the first of `now`'s month, so the
// Vacations panel is never pinned to a fixed year. One source of truth for the
// month labels, day span and header label; and one clip function so out-of-range
// absences are filtered (not clamped to a sliver at the edge).
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 864e5;

export interface VacWindow {
  startMs: number;   // 00:00 UTC on the first day of the window
  endMs: number;     // 00:00 UTC on the last day of the window (inclusive)
  days: number;      // inclusive day count across the window
  months: string[];  // six month abbreviations, in order
  label: string;     // header label, e.g. "Jul–Dec 2026" or "Nov 2026 – Apr 2027"
}

export function vacationWindow(now: Date): VacWindow {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const startMs = Date.UTC(y, m, 1);
  const endMs = Date.UTC(y, m + 6, 1) - DAY_MS;   // last day of the 6th month
  const days = Math.round((endMs - startMs) / DAY_MS) + 1;
  const months = Array.from({ length: 6 }, (_, i) => MONTH_ABBR[(m + i) % 12]);
  const endY = new Date(endMs).getUTCFullYear();
  const label = y === endY
    ? `${months[0]}–${months[5]} ${y}`
    : `${months[0]} ${y} – ${months[5]} ${endY}`;
  return { startMs, endMs, days, months, label };
}

export interface VacBar { leftPct: number; widthPct: number; }

// Position an absence within the window, clipped to its edges. Returns null when
// the absence does not overlap the window at all (so the caller filters it out
// rather than rendering a min-width sliver pinned to an edge). Keeps the 1.5%
// minimum visible width for a genuine, in-window absence.
export function clipToWindow(fromIso: string, toIso: string, win: VacWindow): VacBar | null {
  const f = Date.parse(fromIso), t = Date.parse(toIso);
  if (isNaN(f) || isNaN(t)) return null;
  const lo = Math.max(f, win.startMs), hi = Math.min(t, win.endMs);
  if (hi < lo) return null;   // no overlap with the window
  const pct = (ms: number) => Math.max(0, Math.min(100, (ms - win.startMs) / DAY_MS / win.days * 100));
  const left = pct(lo);
  return { leftPct: left, widthPct: Math.max(1.5, pct(hi) - left) };
}
