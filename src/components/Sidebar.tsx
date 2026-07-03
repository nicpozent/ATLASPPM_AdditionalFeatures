import { NavLink } from "react-router-dom";
import { color, font, layout } from "@/theme";
import { Icon } from "./Icon";
import { useRole } from "./RoleContext";
import { useAuth } from "./AuthContext";
import {
  SCREENS, NAV_MAIN, NAV_CONFIG, NAV_STAKEHOLDER_MAIN, NAV_STAKEHOLDER_CONFIG,
  type ScreenId,
} from "@/nav";

function NavItem({ id }: { id: ScreenId }) {
  const s = SCREENS[id];
  return (
    <NavLink
      to={s.path}
      end={s.path === "/"}
      style={({ isActive }) => ({
        display: "flex", alignItems: "center", gap: 11,
        padding: "9px 12px", borderRadius: 9, cursor: "pointer",
        fontSize: 13.5, fontWeight: 600, textDecoration: "none",
        fontFamily: font.body,
        color: isActive ? "#fff" : color.sidebarMuted,
        background: isActive ? "rgba(255,255,255,0.09)" : "transparent",
      })}
    >
      {({ isActive }) => (
        <>
          <span style={{ display: "flex", color: isActive ? "#fff" : color.sidebarMuted }}>
            <Icon name={s.icon} size={19} />
          </span>
          <span style={{ flex: 1 }}>{s.label}</span>
          {s.badge && (
            <span style={{
              fontSize: 11, fontWeight: 700, background: color.primary, color: "#fff",
              borderRadius: 20, padding: "1px 8px", fontFamily: font.mono,
            }}>{s.badge}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, color: color.sidebarLabel, letterSpacing: "0.12em",
      textTransform: "uppercase", padding: "14px 12px 6px",
    }}>{children}</div>
  );
}

export function Sidebar() {
  const { identity, role } = useRole();
  const { enabled: authEnabled, user, logout } = useAuth();
  const isStakeholder = role === "stakeholder";
  const main = isStakeholder ? NAV_STAKEHOLDER_MAIN : NAV_MAIN;
  const config = isStakeholder ? NAV_STAKEHOLDER_CONFIG : NAV_CONFIG;

  return (
    <aside style={{
      width: layout.sidebarWidth, flex: "none", background: color.sidebarBg,
      display: "flex", flexDirection: "column", color: color.sidebarText,
    }}>
      {/* Brand */}
      <div style={{ padding: "18px 16px 15px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{
          background: "#fff", borderRadius: 11, padding: "12px 14px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 9,
        }}>
          <img src="/assets/birgma-logo-trim.png" alt="Birgma" style={{ height: 18, width: "auto", display: "block" }} />
          <span style={{ width: "70%", height: 1, background: "#E8ECF3" }} />
          <img src="/assets/biltema-logo-trim.png" alt="Biltema" style={{ height: 18, width: "auto", display: "block" }} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12, paddingLeft: 3 }}>
          <div style={{ fontFamily: font.head, fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>Atlas</div>
          <div style={{ fontSize: 10, color: color.sidebarMuted, letterSpacing: "0.13em", textTransform: "uppercase" }}>Portfolio &amp; PM</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "4px 12px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        <GroupLabel>Workspace</GroupLabel>
        {main.map((id) => <NavItem key={id} id={id} />)}
        <GroupLabel>Configuration</GroupLabel>
        {config.map((id) => <NavItem key={id} id={id} />)}
      </nav>

      {/* User footer */}
      <div style={{
        padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", gap: 11,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flex: "none",
          background: "linear-gradient(135deg,#0F6CBD,#1E2C7C)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13,
        }}>{identity.initials}</div>
        <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{identity.name}</div>
          <div style={{ fontSize: 11.5, color: color.sidebarMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{identity.roleLabel}</div>
        </div>
        {authEnabled && user && (
          <button
            onClick={logout}
            title={`Sign out (${user.name})`}
            aria-label={`Sign out ${user.name}`}
            style={{
              flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 8, cursor: "pointer",
              color: color.sidebarMuted, background: "transparent",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <Icon name="logOut" size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}
