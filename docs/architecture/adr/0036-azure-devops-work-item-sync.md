# ADR-0036 — Azure DevOps work-item sync

**Status:** Accepted — extends [ADR-0035](./0035-azure-devops-connector.md) (the
connect·discover·map scaffold) and follows the Jira sync pattern
([ADR-0006](./0006-jira-pull-only-board-optional.md)).

## Context
ADR-0035 shipped the Azure DevOps connector as connect → discover → map: it
stored `Project.AdoProject` but pulled no delivery data. The mapping was laid
down precisely so this sync could read it. We now turn the scaffold into a
working second connector: ADO iterations → Atlas sprints and ADO work items →
Atlas epics / tasks / backlog.

## Decision
- **`AzureDevOps.SyncProjectAsync`** mirrors the Jira engine's contract: one-way
  (ADO → Atlas), idempotent, prune-on-full-pull. It keys on `Project.AdoProject`
  and on a new `AdoId` column added to `Sprint`, `Epic` and `ProjectTask`
  (parallel to `JiraKey`, so a project could in principle carry either source
  without collision).
- **Iterations → sprints.** `GET .../wit/classificationnodes/iterations` is
  flattened to leaf iterations (nodes carrying a start date); each is upserted as
  a `Sprint` by its `identifier`, carrying name + start/finish dates.
- **Work items.** A **WIQL** query returns the project's work-item ids
  (`WHERE [System.TeamProject] = '<project>'`, capped at 4000), then details are
  fetched in **batches of 200**. Type `Epic` → `Epic` (pass 1, so tasks can link
  by parent); all other types → `ProjectTask` (pass 2). Mapping: `System.State`
  → Atlas status via `MapAdoState` (Agile/Scrum/Basic aware), priority 1–4 →
  Critical/High/Medium/Low, `IterationPath` leaf → sprint name, `System.Parent`
  → epic name, `System.Description` HTML → text. Items with no iteration land in
  the backlog.
- **Two entry points**, both gated on Integrations (Edit): per-project
  `POST /projects/{id}/ado/sync` and all-mapped `POST /integrations/ado/sync`.
  A "Sync now" button on the Azure DevOps card runs the all-mapped pass.

## Consequences
- **+** ADO becomes a real, testable second delivery-data source reusing the
  Jira model (sprints/epics/tasks/backlog, pruning, epic rollups) — no new
  read-side code in the screens.
- **+** Idempotent by `AdoId`; re-syncs never duplicate and never touch manual
  rows. Pure mapping helpers are unit-tested; endpoints degrade gracefully when
  unconfigured/unmapped (no 500s).
- **−** **Bounded & synchronous**: WIQL capped at 4000 items (200/request), a
  `Truncated` flag signals the cap; there is no background-queue path yet (unlike
  Jira's ADR-0030). Large orgs may need that follow-up.
- **−** **No attachments/comments** and **no delta** yet (Jira has both) — the
  sync is a full pull of the current field set.
- **−** Board scoping is by **team project**, not a specific ADO team's board;
  sufficient for the portfolio view, revisit if per-team boards are needed.

## Alternatives considered
- **Reuse `JiraKey` as a generic external key** — would let Jira's prune step
  clobber ADO rows; rejected in favour of a dedicated `AdoId`.
- **Background queue from day one** (mirror ADR-0030) — deferred; a bounded
  synchronous pull is adequate for the first real sync and keeps the diff small.
- **Map ADO `Feature` to a distinct Atlas level** — Atlas has only Epic/Task, so
  Features sync as tasks; only `Epic` becomes an Atlas epic.
