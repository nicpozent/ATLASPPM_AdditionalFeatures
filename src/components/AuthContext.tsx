// ============================================================================
//  Auth context — exposes the signed-in Entra user + login/logout to the UI.
//  When auth is disabled (VITE_AUTH_ENABLED=false) this is inert: `enabled`
//  is false, `user` is null, and the app renders normally (no gate, no
//  sign-out), so the empty-state mockup stays fully browsable with no backend.
// ============================================================================
import React, { createContext, useContext } from "react";
import { AUTH_ENABLED, currentUser, login, logout, type AuthUser } from "@/auth";
import { LoginScreen } from "./LoginScreen";
import { IdleLogout } from "./IdleLogout";

interface AuthCtx { enabled: boolean; user: AuthUser | null; login: () => void; logout: () => void; }
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // currentUser() reads MSAL's in-memory active account, already resolved by
  // handleRedirect() during boot, so a plain read is correct here.
  const user = currentUser();
  const value: AuthCtx = { enabled: AUTH_ENABLED, user, login, logout };

  // Gate the app behind sign-in only when auth is enabled and nobody is signed in.
  if (AUTH_ENABLED && !user) {
    return (
      <Ctx.Provider value={value}>
        <LoginScreen onSignIn={login} />
      </Ctx.Provider>
    );
  }
  return (
    <Ctx.Provider value={value}>
      {/* Sign out an unattended, authenticated session after the idle window. */}
      {AUTH_ENABLED && user && <IdleLogout onIdle={logout} />}
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
