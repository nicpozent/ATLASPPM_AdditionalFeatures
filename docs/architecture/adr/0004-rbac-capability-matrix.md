# ADR-0004 — Server-authoritative RBAC capability matrix

**Status:** Accepted

## Context
Different roles (Platform Admin, PMO, PM, team/managers, Executive, Stakeholder)
get different access. The prototype exposes 9 cosmetic identities; the backend
must enforce a small, auditable authorization model that admins can tune.

## Decision
Model authorization as a **DB-backed capability matrix**: capabilities
(`cap-projects`, `cap-schedule`, `cap-approve`, …) × 6 canonical roles, each cell a
level `N < V < E < F`. Enforcement is **server-side** via
`Permissions.Allows/Deny`. The 9 UI identities and manager slots resolve onto the
6 roles; fine manager identity is retained for scope roll-ups. The client
(`usePermissions`) mirrors the matrix **only to hide affordances** — never as the
control. A boot-time reconcile adds new capabilities/roles with sensible defaults
without overwriting admin edits.

## Consequences
- **+** Single source of truth, editable in Admin → Roles & Permissions, auditable.
- **+** New capabilities roll out safely (idempotent reconcile).
- **+** Security cannot be bypassed from the client.
- **−** Checks exist in two places (server enforce + client hint) that must stay in
  sync; mitigated by shared capability keys and the client defaulting to
  optimistic-until-loaded then matching server ranks.

## Alternatives considered
- **Hard-coded role checks** — brittle, not admin-tunable.
- **External policy engine (OPA)** — overkill for a fixed capability set.
