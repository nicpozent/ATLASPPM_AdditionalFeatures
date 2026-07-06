# ADR-0018 — Jira full-field, comment & attachment import

**Status:** Accepted (extends ADR-0006)

## Context
The pull-only Jira sync (ADR-0006) imported a thin subset — summary, status
category, assignee, priority, due date, points. Teams wanted the *whole* issue in
Atlas: description, people, labels/components/versions, resolution, time,
timestamps, plus comments and attached files.

## Decision
Widen the sync to the full issue record and mirror comments + files, keeping the
one-way, idempotent contract of ADR-0006.

- `ProjectTask` gains description (Jira ADF flattened to plain text), issue type,
  reporter, exact status name, resolution, labels/components/fixVersions, parent
  & epic keys, logged time, created/updated, and a deep link.
- **Comments** upsert by Jira comment id; **attachments** download over the
  authenticated client (size-capped, best-effort) and store bytes in the DB
  (`TaskAttachment`, same bytea pattern as artifacts). Re-sync tops up new
  files/comments without duplicating; locally-created rows are never touched.
- Config: `Jira:ImportComments` / `ImportAttachments` / `MaxAttachmentBytes`.

## Consequences
- **+** Atlas holds the full delivery record; a read-only "Jira details" panel
  surfaces it. Idempotent re-sync is preserved.
- **−** Attachments live in Postgres (bytea) — simple and transactional, but grows
  the DB; the size cap and opt-out bound it. An object store can supersede this
  if volumes demand.
- **−** More Jira API surface + per-attachment downloads lengthen a sync; best-
  effort per item keeps one bad file from failing the run.

## Alternatives considered
- **Keep the thin subset** — insufficient for teams living in Atlas; rejected.
- **Store attachments in object storage/filesystem** — better at scale, but adds
  infra and breaks the single-transaction model; deferred behind the bytea +
  cap approach.
