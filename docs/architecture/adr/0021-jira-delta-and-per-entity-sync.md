# ADR-0021 — Jira delta sync + per-entity sync

**Status:** Accepted (extends ADR-0006, ADR-0018)

## Context
Sync (ADR-0006/0018) was full-only and lived on the project's Tasks tab or the
global "Sync now". Two asks: sync **one entity on demand from its Overview**
(project / program / product), and a **delta** that only pulls what changed so
re-syncs are cheap.

## Decision
- **Delta pulls.** `Project.LastJiraSync` stores the UTC watermark of the last
  successful sync. `SyncProjectAsync(..., delta)` appends `AND updated >= "<watermark>"`
  to the issue JQL (`Jira.DeltaClause`, pure/tested). A delta run:
  - always uses the JQL project search (so the watermark applies even when a
    board is mapped — a full run with a board keeps the board endpoint for
    backlog ordering);
  - **disables pruning and full epic-rollup recompute**, because a delta doesn't
    list every issue and removing "unseen" rows would wrongly delete unchanged
    ones. The first delta (no watermark) behaves as a full pull.
  The watermark is stamped *after* a successful pull; the endpoints accept
  `?delta=true`.
- **Per-entity sync.** `POST /projects/{id}/jira/sync`, plus new
  `POST /programs/{id}/jira/sync` and `POST /products/{id}/jira/sync` which sync
  each **linked, mapped** project (delta by default) and report a roll-up. A
  reusable `JiraSyncButton` on each entity's Overview does a delta on click and
  offers a "Full re-sync"; the project card shows its last-sync time.
- **Import a Jira project as an Ops service.** The import endpoint gains an
  `ops` target (gated on `cap-ops`, not `cap-projects`): it creates an
  `OpsService` carrying the `JiraProjectKey` and upserts the project's issues as
  `OpsItem`s keyed by Jira issue key (idempotent re-import; allocation left 0).
  Issue type/status map to the Ops vocabulary. Ops services also gain
  **archive/unarchive** (`Archived` flag; hidden from the board unless
  `includeArchived`), completing service lifecycle alongside the existing
  create/edit/delete and item CRUD.

## Consequences
- **+** Re-syncs are fast (only changed issues) and can be triggered where the
  user is, per entity. Full re-sync still available for a clean reconcile.
- **+** Delta correctness: no accidental deletion of unchanged rows.
- **−** Delta can't detect issues *deleted* in Jira (they don't appear in an
  "updated since" result) — a periodic full sync reconciles those. Documented.
- **−** The watermark is minute-granular; an issue updated in the same minute as
  a sync may be re-pulled next time (idempotent upsert, so harmless).

## Alternatives considered
- **Always full** — simple but wasteful on large boards; the reason for delta.
- **Track per-issue updated timestamps to prune** — heavier; a periodic full
  sync already reconciles deletions.
- **Webhooks** — the real long-term answer (ADR-0006 "later phases"); delta is
  the pull-only interim.
