import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { color } from "@/theme";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ErrorBoundary } from "./ui";

// Tracks a max-width media query. Below the breakpoint the static sidebar is
// swapped for an off-canvas drawer and the content padding tightens.
function useNarrow(px = 900) {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(`(max-width:${px}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${px}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [px]);
  return narrow;
}

export function AppShell() {
  const { pathname } = useLocation();
  const narrow = useNarrow();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A route change always closes the drawer — reset during render (React's
  // recommended pattern for "adjust state on prop change") rather than in an
  // effect, so there's no extra render pass.
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) { setPrevPath(pathname); setDrawerOpen(false); }

  // The drawer only exists in narrow mode, so leaving it can't leave a stale
  // panel behind: the effective open state is gated on `narrow`.
  const open = narrow && drawerOpen;

  // Escape closes the drawer and locks background scroll while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", background: color.bg, fontFamily: "'Public Sans', sans-serif" }}>
      {/* Wide: static navigation rail. */}
      {!narrow && <Sidebar />}

      {/* Narrow: off-canvas drawer + dimming backdrop. */}
      {narrow && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
            style={{
              position: "fixed", inset: 0, zIndex: 60, background: "rgba(11,18,32,0.5)",
              opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
              transition: "opacity 180ms ease",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            style={{
              position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 61,
              transform: open ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 200ms ease", boxShadow: open ? "2px 0 24px rgba(0,0,0,0.35)" : "none",
            }}
          >
            <Sidebar drawer onNavigate={() => setDrawerOpen(false)} />
          </div>
        </>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar onMenu={narrow ? () => setDrawerOpen(true) : undefined} />
        <main style={{ flex: 1, overflowY: "auto", padding: narrow ? "16px 14px 48px" : "26px 28px 60px" }}>
          {/* Key the boundary by route so a crash on one screen never sticks —
              navigating elsewhere remounts it and clears the error state. */}
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
