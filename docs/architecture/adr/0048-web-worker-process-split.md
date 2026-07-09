# ADR-0048 — Web / worker process split (role-selectable container)

**Status:** Accepted — refines the runtime topology (ABB-06 Async, ABB-12 Delivery)
established by [ADR-0001](./0001-modular-monolith-minimal-api.md) (modular monolith) and the
background-sync ADRs [0007](./0007-in-process-background-workers.md) / [0030](./0030-background-jira-sync.md) / [0039](./0039-ado-background-sync.md).

## Context
The API process hosted both the request-serving endpoints **and** every
background service in-process: the timer-driven recurring jobs (scheduled Jira
sync, daily retention, periodic capacity alerts) and the on-demand sync queues.
A portfolio-wide scheduled sync or retention pass therefore competes with user
requests for CPU and threads on the same process — the resource-contention risk
called out when weighing whether Atlas should run in more containers.

We deliberately **did not** break the monolith into microservices: the hot
endpoints derive numbers on read by joining across domains in a single process /
transaction, so splitting domains into services would add network hops,
distributed consistency and operational burden with no benefit at this scale.
The one justified split is **request-serving vs. recurring background work**.

## Decision
Introduce a process **role** selected by `Atlas:Role` (env `Atlas__Role`):

- **`all`** *(default)* — one process runs everything, exactly as before. Single
  `docker compose up` and every existing test/deployment is unchanged.
- **`web`** — serves the API (and the **on-demand** sync consumers, whose queue
  is in-process, so they must live with the endpoints that enqueue into them);
  owns database migrations + reference-data seed.
- **`worker`** — runs only the **timer-driven** recurring services
  (`JiraSyncService`, `RetentionHostedService`, `CapacityAlertService`); maps no
  API surface, only the `/health` + `/readyz` probes for orchestrators.

`docker-compose.yml` now ships `api` (role=web) + a `worker` service (role=worker)
built from the same image, sharing one environment anchor. The worker
`depends_on` the api so the schema exists before its first tick.

## Consequences
- **+** A heavy scheduled sync / retention / capacity scan runs in its own
  container and can't starve user requests; worker and web scale, restart and get
  resource limits independently.
- **+** Zero behaviour change by default (`all`); no new infrastructure, no
  database migration, no queue rewrite — the in-memory queues are untouched, so
  their unit tests and the synchronous sync path are unaffected.
- **+** Same image for both roles → one build, one artifact to promote.
- **−** The **on-demand** sync consumers (`JiraSyncWorker`/`AdoSyncWorker`) still
  run in the web role: their handoff is an in-process `Channel`, so they can't
  move to another container without a **durable queue**. That is the deferred
  follow-up (a DB-backed job/status table so enqueue-in-web / consume-in-worker
  works across processes, replacing the in-memory `Channel` + status dictionary
  that the UI polls). Until then, on-demand syncs are bounded/user-paced and
  return 202 immediately, so co-locating them is acceptable.
- **−** Only the web/all role runs migrations, so a pure worker deployment
  requires the web (or a migration job) to initialise the schema first.

## Alternatives considered
- **Microservices per domain** — rejected: cross-domain read roll-ups become
  distributed joins; consistency + ops cost with no scale justification.
- **Split the on-demand queues now too** — needs the durable-queue migration and
  a queue-semantics rewrite (higher risk); staged as the follow-up above.
- **A separate worker entrypoint/project** — more build/deploy surface than a
  single image that branches on one env var; rejected for the role switch.
