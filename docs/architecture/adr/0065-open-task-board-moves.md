# ADR-0065 — Task board moves open to every role

**Status:** Accepted — product-owner decision; narrows/relaxes one authorization
check from ADR-0004 (server-authoritative RBAC) for a specific, low-risk action.

## Context
Real-time collaboration on the project Tasks (Kanban) board shipped in #19, but
*moving* a card (changing its status column) still required Edit on
`cap-projects`, so read-mostly roles could watch but not participate. The product
owner asked that **every role be able to move cards** on the board, while keeping
structural edits (rename, re-plan, assignee, estimates, delete, create)
restricted.

## Decision
Allow a **status-only** `PATCH /tasks/{id}` for any authenticated caller. The
server detects that the request changes *only* `Status` (every other field
absent) and skips the `cap-projects` check for that case; any request touching
another field still requires `cap-projects` Edit as before. Every move writes an
audit event (`Tasks · Moved task · {from} → {to}`). On the client the board's
drag affordance is enabled for all roles (`canMove`), independent of the
`canEdit` used for the other, still-gated, actions.

## Security & compliance
- **Least privilege (NIST AC-6).** This is a *deliberate, scoped* relaxation:
  only the board-column status transitions across the fixed status enum (validated
  server-side). It does not grant create, delete, rename, re-plan, assignment or
  any field edit — those remain behind `cap-projects`. The action is low-impact
  and fully reversible (drag it back).
- **Authorization stays server-authoritative (ISO 27001 A.5.15).** The client
  `canMove` flag is only an affordance; the server is what allows/denies. A
  request that smuggles extra fields alongside `Status` is treated as a
  non-status edit and re-gated.
- **Accountability / audit (ISO A.8.15; NIST AU-2).** Every move is audited with
  actor, task, and the from→to transition, so the broadened permission remains
  fully traceable.
- **Input validation.** The target status is still checked against the allowed
  set; unknown values are rejected `400`.

## Consequences
- **+** Anyone on the team can keep the board current — the collaboration the
  product owner wanted, matching how physical/most digital boards behave.
- **−** A small, intentional departure from strict least-privilege for one
  action. Mitigated by the status-only scoping, enum validation and per-move
  audit. If a future policy needs to tighten this (e.g. a dedicated
  `cap-task-move` capability, or excluding a specific role), the check is a single
  server predicate to adjust.
- The .NET change was written to the codebase's patterns but **not compiled
  here** (no SDK); the CI `dotnet build`/`test` gate is the confirmation
  (a test asserts a Stakeholder can move but cannot rename).

## Alternatives considered
- **A dedicated `cap-task-move` capability granted to all roles** — cleaner in
  the RBAC matrix, but requires a schema/seed migration (no `dotnet ef` here) and
  is heavier than the product owner asked for. The status-only predicate is the
  migration-free equivalent; promoting it to a named capability is an easy
  follow-up if the matrix should show it explicitly.
- **Enable it purely client-side** — rejected: authorization must be enforced on
  the server, never by the client.
