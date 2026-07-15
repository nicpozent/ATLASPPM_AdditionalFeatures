// Non-component style helper for the Resources tabs.
import type React from "react";
import { color } from "@/theme";

export const selectStyle: React.CSSProperties = {
  border: `1px solid ${color.border2}`, borderRadius: 8, padding: "6px 10px", fontSize: 12.5,
  fontWeight: 600, fontFamily: "inherit", color: color.text, background: color.surface, cursor: "pointer",
};

// Local-time ISO date (yyyy-MM-dd) — avoids the UTC shift a toISOString() would
// introduce for users west of UTC.
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Map a Resources period id to a concrete [from,to] calendar window anchored on
// `ref` (today by default). This is what makes the day/week/…/year toggle change
// the numbers: each period is the window the utilisation is averaged over.
export function periodWindow(period: string, ref = new Date()): { from: string; to: string } {
  const y = ref.getFullYear(), m = ref.getMonth(), day = ref.getDate();
  switch (period) {
    case "day":
      return { from: isoLocal(ref), to: isoLocal(ref) };
    case "week": {
      const dow = (ref.getDay() + 6) % 7; // 0 = Monday
      return { from: isoLocal(new Date(y, m, day - dow)), to: isoLocal(new Date(y, m, day - dow + 6)) };
    }
    case "quarter": {
      const q = Math.floor(m / 3);
      return { from: isoLocal(new Date(y, q * 3, 1)), to: isoLocal(new Date(y, q * 3 + 3, 0)) };
    }
    case "half":
      return m <= 5
        ? { from: isoLocal(new Date(y, 0, 1)), to: isoLocal(new Date(y, 5, 30)) }
        : { from: isoLocal(new Date(y, 6, 1)), to: isoLocal(new Date(y, 11, 31)) };
    case "year":
      return { from: isoLocal(new Date(y, 0, 1)), to: isoLocal(new Date(y, 11, 31)) };
    default: // month
      return { from: isoLocal(new Date(y, m, 1)), to: isoLocal(new Date(y, m + 1, 0)) };
  }
}
