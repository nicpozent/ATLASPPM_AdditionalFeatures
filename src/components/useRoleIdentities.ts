import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";
import { ROLES, type RoleIdentity } from "@/nav";

// ============================================================================
//  The role-switcher's option list. The built-in cosmetic personas (nav.ts
//  ROLES) PLUS any role CREATED in Admin → Roles & Permissions that isn't already
//  represented by a persona — so custom roles are selectable in the header
//  switcher, not just the hardcoded ones. A custom role carries its own RoleDef
//  id as the value (sent as X-Atlas-Role); the server enforces it by that role's
//  matrix row (Permissions.ResolveRoleId). Cosmetic layer only — the API stays
//  authoritative (CLAUDE.md §7).
// ============================================================================
interface RoleRow { id: string; name: string; short?: string; who?: string; }
interface RolesMatrix { roles: RoleRow[]; }

// Two-letter initials from a display name (first + last word, else first two chars).
function initialsOf(s: string): string {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  const ini = parts.length > 1
    ? (parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")
    : (parts[0] ?? "").slice(0, 2);
  return ini.toUpperCase() || "?";
}

// The canonical RoleDef ids already covered by a built-in persona, so we don't
// list them twice (team/exec/stkhldr are reached via manager/exec/stakeholder personas).
const COVERED = new Set<string>([...ROLES.map((r) => r.value), "team", "exec", "stkhldr"]);

export function useRoleIdentities(): RoleIdentity[] {
  const { data } = useQuery({
    queryKey: ["roles"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<RolesMatrix> => (await api<RolesMatrix>("/roles")) ?? { roles: [] },
  });
  return useMemo(() => {
    const custom = (data?.roles ?? [])
      .filter((r) => !COVERED.has(r.id))
      .map<RoleIdentity>((r) => ({
        value: r.id, label: r.name, name: r.name,
        roleLabel: r.who || r.name, initials: initialsOf(r.short || r.name),
      }));
    return [...ROLES, ...custom];
  }, [data]);
}
