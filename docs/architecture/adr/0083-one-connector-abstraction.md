# ADR-0083 — One work-item connector abstraction

**Status:** Accepted
**Date:** 2026-08-04
**Relates to:** ADR-0006 (Jira pull-only), ADR-0030 (background Jira sync),
ADR-0035/0039 (Azure DevOps connector + background sync), ADR-0040 (queue-depth
metric), ADR-0072 (module-boundary ratchet — Integrations is a leaf), ADR-0082
(dates as real types — the watermark format follows it). Implements remediation
item **R15 / #101**; inherits **R2** (gate-before-enqueue) and **R5**
(connector logging).

## Context

Jira (`Integrations/Jira.cs`, ~1300 lines) and Azure DevOps
(`Integrations/AzureDevOps.cs`, ~550 lines) implemented the **same nine roles
with no shared code**: a configured check, an HTTP client, an endpoint map, an
enqueue helper, a bulk sync, a target resolver, a single-project sync, and
status/priority maps — plus a near-identical background **queue + worker** each
(`JiraSyncQueue`/`JiraSyncWorker`, `AdoSyncQueue`/`AdoSyncWorker`). CLAUDE.md §5
lists four more connectors planned (ServiceNow, ManageEngine SDP, GitHub,
Confluence); each would have been another full copy.

Copy-not-share had already produced concrete bugs and drift:

- **R2** was exactly this: one copy gated before enqueue, the other didn't.
- **Permission divergence.** The per-project sync trigger had *no* gate on Jira
  (argued deliberately as "pull-only, open to any role") but required
  `cap-integrations` Edit on ADO. Same button, same semantics, different rights.
- **Watermark divergence.** `Project.LastJiraSync` was stored as
  `"yyyy-MM-dd HH:mm"`; `Project.LastAdoSync` as UTC ISO. Same concept, two
  formats.
- Two identical bulk-result records (`BulkSyncResult` / `AdoBulkResult`).

## Decision

Extract the genuinely-shared pipeline into one abstraction in
`Integrations/WorkItemConnector.cs`; leave the genuinely connector-specific
parsing where it is.

**Shared (exists once now):**

- `interface IWorkItemConnector` — `Name`, `DisplayName`, `Configured(cfg)`,
  `ResolveTargetsAsync(db, kind, targetId)`, `SyncCoreAsync(db, cfg, targets,
  delta)`. Two thin adapters — `JiraConnector`, `AdoConnector` — delegate to the
  existing statics.
- `record BulkSyncResult(int Projects, int Sprints, int Epics, int Tasks,
  List<string> Errors)` — replaces the two identical copies.
- `class SyncQueue<TConnector>` + `class SyncWorker<TConnector>` — one generic
  queue + background worker, keyed by connector type in DI. Replaces the two
  copied queue/worker pairs (and the four job/status DTOs → `SyncJob` /
  `SyncJobStatus`).
- `SyncEndpoints.Queue<T>(…)` + `MapSyncStatus<T>(name)` — the enqueue/202 and
  poll contract, so the **gate → configured-check → enqueue → 202 → poll** shape
  (where the R2 bug lived) exists in one place.

**Kept connector-specific (must NOT be forced into a common shape):** Jira's ADF
flattening, sprint custom-field resolution, JQL/agile paging; ADO's WIQL query,
work-item batched paging, PAT/Basic auth, iteration-tree flatten; each
connector's `SyncProjectAsync` and its status/priority maps (different
vocabularies and signatures — `string` name vs `int`). The fixture tests
(`JiraSyncFixtureTests`, `AdoSyncFixtureTests`) call these concrete methods and
pass **unchanged**.

### Resolved: the per-entity sync permission (was Jira-none vs ADO-cap-integrations)

Adopt a **tiered** rule, applied to both connectors:

- **Per-entity sync** (`/projects/{id}`, `/programs/{id}`, `/products/{id}` …
  `/sync`) requires **`cap-projects` Edit** — you may refresh an entity you can
  edit. This *tightens* Jira's fully-open path and *aligns* ADO (down from
  `cap-integrations`), so the same button behaves the same way in both.
- **Portfolio-wide bulk sync** (`/integrations/{name}/sync`) and **connector
  configuration** (test, credentials) stay behind **`cap-integrations` Edit**.
- **Poll status** stays ungated (a job id is an opaque, unguessable handle).

Rationale: triggering a refresh of one entity is a project-management action;
administering the connector portfolio-wide is an integration-administration
action. This is the model the four planned connectors inherit. The Ops-service
re-sync (`/ops/services/{id}/jira/sync`) is an Ops-domain action and keeps its
existing `cap-integrations` gate (out of the per-entity project family).

### Resolved: the watermark format

Both watermarks are now written as **UTC ISO-8601**
(`yyyy-MM-ddTHH:mm:ssZ`) via a shared `SyncWatermark.Now()`, forward-compatible
with ADR-0082 (a later move to a real `timestamptz` column is a no-op reformat).
Each connector reformats at read time into its own query language:
`Jira.DeltaClause` parses the ISO watermark and emits JQL's `yyyy-MM-dd HH:mm`;
`AzureDevOps.ChangedSinceClause` injects ISO into WIQL (already accepted). The
`DeltaClause` unit test passes unchanged (a legacy-format input round-trips).

## Consequences

- **Positive.** The queue/worker/enqueue/poll/audit exist once; a fifth
  connector implements `IWorkItemConnector` (+ its own parsing) instead of
  copying a file. The R2 class of bug can't recur — there's one gate. The
  permission and watermark divergences are gone.
- **Boundary.** Everything new lives in `Atlas.Api.Integrations`, which stays a
  leaf (ADR-0072); `ArchitectureTests` passes.
- **Behaviour change.** A view-only role (e.g. Stakeholder/Executive) can no
  longer trigger a per-project Jira sync — it now needs `cap-projects` Edit, as
  ADO always did. This is the intended unification; the prototype's "Sync from
  Jira" button is a PM/PMO action.
- **Tests.** All 507 pass. The fixture sync tests are unchanged; the per-connector
  queue tests were consolidated into `SyncQueueTests` (covering the generic queue
  for both connectors + the adapter contract); the Jira/ADO authz tests were
  updated to assert the new tiered rule.
- **Not unified (deliberately).** The scheduled `JiraSyncService` (timer-driven)
  has no ADO counterpart, so there was no duplication to remove; it stays as-is.
