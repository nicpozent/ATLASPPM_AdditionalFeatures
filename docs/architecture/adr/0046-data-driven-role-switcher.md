# ADR-0046 — Data-driven header role switcher

**Status:** Accepted — extends the role model (ADR-0004, ADR-0043) and CLAUDE.md §7.

## Context
The header role switcher listed a **hardcoded** set of personas (`nav.ts` ROLES).
Roles created in **Admin → Roles & Permissions** (backend `RoleDef`s) govern
access but never appeared as selectable personas — so a new role felt "invisible",
and adding one (e.g. CTO/CIO earlier) required a code edit. The switcher is a
cosmetic impersonation control (mostly for the auth-off demo and Platform-Admin
support), but the gap was a real inconsistency.

## Decision
- **Merge built-in personas with created roles.** `useRoleIdentities()` fetches the
  `/roles` matrix and appends every `RoleDef` not already represented by a built-in
  persona (dedup against persona values plus the canonical ids `team`/`exec`/
  `stkhldr`). The switcher (Topbar) and the resolved identity (RoleContext) both read
  this merged list; `usePermissions` already falls through to the raw role id, so a
  custom role gates affordances via its own matrix row.
- **A created role carries its own id.** Its switcher value is the `RoleDef` id,
  sent as `X-Atlas-Role`. `Permissions.ResolveRoleId` (auth-off) now returns the
  header as a RoleDef id when it isn't a known alias — so the selection is enforced
  by that role's matrix row. An unknown/typo id has no grants → **least privilege**,
  never full access (previously an unknown non-empty header fell through to full
  access — this also tightens that).
- **Cosmetic layer only.** Under real Entra auth the token fixes the role and only a
  Platform Admin sees the switcher; the API stays authoritative. This changes the
  demo/impersonation experience, not security.

## Consequences
- **+** A role created in Admin is immediately selectable and correctly enforced —
  no deploy, no `nav.ts` edit.
- **+** Removes the special-casing that required CTO/CIO to be hardcoded.
- **+** Tightens the auth-off fallback: unknown header → least privilege, not full.
- **−** The switcher can't show a rich demo persona (name/avatar) for a created
  role — it shows the role's name + derived initials, which is sufficient.
- **−** Relies on `/roles` loading; before it resolves, only the built-in personas
  are listed (built-ins always present, so no functional gap).

## Alternatives considered
- **Keep it hardcoded** — the status quo; rejected as the inconsistency the user
  called out.
- **Make personas fully backend-defined (drop nav.ts ROLES)** — larger change that
  would lose the rich demo identities (names/initials) the prototype relies on; the
  merge keeps both.
