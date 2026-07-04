import React, { createContext, useContext, useMemo, useState } from "react";
import { ROLES, type RoleIdentity } from "@/nav";
import { useAuth } from "./AuthContext";

interface RoleCtx { role: string; setRole: (r: string) => void; identity: RoleIdentity; }
const Ctx = createContext<RoleCtx | null>(null);

const KEY = "atlas.role";

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // When signed in via Entra, start from the user's own app role (so a Platform
  // Administrator lands as Admin, not the demo default). With auth off, fall back
  // to the last-picked role, then the demo default.
  const [role, setRoleState] = useState<string>(() => (user?.role || localStorage.getItem(KEY) || "pmo"));
  const setRole = (r: string) => { setRoleState(r); localStorage.setItem(KEY, r); };
  const identity = useMemo<RoleIdentity>(() => {
    const base = ROLES.find((x) => x.value === role) ?? ROLES[1];
    // When signed in via Entra the identity IS the real user — the switcher only
    // changes which role's view/nav is shown. With auth off (demo) fall back to
    // the prototype's cosmetic identity.
    return user
      ? { ...base, name: user.name, initials: user.initials, roleLabel: user.username }
      : base;
  }, [role, user]);
  return <Ctx.Provider value={{ role, setRole, identity }}>{children}</Ctx.Provider>;
}

export function useRole() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRole must be used within RoleProvider");
  return c;
}
