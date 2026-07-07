# ADR-0043 — CTO & CIO roles + role-addressed demand notifications

**Status:** Accepted — extends the role model (ADR-0004, CLAUDE.md §7) and the
notifications service (ADR-0037-era Notifications).

## Context
Two asks: (1) add **CTO** and **CIO** as roles, visible in the header switcher —
created roles hadn't appeared there because that switcher is a hardcoded list of
UI identities, separate from the RBAC role definitions; (2) when a demand is
**created or changes status**, always notify **PMO, Chief Architect, CTO, CIO,
PM Lead**, without each person subscribing to that demand.

## Decision
- **CTO / CIO as first-class roles.** Added as header-switcher identities in
  `src/nav.ts` (distinct personas: full nav, impersonable by Platform Admin) and
  mapped in `Permissions.RoleMap` (`cto`/`cio` + Entra `CTO`/`CIO`) to the
  existing **`exec`** RoleDef, so authorization is enforced at Executive level —
  no new RoleDef or migration. Their fine identity is added to `ManagerMap`
  (`cto`/`cio`) for team roll-up and notification targeting. Enforcement stays
  server-authoritative; the switcher remains cosmetic.
- **Role-addressed notifications.** New `Notifications.EmitToRolesAsync` writes an
  in-app notification addressed to `role:<key>` for each target role, excluding
  any role the actor holds (no self-ping). The inbox (`GET /notifications`) and
  mark-read now match the caller's own key **plus** `role:<key>` for every role
  key they hold, resolved by the new `Permissions.CallerRoleKeys` (auth-off: the
  switcher identity and its mappings; auth-on: every role claim through the
  manager + coarse maps). Demand **create** and **status/approval** transitions
  fan out to `{ pmo, architect, cto, cio, pmlead }` on top of the existing
  portfolio-`created` (opt-in prefs) and per-entity subscription paths.
- **Email.** Role-addressed delivery is **in-app** (the always-available channel).
  Per-person email still flows through the existing preference/subscription path;
  true per-role email needs directory-resolved addresses (future, once group→role
  membership is populated).

## Consequences
- **+** Leadership sees every demand and its status moves without subscribing.
- **+** CTO/CIO are selectable personas and enforce as Executive — no schema
  churn.
- **+** `role:<key>` addressing is reusable for any future "notify a role" event.
- **−** In-app-only for the role fan-out until per-role email addresses exist;
  documented, and the in-app bell + per-user email prefs cover the gap.
- **−** The header switcher is still not data-driven — new personas are a small
  `nav.ts` edit by design (cosmetic layer, CLAUDE.md §7).

## Alternatives considered
- **Seed distinct CTO/CIO RoleDefs** — more matrix rows with identical Executive
  enforcement; rejected as redundant (they collapse to `exec` anyway).
- **Per-demand "notify these roles" toggle** — more UI/config; the standing
  leadership set matches the ask and needs no per-demand decision.
- **Auto-subscribe those roles to every demand** — would bloat the subscription
  table and fire the entity path; role-addressing is lighter and centralised.
