# ADR-0007 — In-process background workers (hosted services)

**Status:** Accepted

## Context
Some work must run off the request path and on a schedule: periodic Jira sync and
data-retention/anonymisation. We want this without standing up separate scheduler
infrastructure at the current scale.

## Decision
Implement recurring work as **`IHostedService` background workers** inside the API
process (`JiraSyncService`, `RetentionHostedService`), each using a `PeriodicTimer`
and opening its own DI scope per pass. Intervals and enable flags are configurable
(`Jira:SyncMinutes`, `Jira:ScheduledSync`, `Retention:Enabled`). Each pass is
best-effort and idempotent; one item's failure is logged and does not abort the pass.

## Consequences
- **+** No extra infrastructure; deploys as part of the API.
- **+** Idempotent + best-effort ⇒ safe to run repeatedly.
- **−** Runs in every API replica → with >1 replica the same pass can run
  concurrently (duplicate work). Acceptable because syncs are idempotent (upsert);
  if replicas grow, add a leader-election/lock or move to an external scheduler.
- **−** Long passes share the process; kept bounded and off the hot path.

## Alternatives considered
- **External scheduler / queue (Hangfire, cron, cloud scheduler)** — more robust
  for scale-out, but unnecessary overhead now. Clean migration path retained.
