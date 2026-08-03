# ADR-0080 — Jira bidirectional write-back (push actions)

**Status:** Proposed — *awaiting product-owner decision (scope + fit)*
**Date:** 2026-08-03
**Amends / would supersede in part:** ADR-0006 (Jira pull-only, board-optional)
**Relates to:** ADR-0007 (background workers), ADR-0018 (full-field import),
ADR-0021 (delta + per-entity sync), ADR-0030 (background Jira sync),
ADR-0004 (RBAC), ADR-0009 (secrets), ADR-0065 (task-board moves = cap-schedule),
the platform threat model (`docs/threat-model.md`)

> This is a **scoping / decision record**, not an accepted design. It exists so
> the product owner can **accept, reshape, or reject** the capability before any
> code is written. Because it reverses a foundational decision, it must not be
> implemented until it graduates to *Accepted*, is recorded in CLAUDE.md §2
> "Approved extensions", and `design/` is flagged for regeneration.

## Context

Atlas integrates Jira as a **pull-only** sync (ADR-0006): every call in the
connector is a `GET` (issues, sprints, boards, JQL search, attachments), Atlas is
the **system of record for its own planning layer**, and the connector converges
by idempotent upsert + prune. ADR-0006 **explicitly rejected two-way sync** for
"conflict/ownership complexity and blast radius", and noted a future push model
"is possible but needs inbound endpoints".

A request has been raised to make the connector **bidirectional** — to write back
to Jira: create issues, transition state (move board columns), set
owner/assignee, edit details, and — at the far end — create new projects/boards
and then populate them.

**The core tension.** Reading is safe and convergent because data flows one way.
Writing makes Atlas and Jira **co-authoritative over the same objects**, which
introduces conflict, echo (a write that bounces back through the next sync and
clobbers), attribution, workflow-validity and blast-radius problems that ADR-0006
deliberately avoided. This ADR's first job is to decide *whether* and *how far* to
open write-back, not to assume a symmetric mirror.

## Feasibility (all capabilities map to real Jira APIs)

| Capability | Jira REST/Agile API | Notes |
|---|---|---|
| Create issue/task | `POST /rest/api/3/issue` | needs project + issuetype + required fields |
| Transition state / move column | `GET` then `POST /issue/{key}/transitions` | workflow-driven; a *column* is a board status |
| Set assignee/owner | `PUT /issue/{key}/assignee` | by Jira `accountId` |
| Edit details (summary/description/estimate/fields) | `PUT /issue/{key}` | ADF for rich text; custom-field ids per project |
| Create / manage sprint | `POST /rest/agile/1.0/sprint`, `POST /sprint/{id}/issue` | board-scoped |
| Create project | `POST /rest/api/3/project` | **Jira admin**; template + lead required |
| Create board | `POST /rest/agile/1.0/board` | **admin**; requires a saved filter |

The API surface is entirely available. The difficulty is **semantics and safety**,
not the calls.

## Proposed decision (for the PO to confirm)

**Recommended: bounded, explicit, user-initiated *push actions* — not a symmetric
background mirror.** Atlas stays system-of-record for its planning layer; writes
are discrete, intentional, audited operations a user triggers (e.g. "push this
card's status to Jira"), not a continuous two-way reconciliation. This keeps most
of the conflict/echo complexity out of scope while delivering the high-value
cases. Deliver in tiers; ship **Tier 1 first** and gate everything behind config +
capability + per-project opt-in.

### Scope if accepted — tiers

- **Tier 1 — issue write-back (recommended first pass).** Create issue, transition
  status (board-column move), reassign, edit summary/description/estimate. Maps
  directly onto the Kanban board and task edits Atlas already has. Highest value,
  most contained.
- **Tier 2 — sprint operations.** Create sprint, move issues in/out. Moderate.
- **Tier 3 — project & board creation (recommended *parked*).** Rare, needs Jira
  admin, highest blast radius; normally a one-time admin task. Left manual (or a
  heavily-guarded one-off), not a standing Atlas feature, unless the PO
  specifically requires it.

### The hard parts any implementation must solve

1. **Conflict & echo model.** Both sides now mutate the same issue. Need a
   resolution policy (recommend **Jira-wins on the mirrored fields**, Atlas
   authoritative only for its own planning overlay), an **echo-suppression** marker
   so a push doesn't re-import and clobber on the next sync, and a durable
   Atlas-id ↔ Jira-key mapping valid in both directions.
2. **Workflow/transition validity.** Cannot set `status = "Done"` directly — must
   read the valid transitions from the current status and only offer those, and
   handle transition screens / required fields (e.g. resolution).
3. **Reverse field & user mapping.** The read mappings (`MapIssueStatus`,
   `MapPriority`, ADF↔text) are intentionally lossy; write-back needs the inverse,
   per-project custom fields, required-field validation, and Atlas-person → Jira
   `accountId` resolution (today unknown assignees are only *flagged*).
4. **Attribution & auth (ADR-0009).** A service-account token makes every Atlas
   edit appear as one bot user and needs elevated scopes (Create/Edit/Transition;
   **admin** for Tier 3). True per-user attribution means OAuth 3LO — a large lift;
   call it out as an explicit decision.
5. **Authorization (ADR-0004, server-authoritative).** Reuse the existing
   capabilities — status/column moves under `cap-schedule` (consistent with
   ADR-0065), field edits under `cap-projects`; Tier 3 admin-only. Never a client
   security decision.
6. **Blast radius & safety.** Writes hit the team's *live* Jira. Require:
   **config guard** (`Jira:WriteEnabled`, default off), **per-project write opt-in**,
   full **audit** of every push, rate-limiting, a **dry-run/preview**, and
   confirm-before-push UX for destructive/irreversible actions.

### Data / API / UI (sketch, if accepted)
- **Data:** a per-issue link/mapping row (Atlas task ↔ Jira key) with a
  `lastPushedHash` / origin marker for echo-suppression; a per-project
  `jiraWriteEnabled` flag. No new hot path — writes are on-demand.
- **API:** additive, action-shaped endpoints under the existing Jira group
  (e.g. `POST /tasks/{id}/jira/push`, `POST /tasks/{id}/jira/transition`), each
  capability-gated and audited; reuse the existing `Jira.Client` (with write
  scopes) and paging/ADF helpers.
- **UI:** built in the existing design language — a "push to Jira" affordance on
  the task card / board move, a transition picker fed by *valid* Jira transitions,
  and a clear per-project write-enable switch in Integrations. `design/` regen
  flagged.
- **Freshness (related, separate):** for near-real-time convergence, replace
  polling with inbound **Jira webhooks** — the inbound endpoints ADR-0006 foresaw.
  Trackable as its own ADR; not required for Tier 1.

## Consequences

**Positive** — closes the loop so planners can drive Jira from Atlas (create,
transition, assign, edit) without leaving the tool; reuses the existing connector,
capability matrix, audit and theming; action-based scope avoids the worst of the
mirror-conflict problem.

**Negative / risks** — reverses ADR-0006's "no accidental write-back" guarantee;
introduces real conflict/echo/attribution complexity; a bug writes to production
Jira (mitigated by config guard + per-project opt-in + audit + dry-run); elevated
Jira scopes widen the connector's trust boundary (threat-model review required);
Tier 3 creation is high-privilege and low-frequency — poor cost/benefit as a
routine feature.

## Alternatives considered

- **Do nothing (stay pull-only).** Cheapest; leaves the ask unmet. Atlas remains a
  read-only mirror of Jira delivery.
- **Symmetric background two-way sync.** Rejected — this is exactly the
  conflict/ownership/blast-radius model ADR-0006 walked away from; the echo and
  merge complexity is high and the failure modes are silent.
- **Bounded push actions (recommended).** User-initiated, discrete, audited writes;
  most value for least conflict surface.
- **Full project/board provisioning from Atlas.** Rejected as a first step —
  admin-scoped, rare, high blast radius; re-scopes Atlas toward Jira
  administration.

## Open questions for the product owner

1. **Scope:** Tier 1 only for the first pass, or also Tier 2? Is Tier 3 (project/
   board creation) actually required, or can it stay a manual Jira-admin task?
2. **Conflict policy:** confirm **Jira-wins** on mirrored fields, with Atlas
   authoritative only for its own planning overlay?
3. **Attribution / auth:** acceptable to write as a single service account
   (simpler, but all edits show as one bot user), or is per-user OAuth 3LO
   required?
4. **Authorization:** reuse `cap-schedule` (moves) + `cap-projects` (edits), or
   introduce a dedicated `cap-jira-write`?
5. **Safety envelope:** confirm config-guarded + per-project opt-in + audited +
   dry-run as the minimum bar before any write ships.
6. **Freshness:** is inbound Jira-webhook support in scope now, or a later ADR?
