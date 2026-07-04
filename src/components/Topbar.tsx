import { useLocation } from "react-router-dom";
import { color, font, layout } from "@/theme";
import { Icon } from "./Icon";
import { useRole } from "./RoleContext";
import { ROLES, SCREENS } from "@/nav";

export function Topbar() {
  const { role, setRole } = useRole();
  // Platform Administrator can view every role (troubleshooting); others see only their own.
  const visibleRoles = role === "admin" ? ROLES : ROLES.filter((r) => r.value === role);
  const { pathname } = useLocation();
  const screen = Object.values(SCREENS).find((s) => s.path === pathname) ?? SCREENS.dashboard;

  return (
    <header style={{
      height: layout.headerHeight, flex: "none", background: color.surface,
      borderBottom: `1px solid ${color.border3}`, display: "flex", alignItems: "center",
      gap: 18, padding: "0 26px", zIndex: 20,
    }}>
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontFamily: font.head, fontSize: 19, fontWeight: 600, color: color.ink, letterSpacing: "-0.01em" }}>
          {screen.title}
        </div>
        <div style={{ fontSize: 12.5, color: color.faint }}>{screen.subtitle}</div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Role switcher */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: color.surfaceInput, border: `1px solid ${color.border3}`,
        borderRadius: 9, padding: "8px 12px",
      }}>
        <span style={{ color: color.primary, display: "flex" }}><Icon name="userCheck" size={16} /></span>
        <span style={{ fontSize: 11, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Role</span>
        {/* Only Platform Administrator may view/switch other roles (for support);
            every other role is locked to its own view. */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={visibleRoles.length <= 1}
          style={{
            border: "none", background: "transparent", fontSize: 13, fontWeight: 600,
            color: color.ink, fontFamily: "inherit", cursor: visibleRoles.length <= 1 ? "default" : "pointer", outline: "none",
          }}
        >
          {visibleRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Notifications */}
      <button style={{
        position: "relative", width: 40, height: 40, borderRadius: 9,
        border: `1px solid ${color.border3}`, background: color.surface,
        display: "flex", alignItems: "center", justifyContent: "center", color: "#56607A", cursor: "pointer",
      }}>
        <Icon name="bell" size={18} />
        <span style={{ position: "absolute", top: 8, right: 9, width: 7, height: 7, borderRadius: "50%", background: color.danger, border: "2px solid #fff" }} />
      </button>

      {/* Export */}
      <button style={{
        display: "flex", alignItems: "center", gap: 8, background: color.primary, color: "#fff",
        border: "none", borderRadius: 9, padding: "10px 15px", fontSize: 13.5, fontWeight: 600,
        fontFamily: "inherit", cursor: "pointer",
      }}>
        <span style={{ display: "flex" }}><Icon name="download" size={16} /></span>
        Export
        <span style={{ display: "flex", opacity: 0.8 }}><Icon name="chevronDown" size={14} /></span>
      </button>
    </header>
  );
}
