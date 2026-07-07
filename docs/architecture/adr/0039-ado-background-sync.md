# ADR-0039 — Background Azure DevOps sync

**Status:** Accepted — applies the background-sync pattern of
[ADR-0030](./0030-background-jira-sync.md) to the Azure DevOps connector
(ADR-0035/0036).

## Context
The ADO work-item sync (ADR-0036) shipped **synchronous** and bounded to 4000
work items, to avoid a request-path 504 on a large project. That cap is an
artificial product limit, and a big org can still be slow enough to time out the
edge/gateway on the request path. Jira already solved this (ADR-0030) with an
in-process queue + hosted worker + poll; ADO should match.

## Decision
- **`AdoSyncQueue` + `AdoSyncWorker`** mirror `JiraSyncQueue`/`JiraSyncWorker`: an
  unbounded `Channel` of jobs, a bounded status map for polling, and a hosted
  service that drains jobs one at a time in their own DI scope and records a
  completion audit event under the enqueuing user's identity.
- **`?background=true`** on `POST /projects/{id}/ado/sync` and
  `POST /integrations/ado/sync` enqueues a job and returns **202 + jobId**; the
  synchronous path stays the **default** (tests and small syncs unchanged).
  Job target is `"all"` (every mapped project) or a single project id.
- **Poll** `GET /integrations/ado/sync/status/{jobId}` → state + counts.
- **Cap raised & configurable.** With the pull off the request path, the low
  anti-504 cap isn't needed: `AzureDevOps:MaxWorkItems` (default **20000**,
  WIQL's own reference ceiling) replaces the hard-coded 4000; detail fetch still
  pages at 200/request.
- **Frontend** `syncAdo`/`adoSyncToast` (`lib/adoSync.ts`) drive the background
  flow from the "Sync now" button, polling to completion and falling back
  gracefully if the server ran synchronously.

## Consequences
- **+** A portfolio-wide ADO pull can't 504; parity with Jira; the connector
  reaches ★★★★★ on the async dimension.
- **+** Reuses a proven pattern; the synchronous path (and its tests) are intact.
- **−** A second near-identical queue/worker rather than one generic pipeline —
  chosen for isolation and to avoid touching the working Jira path; a future
  refactor could unify them behind a connector abstraction.
- **−** Job status is in-memory (per instance), like Jira's — fine for the
  single-node deployment; a multi-instance edge would need shared state.

## Alternatives considered
- **Generalise `JiraSyncQueue` to a connector-agnostic queue now** — more elegant
  but risks regressing the live Jira path for a cosmetic dedupe; deferred.
- **Keep it synchronous, just raise the cap** — doesn't remove the 504 risk on
  the request path; rejected.
