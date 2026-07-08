# ADR-0044 — Azure DevOps delta (changed-since) sync

**Status:** Accepted — extends the ADO connector (ADR-0035/0036) and background
sync (ADR-0039); mirrors Jira delta (ADR-0021).

## Context
The ADO work-item sync was **full-pull only**: every run re-fetched every work
item in the mapped project via WIQL, regardless of what had changed. For a large
project that wastes API calls and lengthens each (backgrounded) run. Jira already
supported delta pulls (`LastJiraSync` watermark + `updated >= …`); ADO was the
odd connector out — and its WIQL already sorted `ORDER BY [System.ChangedDate]`,
so the ingredients were in place.

## Decision
- **Watermark.** Added `Project.LastAdoSync` (UTC ISO), the ADO analogue of
  `LastJiraSync`. Captured **before** the fetch and stamped after a successful
  pull, so items that change mid-sync are re-pulled next time (safe overlap).
- **Changed-since WIQL.** `AzureDevOps.ChangedSinceClause(delta, lastSync)` (pure,
  unit-tested) appends `AND [System.ChangedDate] >= '<watermark>'` to the work-item
  WIQL when a delta is requested and a watermark exists. The **first** delta (no
  watermark) behaves as a full pull.
- **No pruning on delta.** A delta doesn't list every item, so removing "unseen"
  rows or recomputing epic roll-ups from a partial set would wrongly delete /
  miscount unchanged rows — prune + roll-up run only on a full pull (same rule as
  Jira).
- **Wired end-to-end.** `?delta=true` on `POST /projects/{id}/ado/sync` and
  `POST /integrations/ado/sync`, threaded through `SyncProjectsCoreAsync`, the
  `AdoSyncQueue`/`AdoSyncWorker` (`AdoSyncJob.Delta`), so delta works synchronously
  **and** in the background. The Integrations screen offers an **Incremental**
  button alongside **Sync now** (full).

## Consequences
- **+** A routine re-sync pulls only changed items — fewer API calls, faster runs.
- **+** Full pull remains the default and the reconciler (prunes deletions,
  rebuilds roll-ups); delta is an explicit opt-in.
- **+** Symmetric with Jira — same watermark/no-prune semantics, easy to reason about.
- **−** Delta never prunes, so items deleted in ADO linger until the next full
  pull; run a periodic full sync to reconcile (documented).
- **−** Relies on `System.ChangedDate` accuracy; clock skew is covered by the
  before-fetch watermark capture (slight re-pull overlap, never a gap).

## Alternatives considered
- **`$expand`/revisions batch diffing** — richer but heavier; the WIQL
  changed-date filter is the same lightweight approach Jira uses.
- **Always full pull** — simplest, but the cost this ADR removes is exactly the
  motivation; kept as the default/reconciling mode instead.
