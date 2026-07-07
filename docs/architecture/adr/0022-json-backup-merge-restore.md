# ADR-0022 — JSON backup is a logical export; restore is a merge

**Status:** Accepted

## Context
Atlas's in-app "Back up all now" produces a downloadable **JSON snapshot** of the
live portfolio data. Users asked what it actually captures and how to restore.
The authoritative recovery path for a relational app is a PostgreSQL dump /
point-in-time restore — but an in-app restore of the logical export is useful for
rolling back edits to the core portfolio objects.

## Decision
Treat the JSON snapshot as a **logical export**, and make its restore a
**merge (upsert by id), never a destructive replace**.

- `POST /backups/restore` parses an uploaded snapshot and, for the **string-keyed
  top-level entities** (projects, programs, products, releases, objectives) and
  **settings**, upserts by id: existing rows are updated from the snapshot,
  missing rows are re-created. It **never deletes** anything.
- Implemented with EF `CurrentValues.SetValues` on a found-or-new tracked entity,
  which copies **scalar properties only** — navigation collections are ignored,
  so no child rows are double-inserted.
- **Out of scope for the JSON restore:** identity-keyed child rows (tasks, epics,
  RAID, cost lines, comments…), attachments (bytea), and RBAC role/permission
  rows. These are captured in the snapshot for portability but restored via a
  **database dump/PITR** — the honest authoritative path. The snapshot download is
  labelled a logical export, and the Backups screen + Help say so.
- Gated on **Backups & restore (Full)** (Platform Admin) and confirm-gated in the
  UI (the confirm text states it's a merge and that child rows/attachments aren't
  covered). Every restore is audited.

## Consequences
- **+** A safe, one-click way to roll back edits to the core portfolio objects and
  settings, with no risk of data loss (merge-only).
- **+** No EF cascade/duplicate-insert hazards (scalar-only copy).
- **−** Not a full recovery: child/identity rows and files need the DB dump. This
  is documented rather than papered over with a fragile deep restore.
- **−** A merge can't remove rows created after the snapshot (by design); a true
  rollback uses the database backup.

## Alternatives considered
- **Destructive full replace** (wipe + insert from JSON) — truer to "restore" but
  dangerous, and brittle across identity ids and attachments; rejected in favour
  of merge + pg_dump for full recovery.
- **No in-app restore** (export only) — simplest, but users wanted to re-apply a
  snapshot; the merge is a safe middle ground.
