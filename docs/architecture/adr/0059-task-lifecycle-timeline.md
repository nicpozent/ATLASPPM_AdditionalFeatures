# ADR-0059 — Task lifecycle timeline + Jira changelog-derived timestamps

**Status:** Accepted — extends the Jira full-field import
([ADR-0018](./0018-jira-full-field-import.md)) and the calendar window
([ADR-0058](./0058-five-year-calendar-timeline-window.md)).

## Context
The Timeline → Tasks view drew a **duration Gantt bar** (start → target) per issue.
Jira work-items rarely carry a planned start+end span, so every bar stretched
edge-to-edge and the only signal left was the status word — with 1,000+ issues it
read as a wall of identical bars. A work-item is better shown along its **life**
(created → in-progress → closed) than as a fabricated duration.

## Decision
Render each task as a **lifecycle**, and capture the timestamps that requires.

**Frontend** (`Gantt.tsx`, `TaskTimeline`/`TaskLifeRow`): per task, a faint **age
track** (origin→end), a status-coloured **active segment** (work-start→end), and
**created / started / resolved markers**.
- *To Do* → age track only (visibly aging in the backlog, no active segment).
- *In Progress / Blocked* → active segment runs to the **NOW** line.
- *Done* → active segment ends at the resolved date.
- Sort (created / status / longest-running) + status filter; the row list is
  **virtualized** (windowed render) so large backlogs stay smooth. Fully respects
  the calendar window (ADR-0058).

**Backend**: two new `ProjectTask` columns (migration `TaskLifecycleTimestamps`),
surfaced on `ProjectTaskDto`:
- `ResolvedAt` — from Jira `resolutiondate` (already fetched), falling back to
  last-updated for a Done issue with no resolution date.
- `StartedAt` — derived from the **earliest status transition** in the issue
  changelog. `expand=changelog` was added to the issue/JQL fetch helpers;
  `StartedAtFromChangelog` scans histories for the first `status`-field change.
  Workflow-agnostic (no dependency on status names/categories) and **best-effort**:
  a missing/unreadable changelog just leaves it empty (bar omits the ◆ marker).

## Consequences
- **+** The view communicates real progress and aging instead of noise; scales to
  thousands of rows via virtualization.
- **+** `StartedAt`/`ResolvedAt` reuse the existing idempotent sync; no new calls
  beyond the changelog expand on the issue search already being made.
- **−** `expand=changelog` increases sync payload; mitigated by delta sync and the
  existing page caps. Existing rows populate on the **next** sync (older data shows
  created→now until then).
- **−** "Started" is the first status move, a proxy for work-start; full
  cycle-time/lead-time analytics from the complete transition history is a
  candidate (CR-INT-7), not this ADR.

## Alternatives considered
- **Keep the duration bar** — rejected: it's the reported problem.
- **Aging scatter / cumulative-flow instead of bars** — viable and considered;
  the lifecycle bar was chosen as the closest faithful improvement to the existing
  Gantt idiom. The others remain open as complementary views.
- **Status-category mapping for "started"** — rejected as fragile across custom
  workflows; first-transition is robust and needs no status catalogue.
