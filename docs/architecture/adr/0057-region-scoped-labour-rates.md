# ADR-0057 — Region-scoped labour rate lines + regional manager roles

**Status:** Accepted — extends the need-to-know rate card of
[ADR-0055](./0055-need-to-know-labour-rates.md).

## Context
The need-to-know rate card (ADR-0055) had one line per discipline
(Dev/Infra/Architect/PM/PO). Birgma/Biltema set internal rates **per region**, and
the regional managers must see only their own region's rate — with senior
leadership (CTO/CIO) seeing all. Three regional manager personas were also
missing from the identity switcher.

## Decision
Make each rate line **discipline × region**, and add three regional manager
identities.

**13 region rate lines** (ids kept dot-free so the `rate.<line>.<level>` Settings
key still splits cleanly), each visible **and** editable only by its owners:

| Region line | Owners (view + edit) |
|-------------|----------------------|
| `infraSweden` | Infrastructure Mgr, Global Service Mgr, CTO, CIO |
| `infraApac` | Infrastructure Mgr APAC, Global Service Mgr, CTO, CIO |
| `infraCh` | Global Service Mgr, CTO, CIO |
| `devSweden` | Global Engineering Mgr, Developers Mgr, CTO, CIO |
| `devApac` | Global Engineering Mgr, Dev APAC Mgr, CTO, CIO |
| `devBlog` | Global Engineering Mgr, BLOG IT Manager, CTO, CIO |
| `devCh` | Global Engineering Mgr, CTO, CIO |
| `architectSweden` / `architectCh` | Chief Architect, CTO, CIO |
| `pmSweden` | PMO, PM Lead, CTO, CIO |
| `pmCh` | PMO, CTO, CIO |
| `poSweden` | PMO, PM Lead, CTO, CIO |
| `poCh` | PMO, CTO, CIO |

**Three new identities** (`nav.ts` `ROLES`), each **cloning its base role's RBAC
capabilities** and differing *only* in labour-rate visibility:

- **Infrastructure Manager APAC** (`inframgr_apac`) — clone of Infrastructure Manager.
- **Dev APAC Manager** (`devapac`) — clone of Developers Manager.
- **BLOG IT Manager** (`blogit`) — clone of Developers Manager.

They collapse onto the same canonical `team` RoleDef as their base in
`Permissions.RoleMap` (and the frontend `UI_TO_ROLE`), so capabilities are
identical; their `ManagerMap` slot mirrors the base so team roll-up is unchanged.
The only behavioural difference is which region line they own in
`LaborRates.Access`.

`LaborRates` still filters server-side: `GET /labor-rates` returns only the region
lines the caller's effective UI role may see; `PUT` scopes writes to owned lines.

## Consequences
- **+** Rates are region-precise and least-privilege: a regional manager sees one
  line, the service/engineering leads see their discipline's regions, CTO/CIO see
  everything.
- **+** No schema change — region lines are just new `rate.<line>.<level>` keys;
  the old per-discipline keys become inert (empty by default).
- **+** New identities reuse the existing role machinery (RoleMap/ManagerMap/
  UI_TO_ROLE) — no new capability rows, no migration.
- **−** More lines to populate; empty is the correct default until leadership
  enters values.
- **−** The three regional personas differ from their base only by rate scope, so
  their broader capabilities are intentionally identical (not a finer authz split);
  the header identity remains cosmetic (CLAUDE.md §7), with the server filtering as
  the authoritative boundary for what leaves the API.

## Alternatives considered
- **A region dropdown on one discipline line** — rejected: visibility is
  per-region, so region must be part of the ownable unit, not a filter.
- **Distinct capability sets for the new managers** — rejected: the requirement is
  *same rights, different rate visibility*; cloning the base RoleDef is exactly
  that with no new matrix rows.
