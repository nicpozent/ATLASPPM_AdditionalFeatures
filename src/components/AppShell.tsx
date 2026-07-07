import { Outlet, useLocation } from "react-router-dom";
import { color } from "@/theme";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ErrorBoundary } from "./ui";

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", background: color.bg, fontFamily: "'Public Sans', sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: "auto", padding: "26px 28px 60px" }}>
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
