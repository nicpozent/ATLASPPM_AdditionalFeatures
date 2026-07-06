# ADR-0019 — Strategic roadmap: dual lane + timeline model

**Status:** Accepted

## Context
Atlas planned delivery at the project/program level (Gantt, PI planning) but had
no place for *strategic* planning above them — the portfolio-level "what are we
doing now, next and later, and why". Two idioms dominate roadmap tools: the
**Now / Next / Later** horizon board (commitment-light, good for stakeholders)
and the **time-based timeline** (date-anchored, good for sequencing). Teams want
both without maintaining two data sets.

## Decision
Model one `RoadmapItem` that carries **both** a horizon lane and optional
start/end dates, so the same initiative renders on either view.

- `RoadmapItem`: `Lane` (Now|Next|Later), `Status`, `Theme` (swimlane), owner,
  optional `StartDate`/`EndDate`, and prioritisation signals `Confidence` (0–100),
  `Effort` (1–5), `Value` (1–5). Business key `RM-n`.
- Children: `RoadmapMilestone` (title/date/done, cascade-deleted), `RoadmapLink`
  (to okr|project|program|product|release, validated against live entities and
  label-snapshotted), and `RoadmapDependency` (a directed edge between two items;
  the DTO exposes both `dependsOn` and the reverse `blocks`).
- The board view drives lane changes (incl. drag-and-drop → `PATCH lane`); the
  timeline places **dated** items in theme swimlanes over a month grid and lists
  undated ones with a prompt. Undated items still live fully on the board.
- Edits gated on a dedicated capability **`cap-roadmap`** (Platform Admin + PMO
  full, PM/PM-lead edit); reading is open with a `canEdit` flag, matching the
  Ops module (ADR-0014). Milestones/links/deps are **replaced wholesale** on
  save (the item is edited as one form), not per-child CRUD.

## Consequences
- **+** One record, two faithful views; no divergence between the horizon board
  and the dated timeline. Links tie strategy to the delivery portfolio.
- **+** Confidence/effort/value make the board prioritisation-aware without a
  separate scoring model.
- **−** Wholesale child replacement is simple but rewrites milestone/link rows on
  every save (fine at roadmap volumes; not a high-write path).
- **−** Dependency edges are between roadmap items only (not to projects); cross-
  object dependency lives in the Gantt/PI modules by design.

## Alternatives considered
- **Two separate entities** (a Kanban board + a timeline) — guarantees drift and
  double entry; rejected.
- **Reuse PI objectives / Gantt** — those are increment- and project-scoped and
  date-mandatory; the roadmap needs portfolio scope and optional dates. Rejected.
- **Per-child CRUD endpoints** for milestones/links/deps — more surface for a
  form that's always edited as a whole; deferred behind wholesale replace.
