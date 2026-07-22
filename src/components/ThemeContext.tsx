import React, { createContext, useContext, useCallback, useLayoutEffect, useState } from "react";
import { applyThemeVars, DARK_MODE_ENABLED, isThemeId, type ThemeId } from "@/theme";
import { useRole } from "./RoleContext";

// The theme is a per-profile preference: the choice is stored keyed by the
// selected role identity (the cosmetic header persona), so switching persona
// restores that persona's theme. Light stays the default (ADR-0056, ADR-0074).
const keyFor = (role: string) => `atlas.theme.${role}`;

function readTheme(role: string): ThemeId {
  const stored = localStorage.getItem(keyFor(role));
  if (!isThemeId(stored)) return "light";
  // Atlas Dark stays gated behind DARK_MODE_ENABLED — if the flag is off, a
  // stored "dark" preference falls back to light (the value is preserved and
  // honoured again once the flag is re-enabled). Atlas themes are not gated.
  if (stored === "dark" && !DARK_MODE_ENABLED) return "light";
  return stored;
}

interface ThemeCtx { theme: ThemeId; setTheme: (id: ThemeId) => void; }
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { role } = useRole();
  const [theme, setThemeState] = useState<ThemeId>(() => readTheme(role));
  // Track the active profile so we can reset the theme to that profile's saved
  // preference when it changes. This is React's recommended "adjust state during
  // render" pattern (not an effect) — the re-render is immediate, before paint.
  const [trackedRole, setTrackedRole] = useState(role);
  if (role !== trackedRole) {
    setTrackedRole(role);
    setThemeState(readTheme(role));
  }

  // Apply the palette to :root whenever the theme changes (and on first paint).
  useLayoutEffect(() => { applyThemeVars(theme); }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    localStorage.setItem(keyFor(role), id);
  }, [role]);

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider (matches RoleContext); dev-HMR only
export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
