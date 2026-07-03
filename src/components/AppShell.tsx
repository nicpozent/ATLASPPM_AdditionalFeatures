import { Outlet } from "react-router-dom";
import { color } from "@/theme";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", background: color.bg, fontFamily: "'Public Sans', sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: "auto", padding: "26px 28px 60px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
