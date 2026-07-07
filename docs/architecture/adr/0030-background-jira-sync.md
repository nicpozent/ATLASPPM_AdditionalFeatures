# ADR-0030 — Background Jira sync (no 504 on large pulls)

**Status:** Accepted — extends [ADR-0006](./0006-jira-pull-only-board-optional.md) / [ADR-0021](./0021-jira-delta-and-per-entity-sync.md)

## Context
A manual Jira sync ran **synchronously inside the request**: the endpoint pulled
every issue and only then responded. For a large project (or a portfolio-wide
"Sync now") the pull could exceed the edge/gateway timeout, so the browser saw an
**API 504** even though the sync itself was proceeding. Delta sync helps, but a
full re-sync of a big project still blows past the ~60s proxy limit.

## Decision
Manual syncs can run **in the background**:

- A singleton **`JiraSyncQueue`** (an unbounded `Channel` + a small in-memory
  status map, capped at 200 recent jobs) and a **`JiraSyncWorker`** hosted service
  that drains it one job at a time, each in its own DI scope.
- The four manual-sync endpoints (`/integrations/jira/sync`, `/projects/{id}`,
  `/programs/{id}`, `/products/{id}` `…/jira/sync`) accept **`?background=true`**:
  they enqueue a job under the caller's identity and return **202** with a
  `jobId`. Without the flag they behave exactly as before (synchronous) — so the
  existing tests and any script that wants the counts inline are unaffected.
- **`GET /integrations/jira/sync/status/{jobId}`** returns the job's live state
  (`queued`/`running`/`done`/`failed`) and roll-up counts.
- The worker writes the same kind of completion **audit event** as the
  synchronous path, attributed to the enqueuing user.
- The frontend (`src/lib/jiraSync.ts`, used by `JiraSyncButton`, the Integrations
  "Sync now", and the Project sync) always calls with `background=true` and polls
  status to completion (~90s ceiling), toasting the result — so the request that
  returns to the browser is instant and can't 504.

## Consequences
- **+** Large syncs no longer 504; the UI shows progress via polling and the
  work continues server-side even if the user navigates away.
- **+** Reuses the existing per-project sync logic (`SyncProjectsCoreAsync`) for
  both paths; the scheduled `JiraSyncService` is unchanged.
- **−** Job status is in-memory (not persisted) — a process restart loses
  in-flight job status (the audit log still records completion). Acceptable:
  jobs are short-lived progress, not records.
- **−** One worker drains jobs serially; a burst of syncs queues rather than
  running concurrently (intentional — avoids hammering Jira's rate limits).

## Alternatives considered
- **Raise the gateway timeout** — brittle and unbounded; a big enough project
  would still time out. Rejected.
- **Persist jobs in the DB** — durable status across restarts, but heavier than
  warranted for ephemeral sync progress; the audit log already captures the
  durable outcome. Revisit if job history becomes a requirement.
