import React, { createContext, useContext, useMemo, useState } from "react";
import { ROLES, type RoleIdentity } from "@/nav";

interface RoleCtx { role: string; setRole: (r: string) => void; identity: RoleIdentity; }
const Ctx = createContext<RoleCtx | null>(null);

const KEY = "atlas.role";

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<string>(() => localStorage.getItem(KEY) || "pmo");
  const setRole = (r: string) => { setRoleState(r); localStorage.setItem(KEY, r); };
  const identity = useMemo(() => ROLES.find((x) => x.value === role) ?? ROLES[1], [role]);
  return <Ctx.Provider value={{ role, setRole, identity }}>{children}</Ctx.Provider>;
}

export function useRole() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRole must be used within RoleProvider");
  return c;
}
