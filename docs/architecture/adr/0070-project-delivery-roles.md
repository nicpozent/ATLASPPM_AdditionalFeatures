# ADR-0070 — Project delivery roles (Technical Lead + Scrum Master)

**Status:** Accepted

## Context

The project Overview *People & roles* panel named the Project Manager (assigned
by the PMO) and eight architecture roles (assigned by the Chief Architect, with
candidates drawn from mapped Entra teams — ADR-0057). Delivery leadership — the
**Technical Lead** and, on agile projects, the **Scrum Master** — had no home,
so those assignments lived outside the tool. The product owner asked for them to
be first-class, picking from the people actually onboarded to Atlas rather than a
mapped architecture team.

## Decision

Add a **Delivery roles** group to the People & roles panel:

- **Technical Lead** — always offered.
- **Scrum Master** — offered **only when the project's methodology is agile**
  (`Scrum`, `Kanban`, `SAFe`, `Scrumban`, `Disciplined Agile`, `Extreme
  Programming`). The decision is **server-side** (`Assignments.IsAgile`), so the
  UI simply renders whatever `deliveryRoles` the API returns — the client never
  decides eligibility.
- Candidates come from the **onboarded application roster** — the resource
  directory plus Entra-synced members (`Assignments.OnboardedAsync`), **not** a
  mapped architecture team. This is the key difference from the architecture
  roles: delivery leadership is picked from whoever is actually in the app.
- Assignment is gated on `admin`/`pmo`/`pm`/`pmlead` (`CanAssignDelivery`),
  server-enforced and audited, and persisted as `RoleAssignment` rows exactly
  like the lead and architecture roles (no new table, no migration).
- `AssignmentsDto` gains `CanAssignDelivery` + `DeliveryRoles`; the assignment
  `PUT` accepts the new keys (`techLead`, `scrumMaster`).

## Consequences

- **+** Delivery leadership is named in-tool, consistent with the existing role
  model; no schema change (reuses `RoleAssignment`).
- **+** Eligibility is authoritative on the server — a non-agile project can
  never surface (or be tricked into showing) a Scrum Master.
- **+** The onboarded-roster pool means the dropdown is populated out of the box,
  without requiring an Entra team mapping first.
- **−** Two role keys are now methodology-conditional, so the panel's role set is
  no longer static; the DTO carries the resolved list rather than the client
  hard-coding it.
- The header identity remains cosmetic (CLAUDE.md §7); the server filter is the
  authoritative boundary for who may assign.

## Alternatives considered

- **Client-side methodology gate** — rejected: eligibility is an authorization/
  data decision, so it belongs on the server (the API returns the resolved list).
- **Candidates from a mapped "delivery" team** — rejected: delivery leads are
  drawn from the whole onboarded roster, not a single team; reusing the arch-team
  pool would hide valid candidates.
- **A new `DeliveryAssignment` table** — rejected: `RoleAssignment` already models
  (project, roleKey, person); new keys need no storage change.
