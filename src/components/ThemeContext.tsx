import React, { createContext, useContext, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { applyThemeVars, DARK_MODE_ENABLED, isThemeId, type ThemeId } from "@/theme";
import { api } from "@/api";
import { useRole } from "./RoleContext";
import { useAuth } from "./AuthContext";

// The theme is a per-profile preference. Signed OUT (demo), the choice is stored
// in localStorage keyed by the selected role identity (the cosmetic persona), so
// switching persona restores that persona's theme (ADR-0056). Signed IN, it is
// stored PER USER on the server (`/prefs/theme`) so it follows the person across
// devices and browsers (ADR-0076); localStorage stays as an optimistic/offline
// cache. Light is the default (ADR-0074).
const keyFor = (role: string) => `atlas.theme.${role}`;

function gate(id: ThemeId): ThemeId {
  // Atlas Dark stays gated behind DARK_MODE_ENABLED — if the flag is off, a
  // stored/served "dark" preference falls back to light (the value is preserved
  // and honoured again once the flag is re-enabled). Atlas themes are not gated.
  return id === "dark" && !DARK_MODE_ENABLED ? "light" : id;
}

function readTheme(role: string): ThemeId {
  const stored = localStorage.getItem(keyFor(role));
  return isThemeId(stored) ? gate(stored) : "light";
}

interface ThemeCtx { theme: ThemeId; setTheme: (id: ThemeId) => void; }
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { role } = useRole();
  const { enabled, user } = useAuth();
  const signedIn = enabled && !!user;
  const [theme, setThemeState] = useState<ThemeId>(() => readTheme(role));

  // Signed OUT: reset the theme to the persona's saved preference when the
  // persona changes (React's "adjust state during render" pattern). Signed IN,
  // the theme is per-user, not per-persona, so persona switches don't reset it.
  const [trackedRole, setTrackedRole] = useState(role);
  if (role !== trackedRole) {
    setTrackedRole(role);
    if (!signedIn) setThemeState(readTheme(role));
  }

  // Signed IN: hydrate the per-user theme from the server (follows across
  // devices). localStorage/default is the optimistic value until this resolves.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    api<{ theme?: string | null }>("/prefs/theme")
      .then((r) => { if (!cancelled && isThemeId(r?.theme)) setThemeState(gate(r!.theme as ThemeId)); })
      .catch(() => { /* offline / not configured — keep local value */ });
    return () => { cancelled = true; };
  }, [signedIn]);

  // Apply the palette to :root whenever the theme changes (and on first paint).
  useLayoutEffect(() => { applyThemeVars(theme); }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    localStorage.setItem(keyFor(role), id);            // offline / signed-out cache
    if (signedIn) {
      api("/prefs/theme", { method: "PUT", body: JSON.stringify({ theme: id }) })
        .catch(() => { /* best-effort; the local value still holds this session */ });
    }
  }, [role, signedIn]);

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider (matches RoleContext); dev-HMR only
export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
