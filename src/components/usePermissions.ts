import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";
import { useRole } from "./RoleContext";

// ============================================================================
//  Client mirror of the server's permission check (Permissions.cs). Reads the
//  same DB-backed matrix (/roles) so create/edit affordances can be hidden or
//  disabled for roles that lack the capability — sparing the user a form they
//  can't submit. This is COSMETIC only; the API remains authoritative.
// ============================================================================
type PermLevel = "F" | "E" | "V" | "N";
interface RoleRow { id: string; permissions: Record<string, PermLevel>; }
interface RolesMatrix { roles: RoleRow[]; }

const RANK: Record<string, number> = { F: 3, E: 2, V: 1, N: 0 };

// The cosmetic UI identities collapse onto the matrix role ids (same map the
// backend uses for the X-Atlas-Role header). Anything not listed — e.g. a role
// CREATED in Admin — falls through to its own id and is matched directly.
const UI_TO_ROLE: Record<string, string> = {
  admin: "admin", pmo: "pmo", pm: "pm", pmlead: "pmlead",
  teammgr: "team", svcmgr: "team", devmgr: "team", inframgr: "team",
  devapac: "team", blogit: "team", inframgr_apac: "team",
  architect: "pmo", cto: "exec", cio: "exec", stakeholder: "stkhldr",
};

export function usePermissions() {
  const { role } = useRole();
  const { data } = useQuery({
    queryKey: ["roles"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<RolesMatrix> => (await api<RolesMatrix>("/roles")) ?? { roles: [] },
  });

  const roleId = UI_TO_ROLE[role] ?? role;
  const roleRow = data?.roles.find((r) => r.id === roleId);

  // Optimistic until the matrix loads (matches the dev full-access default);
  // once loaded, enforce the same None<View<Edit<Full comparison as the server.
  const can = (capability: string, min: PermLevel = "E"): boolean => {
    if (!roleRow) return true;
    return (RANK[roleRow.permissions[capability] ?? "N"] ?? 0) >= RANK[min];
  };

  return { can };
}
