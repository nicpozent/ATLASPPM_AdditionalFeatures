# ADR-0029 — Timelines derive windows from phases, sprints & tasks

**Status:** Accepted

## Context
The program and portfolio timelines only placed an item if it had **explicit
project dates**. In practice most projects are created without a typed start/
target (the window shows "TBD"), so the program timeline rendered "No phases"
for every row and the portfolio timeline showed "Nothing with dates" — even when
the project clearly had a schedule expressed as phases, sprints or dated tasks.
The project timeline likewise promised "sprints appear below" but showed nothing
when a project had no `Sprint` rows (common for board-less Jira mappings, where
sprint names live on the tasks).

## Decision
Derive a schedule from whatever the project actually has:

- **Program timeline.** Each program row now carries the project's window
  (`startMonth`/`endMonth`, from the project dates, else derived from the min/max
  month across its phases, sprints and dated tasks) plus its **sprint bars**. The
  Schedule tab renders a window bar, phase bars and sprint bars per project, so it
  reflects projects + tasks + sprints instead of an empty grid.
- **Portfolio timeline.** An undated project is placed by the month span its
  phases/sprints/tasks cover, so it appears on the roadmap instead of being
  silently dropped.
- **Project timeline.** When a project has no `Sprint` rows, the Schedule
  synthesises sprint bands from the sprint names its **tasks** carry (windowed by
  the tasks' own dates). The empty-state copy is now honest ("No phases or sprints
  scheduled yet — add a phase, or sync sprints from Jira") instead of promising
  sprints that never render.

## Consequences
- **+** Timelines are populated from the data that already exists; no one has to
  double-enter project dates to see a roadmap.
- **+** Sprints show under the project Schedule even for board-less Jira mappings.
- **−** Derived windows are month-granular and only as good as the phase/sprint/
  task dates present; a project with no dated anything still shows "No schedule
  yet" (correctly).
- **−** The program Tasks/Resources/Sprints sub-tabs remain project-scoped (an
  aggregated per-task grid across a whole program would be noise); the Schedule
  tab is the aggregate view.

## Alternatives considered
- **Require explicit project dates** — simplest, but pushes data-entry burden onto
  users and leaves timelines empty by default; rejected.
- **Aggregate every task onto the program grid** — too dense to be readable;
  sprint-level aggregation on the Schedule tab conveys the shape without the noise.
