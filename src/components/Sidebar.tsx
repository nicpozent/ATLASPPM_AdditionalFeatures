import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { color, font, layout } from "@/theme";
import { api } from "@/api";
import { Icon } from "./Icon";
import { useRole } from "./RoleContext";
import { useAuth } from "./AuthContext";
import { useT } from "@/i18n";
import {
  SCREENS, NAV_MAIN, NAV_CONFIG, NAV_STAKEHOLDER_MAIN, NAV_STAKEHOLDER_CONFIG,
  type ScreenId,
} from "@/nav";

function NavItem({ id, badge, onNavigate }: { id: ScreenId; badge?: string; onNavigate?: () => void }) {
  const s = SCREENS[id];
  const t = useT();
  const shown = badge ?? s.badge;
  return (
    <NavLink
      to={s.path}
      end={s.path === "/"}
      onClick={onNavigate}
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
          <span style={{ flex: 1 }}>{t(`screen.${id}.label`, s.label)}</span>
          {shown && (
            <span style={{
              fontSize: 11, fontWeight: 700, background: color.primary, color: "#fff",
              borderRadius: 20, padding: "1px 8px", fontFamily: font.mono,
            }}>{shown}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

// Live count of open demands for the Demand Pipeline nav badge (shared cache
// with the Demands screen; shows the real number, not a hardcoded one).
function useOpenDemandCount(): string | undefined {
  const { data } = useQuery({
    queryKey: ["demands"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<{ id: string }[]> => {
      try { return (await api<{ id: string }[]>("/demands")) ?? []; } catch { return []; }
    },
  });
  return data && data.length > 0 ? String(data.length) : undefined;
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, color: color.sidebarLabel, letterSpacing: "0.12em",
      textTransform: "uppercase", padding: "14px 12px 6px",
    }}>{children}</div>
  );
}

// `drawer` renders the sidebar as an off-canvas overlay for phone widths;
// `onNavigate` lets the shell close that drawer once a link is followed.
export function Sidebar({ drawer = false, onNavigate }: { drawer?: boolean; onNavigate?: () => void } = {}) {
  const { identity, role } = useRole();
  const { enabled: authEnabled, user, logout } = useAuth();
  const t = useT();
  const isStakeholder = role === "stakeholder";
  const main = isStakeholder ? NAV_STAKEHOLDER_MAIN : NAV_MAIN;
  const config = isStakeholder ? NAV_STAKEHOLDER_CONFIG : NAV_CONFIG;
  const demandBadge = useOpenDemandCount();

  return (
    <aside style={{
      width: layout.sidebarWidth, flex: "none", background: color.sidebarBg,
      display: "flex", flexDirection: "column", color: color.sidebarText,
      ...(drawer ? { height: "100%" } : null),
    }}>
      {/* Brand */}
      <div style={{ padding: "18px 16px 15px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{
          background: color.surface, borderRadius: 11, padding: "12px 14px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 9,
        }}>
          <img src="/assets/birgma-logo-trim.png" alt="Birgma" style={{ height: 18, width: "auto", display: "block" }} />
          <span style={{ width: "70%", height: 1, background: color.border3 }} />
          <img src="/assets/biltema-logo-trim.png" alt="Biltema" style={{ height: 18, width: "auto", display: "block" }} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12, paddingLeft: 3 }}>
          <div style={{ fontFamily: font.head, fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>Atlas</div>
          <div style={{ fontSize: 10, color: color.sidebarMuted, letterSpacing: "0.13em", textTransform: "uppercase" }}>Portfolio &amp; PM</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "4px 12px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        <GroupLabel>{t("group.workspace", "Workspace")}</GroupLabel>
        {main.map((id) => <NavItem key={id} id={id} badge={id === "demands" ? demandBadge : undefined} onNavigate={onNavigate} />)}
        <GroupLabel>{t("group.configuration", "Configuration")}</GroupLabel>
        {config.map((id) => <NavItem key={id} id={id} onNavigate={onNavigate} />)}
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
            title={`${t("common.signOut", "Sign out")} (${user.name})`}
            aria-label={`${t("common.signOut", "Sign out")} ${user.name}`}
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
