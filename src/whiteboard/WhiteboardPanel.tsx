// ============================================================================
//  WhiteboardPanel (ADR-0064) — the whiteboard, lazily loaded. Importing this
//  from a screen keeps the SignalR + editor bundle in its own chunk (loaded only
//  when a whiteboard is actually opened), so mounting the canvas on projects /
//  programs / releases / products doesn't bloat those screens' entry bundles.
// ============================================================================
import { lazy, Suspense } from "react";
import { color } from "@/theme";

const Whiteboard = lazy(() => import("./Whiteboard"));

export function WhiteboardPanel({ scope }: { scope: { kind: string; id: string } }) {
  return (
    <Suspense fallback={<div style={{ padding: "48px 0", textAlign: "center", color: color.faint3, fontSize: 13 }}>Loading whiteboard…</div>}>
      <Whiteboard scope={scope} />
    </Suspense>
  );
}

// Segmented Overview / Whiteboard control for detail pages that aren't already
// tabbed (programs, products). Matches the PI Planning tab-strip styling.
export function WhiteboardSwitch({ value, onChange }: { value: "overview" | "whiteboard"; onChange: (v: "overview" | "whiteboard") => void }) {
  return (
    <div style={{ display: "inline-flex", background: color.border3, borderRadius: 10, padding: 3, gap: 2, marginBottom: 18 }}>
      {(["overview", "whiteboard"] as const).map((k) => (
        <button key={k} onClick={() => onChange(k)}
          style={{ padding: "7px 15px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", textTransform: "capitalize", background: value === k ? color.surface : "transparent", color: value === k ? color.primary : color.subtle, boxShadow: value === k ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>
          {k}
        </button>
      ))}
    </div>
  );
}
