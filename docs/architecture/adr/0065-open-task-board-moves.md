# ADR-0065 — Task board moves scoped to the planner roles

**Status:** Accepted — product-owner decision. **Revised 2026-07-13:** the move
right, briefly opened to *every* role, is now scoped to the four planner roles
(Platform Admin, PMO, Project Manager, PM Lead). Authorization stays
server-authoritative per ADR-0004.

## Context
Real-time collaboration on the project Tasks (Kanban) board shipped in #19.
*Moving* a card (changing its status column) originally required Edit on
`cap-projects`. In the first cut of this ADR the product owner asked that **every
role** be able to move cards; on review that was judged too broad — moving a card
advances delivery state, which is a **planning/scheduling** act, not something a
read-mostly stakeholder or an unrelated team member should do on any board. The
product owner therefore narrowed it: **only Platform Admin, PMO, Project Manager
and PM Lead may move cards.** Live collaboration itself (presence, peer cursors,
instant refresh) remains open to every role — you can watch the board move in
real time regardless of role; you just can't move a card unless you plan the work.

## Decision
A **status-only** `PATCH /tasks/{id}` requires Edit on **`cap-schedule`**
("Project schedule") — the capability held by exactly Platform Admin, PMO,
Project Manager and PM Lead, and the same right that already gates *creating* a
task. The server detects that the request changes *only* `Status` (every other
field absent) and applies `cap-schedule`; any request touching another field
still requires `cap-projects` Edit as before. Every move writes an audit event
(`Tasks · Moved task · {from} → {to}`). The `GET /projects/{id}/tasks` response
carries a `canMove` flag (= `cap-schedule` Edit) that drives the board's drag
affordance on the client; it is an affordance only — the server is authoritative.

## Security & compliance
- **Least privilege (NIST AC-6).** Moving a card is now bound to the schedule
  right, so the permission tracks the people who own delivery state. This is the
  *tightening* of the earlier open stance, not a relaxation — the least-privilege
  posture is restored. It still grants no create, delete, rename, re-plan,
  assignment or field edit; those remain behind `cap-projects`.
- **Authorization stays server-authoritative (ISO 27001 A.5.15).** The client
  `canMove` flag is only an affordance; the server allows/denies. A request that
  smuggles extra fields alongside `Status` is treated as a non-status edit and
  gated by `cap-projects`.
- **Accountability / audit (ISO A.8.15; NIST AU-2).** Every move is audited with
  actor, task and the from→to transition, so the action remains fully traceable.
- **Input validation.** The target status is still checked against the allowed
  set; unknown values are rejected `400`.

## Consequences
- **+** Board state changes are limited to the roles accountable for planning,
  while everyone can still collaborate live (watch, point, follow).
- **+** Reuses an existing capability (`cap-schedule`) — no schema/seed migration,
  and the RBAC matrix already shows who holds it.
- **−** A team member who previously (very briefly) could drag a card no longer
  can; they update task state via the task detail edit if they hold `cap-projects`.
  This is the intended narrowing.

## Alternatives considered
- **Keep it open to every role** — the first version of this ADR; rejected by the
  product owner as too broad for a delivery-state change.
- **A dedicated `cap-task-move` capability** — cleaner to show a distinct cell in
  the matrix, but `cap-schedule` already partitions exactly the intended four
  roles and needs no migration; a dedicated capability is an easy follow-up if the
  matrix should name it explicitly.
- **Enable/scope it purely client-side** — rejected: authorization must be
  enforced on the server, never by the client.
