# ADR-0020 — Task estimate hours count toward allocation

**Status:** Accepted (extends ADR-0013)

## Context
Allocation (ADR-0013) was driven only by *planned* signals — explicit team-
assignment %/hours, product allocations, and Ops item %. A person could be
buried in assigned task work yet show near-zero utilisation because no one had
recorded a planned %. Teams asked that **task estimates count as real capacity
consumption** on Resources and in a project's capacity panel.

## Decision
Derive a **bottom-up task load** from each open, assigned task's estimate hours
and combine it with the planned figure per project.

- **Scope:** project tasks (`ProjectTask` has assignee + estimate hours + dates).
  Programs/releases inherit via their linked projects; products use explicit
  `ProductAllocation` (product tasks carry no estimate/assignee); Ops items
  already carry an explicit %.
- **Hours → %:** an open task's estimate is smoothed over its active window and
  converted to a weekly rate via `AllocMath` (40h/wk = 100%). Window = the task's
  own start/target if set, else the project window, else a rolling 4-week
  horizon. Only tasks *live* on the reference day count (time-phased like ADR-0013).
- **Combine rule (the key decision):** per (person, project),
  `load = max(planned %, task %)`, then summed across projects. The planned
  figure is a **floor** and heavy task load can raise it, but the two **never
  double-count** (a planned 50% that already covers the work isn't inflated by
  the tasks that make it up). Rejected alternatives: *sum* (double-counts, blows
  past 100% fast) and *task-replaces-planned* (loses the PM's intent).
- **One engine:** `AllocationEngine.ProjectLoadByPersonAsync` is the single
  source of the project number, reused by the Resources roster **and** a
  project's capacity panel so they can't drift. Task-only assignees now surface
  on both (a person with estimated tasks is working on the project even without
  a formal assignment).
- **Assignee options:** `GET /projects/{id}/assignee-options` returns the
  project's people first (role + team/sub-team/individual) then the onboarded
  roster, so the task-assignee dropdown is always populated.

## Consequences
- **+** Utilisation reflects real committed work, not just planned %. Over-
  allocation surfaces from the bottom up.
- **+** Resources and capacity share one code path (no divergence).
- **−** The hours→% smoothing is an estimate; undated tasks lean on the project
  window or a 4-week default, so the number is directional, not payroll-exact.
- **−** Unparseable project end dates (display-formatted `Due`) fall back to the
  default horizon rather than a precise spread.

## Alternatives considered
- **Sum planned + task** — simplest, but systematically over-counts. Rejected.
- **Only count dated tasks** — precise but under-counts the large body of
  undated backlog work. Rejected in favour of the windowed fallback.
