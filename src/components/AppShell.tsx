import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { color } from "@/theme";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ErrorBoundary } from "./ui";

// Tracks a max-width media query so the content padding can tighten on small
// screens (the shell's own chrome stays, but the main area stops wasting space).
function useNarrow(px = 720) {
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
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", background: color.bg, fontFamily: "'Public Sans', sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar />
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
