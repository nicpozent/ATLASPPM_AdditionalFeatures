# ADR-0006 — Jira integration: pull-only, board-optional

**Status:** Accepted

## Context
Teams track delivery in Jira. Atlas must reflect Jira work (projects, issues,
sprints, epics) without becoming a second source of truth or risking writes back
to Jira. Not every Jira project has an agile **board** — some are "spaces" with a
timeline/kanban, a project key, dates and tasks but no board id.

## Decision
Integrate Jira as a **pull-only** sync keyed on the **project key alone**; a board
id is optional:
- **With a board** — use the Agile API for sprints, board epics and issues.
- **Without a board** — page issues via the **enhanced JQL search** (`project = KEY`),
  derive epics from Epic-type issues, and skip sprints.
Three entry points share `Jira.SyncProjectAsync`: manual **Sync**, an automatic
one-shot when a project's Jira key is set, and a scheduled worker (ADR-0007).
Assignees not present in the directory are **flagged** (not dropped) for onboarding.

## Consequences
- **+** Atlas stays the system of record; no accidental write-back.
- **+** Board-less "spaces" map correctly — a common real-world case.
- **+** Idempotent upsert + prune keeps Atlas convergent with Jira.
- **−** No real-time updates (poll-based); staleness bounded by the sync interval.
  A future push model (Jira webhooks) is possible but needs inbound endpoints.
- **−** Enhanced-JQL pagination and API differences add connector complexity.

## Alternatives considered
- **Two-way sync** — rejected: conflict/ownership complexity and blast radius.
- **Board-required only** — rejected: excludes board-less projects entirely.
