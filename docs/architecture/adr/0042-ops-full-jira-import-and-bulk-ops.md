# ADR-0042 — Ops: full-fidelity Jira import (epics + rich fields), work-item-status filter, bulk delete

**Status:** Accepted — extends [ADR-0034](./0034-ops-jira-sync-and-task-links.md)
(Ops Jira sync) and [ADR-0014](./0014-ops-work-type.md) (Ops work type), and mirrors
the project-task importer (ADR-0018 full-field + attachments).

## Context
Importing a Jira project into an Ops service pulled only a thin slice —
summary, type, priority, status, assignee — and **skipped epics entirely**. A
project import, by contrast, carries the full field set (description, people,
labels, components, versions, resolution, time tracking, story points, epic /
parent links) plus each issue's comment thread and attachments. Ops imports
were "loose tasks", not the faithful mirror a project import is.

Two board-usability gaps compounded this: the Ops status filter filtered by the
**service lifecycle** (Active / Paused / Retired) rather than by **work-item
status** (the Jira statuses people actually triage by), and items could only be
deleted one at a time.

## Decision
- **Full-fidelity import.** `Jira.PullOpsItemsAsync` now mirrors
  `SyncProjectAsync`: it requests the full field set and maps
  description, issue type, reporter, exact status name, resolution, labels,
  components, fix versions, parent key, epic key/name, story points, original
  estimate, logged time, due date, created/updated timestamps and a deep link
  onto new columns on `OpsItem`. Each issue's **comments and attachments** are
  pulled into new `OpsItemComment` / `OpsItemAttachment` tables (bytes in the DB,
  idempotent by Jira id — a re-import tops up new ones without duplicating),
  exactly as tasks do.
- **Epics come in as items.** Epic-type issues are no longer skipped; they import
  as `OpsItem` rows tagged `Type = "Epic"`, and child items carry `EpicKey` /
  `EpicName` (and `ParentKey`) so the relationship is visible on the board and in
  the item detail — a single-board model, not a separate epic surface.
- **Lazy detail endpoint.** The board response stays lean (rich scalar fields +
  comment/attachment **counts** as badges); `GET /ops/items/{id}` returns the full
  `OpsItemDetailDto` (item + comment thread + attachment metadata) when an item is
  opened, and `GET /ops/item-attachments/{attId}` streams a file.
- **Filter by work-item status.** The board's status dropdown now filters items by
  their Jira-derived status (Open / In progress / Blocked / Done); a service shows
  when it matches the category filter and has a matching item.
- **Bulk delete.** `POST /ops/items/bulk-delete` removes many items in one gated
  call; the board offers multi-select checkboxes and a selection action bar.

## Consequences
- **+** An Ops import is now as complete as a project import — nothing about a
  Jira issue is lost, and epics and their children are represented.
- **+** Triage matches how people think (by work status), and clearing out synced
  noise is a one-gesture operation.
- **+** Counts-on-board / detail-on-open keeps the board payload small despite the
  richer model.
- **−** `OpsItem` grew wide (mirrors `ProjectTask`); acceptable for parity, and the
  new columns default empty so the migration is safe on populated tables.
- **−** Attachment bytes live in the DB (consistent with tasks/artifacts); large
  Ops spaces inherit the same size-cap config (`Jira:MaxAttachmentBytes`).

## Alternatives considered
- **A separate epic board/entity for Ops** — heavier and off-pattern; tagging
  epics as items with a parent link reuses the existing board and matches how the
  data is triaged operationally.
- **Embed full comments/attachments in the board response** — simpler client, but
  bloats the list payload for every service; the counts-plus-detail split is the
  same trade-off the task board already makes.
