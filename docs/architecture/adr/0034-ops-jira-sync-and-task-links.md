# ADR-0034 — Ops: Jira board/space sync + linked project tasks

**Status:** Accepted — extends [ADR-0014](./0014-ops-work-type.md) (Ops work type) and the Jira connector (ADR-0006/0018/0021).

## Context
Ops services could hold **manual work items** and could be **created once** from a
Jira project (import target `ops`). Two gaps: the import target wasn't offered in
the Integrations Discovery UI, a mapped service couldn't be **re-synced** as Jira
moved on, and a service had no way to reference the **real delivery tasks** that
feed it — only hand-entered items.

## Decision
- **Ops as a Discovery import target.** The Integrations "Import" modal now offers
  *"A new Ops service"* alongside project/program targets (backend already
  supported `target=ops`).
- **Per-service re-sync.** `POST /ops/services/{id}/jira/sync` re-pulls the mapped
  Jira project's issues into the service's items, idempotent by Jira key (shared
  `Jira.PullOpsItemsAsync`, extracted from the importer). A **"Sync from Jira"**
  button appears on each Jira-mapped service (background sync, per ADR-0030).
- **Linked project tasks.** A new `OpsTaskLink` (ServiceId ↔ ProjectTask.Id) lets a
  service reference existing Atlas project tasks for traceability. They render as
  read-only rows under the service alongside manual items; **allocation stays with
  the task's own project** (no double-counting into Ops). Endpoints:
  `POST /ops/services/{id}/tasks`, `DELETE /ops/services/{id}/tasks/{taskId}`; the
  board returns `linkedTasks` per service.

## Consequences
- **+** A run-the-business service can be fed by a Jira space (synced items) **and**
  linked to the delivery tasks that drive it — the "Both" model.
- **+** Reuses the existing import/sync plumbing; no new allocation semantics.
- **−** Board-vs-space: the pull is by Jira **project key** (a space); a specific
  agile board isn't scoped separately — sufficient for Ops, revisit if needed.
- **−** Linked tasks are informational; they don't add Ops allocation (deliberate,
  to avoid double-counting the task's project allocation).

## Alternatives considered
- **Re-attribute linked-task allocation to Ops** — would double-count the task's
  project load; rejected in favour of traceability-only links.
- **Only Jira-sync, no task links** (or vice-versa) — the user wanted both feeding
  paths; supporting both is the flexible choice.
