import React, { createContext, useContext, useCallback, useLayoutEffect, useState } from "react";
import { applyThemeVars, DARK_MODE_ENABLED, type ThemeMode } from "@/theme";
import { useRole } from "./RoleContext";

// Dark mode is a per-profile preference: the choice is stored keyed by the
// selected role identity (the cosmetic header persona), so switching persona
// restores that persona's light/dark choice. See ADR-0056.
const keyFor = (role: string) => `atlas.theme.${role}`;

function readMode(role: string): ThemeMode {
  // While dark mode is hidden (DARK_MODE_ENABLED=false) the app is pinned to
  // light regardless of any stored preference — the stored value is preserved
  // and honoured again once the feature is re-enabled.
  if (!DARK_MODE_ENABLED) return "light";
  return localStorage.getItem(keyFor(role)) === "dark" ? "dark" : "light";
}

interface ThemeCtx { mode: ThemeMode; toggle: () => void; setMode: (m: ThemeMode) => void; }
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { role } = useRole();
  const [mode, setModeState] = useState<ThemeMode>(() => readMode(role));
  // Track the active profile so we can reset the mode to that profile's saved
  // preference when it changes. This is React's recommended "adjust state during
  // render" pattern (not an effect) — the re-render is immediate, before paint.
  const [trackedRole, setTrackedRole] = useState(role);
  if (role !== trackedRole) {
    setTrackedRole(role);
    setModeState(readMode(role));
  }

  // Apply the palette to :root whenever the mode changes (and on first paint).
  useLayoutEffect(() => { applyThemeVars(mode); }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem(keyFor(role), m);
  }, [role]);
  const toggle = useCallback(() => setMode(mode === "dark" ? "light" : "dark"), [mode, setMode]);

  return <Ctx.Provider value={{ mode, toggle, setMode }}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider (matches RoleContext); dev-HMR only
export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
