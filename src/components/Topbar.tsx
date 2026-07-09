import { useLocation } from "react-router-dom";
import { color, font, layout, DARK_MODE_ENABLED } from "@/theme";
import { Icon } from "./Icon";
import { useRole } from "./RoleContext";
import { useTheme } from "./ThemeContext";
import { useRoleIdentities } from "./useRoleIdentities";
import { useAuth } from "./AuthContext";
import { NotificationCenter } from "./NotificationCenter";
import { LanguagePicker } from "./LanguagePicker";
import { useT } from "@/i18n";
import { SCREENS } from "@/nav";

export function Topbar({ onMenu }: { onMenu?: () => void } = {}) {
  const { role, setRole } = useRole();
  const { enabled, user } = useAuth();
  const t = useT();
  // Who may switch roles is decided by the REAL identity, not the currently
  // selected view — so a Platform Administrator can move through every role and
  // back again. In the demo (auth off) all identities are switchable, as in the
  // prototype; signed in, only a Platform Admin may impersonate other roles.
  const canSwitchAll = !enabled || user?.role === "admin";
  const identities = useRoleIdentities();
  const visibleRoles = canSwitchAll ? identities : identities.filter((r) => r.value === role);
  const { pathname } = useLocation();
  const screen = Object.values(SCREENS).find((s) => s.path === pathname) ?? SCREENS.dashboard;

  return (
    <header style={{
      height: layout.headerHeight, flex: "none", background: color.surface,
      borderBottom: `1px solid ${color.border3}`, display: "flex", alignItems: "center",
      gap: 18, padding: "0 26px", zIndex: 20,
    }}>
      {/* Hamburger — only rendered by the shell on phone widths, where the
          sidebar is off-canvas. Opens the navigation drawer. */}
      {onMenu && (
        <button
          onClick={onMenu}
          aria-label={t("common.openMenu", "Open navigation menu")}
          style={{
            flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, marginLeft: -8, borderRadius: 9, cursor: "pointer",
            color: color.ink, background: "transparent", border: `1px solid ${color.border3}`,
          }}
        >
          <Icon name="menu" size={20} />
        </button>
      )}
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontFamily: font.head, fontSize: 19, fontWeight: 600, color: color.ink, letterSpacing: "-0.01em" }}>
          {t(`screen.${screen.id}.title`, t(`screen.${screen.id}.label`, screen.title))}
        </div>
        <div style={{ fontSize: 12.5, color: color.faint }}>{t(`screen.${screen.id}.subtitle`, screen.subtitle)}</div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Role switcher */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: color.surfaceInput, border: `1px solid ${color.border3}`,
        borderRadius: 9, padding: "8px 12px",
      }}>
        <span style={{ color: color.primary, display: "flex" }}><Icon name="userCheck" size={16} /></span>
        <span style={{ fontSize: 11, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("common.role", "Role")}</span>
        {/* Only Platform Administrator may view/switch other roles (for support);
            every other role is locked to its own view. */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={visibleRoles.length <= 1}
          aria-label={t("common.role", "Role")}
          style={{
            border: "none", background: "transparent", fontSize: 13, fontWeight: 600,
            color: color.ink, fontFamily: "inherit", cursor: visibleRoles.length <= 1 ? "default" : "pointer", outline: "none",
          }}
        >
          {visibleRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Dark-mode toggle — hidden while the feature is finished off (theme.ts
          DARK_MODE_ENABLED). Flip that flag back on to restore it. */}
      {DARK_MODE_ENABLED && <ThemeToggle />}

      {/* Language */}
      <LanguagePicker />

      {/* Notifications */}
      <NotificationCenter />

      {/* Export */}
      <button style={{
        display: "flex", alignItems: "center", gap: 8, background: color.primary, color: "#fff",
        border: "none", borderRadius: 9, padding: "10px 15px", fontSize: 13.5, fontWeight: 600,
        fontFamily: "inherit", cursor: "pointer",
      }}>
        <span style={{ display: "flex" }}><Icon name="download" size={16} /></span>
        {t("common.export", "Export")}
        <span style={{ display: "flex", opacity: 0.8 }}><Icon name="chevronDown" size={14} /></span>
      </button>
    </header>
  );
}

// Per-profile dark-mode toggle. Sits by the role switcher; the choice persists
// against the selected identity (ADR-0056).
function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const t = useT();
  const dark = mode === "dark";
  const label = dark ? t("common.lightMode", "Switch to light mode") : t("common.darkMode", "Switch to dark mode");
  return (
    <button
      onClick={toggle}
      aria-label={label}
      aria-pressed={dark}
      title={label}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 40, height: 40, flex: "none",
        background: color.surfaceInput, border: `1px solid ${color.border3}`,
        borderRadius: 9, color: color.faint2, cursor: "pointer", fontFamily: "inherit",
      }}
    >
      <Icon name={dark ? "sun" : "moon"} size={17} />
    </button>
  );
}
