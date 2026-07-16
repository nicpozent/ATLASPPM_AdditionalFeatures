# ADR-0071 — Period-windowed resource utilisation + date-range filter

**Status:** Accepted

## Context

The Resources *By-person* view showed a **single-day snapshot** (default today).
The day/week/month/quarter/half/year toggle only relabelled the header —
`GET /resources` took no period, and the client never even sent one — so the
utilisation numbers never changed with the selected period. Managers also had no
way to see utilisation over an arbitrary date range.

The underlying allocation engine (ADR-0020) is already correctly time-phased
per-day: `ProjectPlannedFor` / `TaskLoadFor` / `CombineProjectLoad` compute a
person's project load "as of a day", honouring per-assignment and per-task date
windows, and taking the higher of planned-% vs task-estimate load per project.
Manual project allocations and Jira-derived task load both feed it. The single
missing piece was aggregation over a window.

## Decision

`GET /resources` gains optional `from`/`to`. When a window is supplied the roster
is the **average of each person's per-working-day Ops/Project/Product load across
the window** (weekends excluded; if the window is all-weekend the days are counted
so a single Sat/Sun query still returns a value); with no window it stays the
single-day snapshot (default today, or `?asOf=`), preserving every existing
caller.

To guarantee the windowed roster, the single-day roster and the Excel export
never drift, the allocation engine was refactored to expose **shared in-memory
helpers** (`ProjectPlannedFor`, `TaskLoadFor`, `CombineProjectLoad`) that all
three call; `RosterWindowAsync` loads the sources once and iterates the window's
working days in memory (capped at 800 days, mirroring the report guard).

Client: the period toggle maps to a concrete calendar window (`periodWindow`),
and a **date-to-date filter** overrides it for an arbitrary range; the allocation
Excel export follows the selected window.

## Consequences

- **+** The period toggle and the date filter now actually change the numbers,
  computed by the same authoritative engine as the snapshot and the export.
- **+** No schema change; the windowing is pure aggregation over existing data.
- **+** Both manual allocations and Jira task load feed the window, unchanged.
- **−** A long day-granularity window iterates many days in memory; bounded by the
  800-day cap and the working-day set, matching the allocation-report behaviour.
- **−** Averaging over a window can mask a short over-allocation spike within it;
  this matches the Excel export's per-bucket average and is the intended reading
  of "utilisation over the period".

## Alternatives considered

- **Peak (max) over the window instead of average** — rejected for the default
  view: it diverges from the Excel export's per-bucket average and would read
  inconsistently against the shared engine; the average is the natural
  "utilisation over the period".
- **Sample a single representative day** — rejected: cheap but wrong for windows
  where allocations start/stop partway through.
- **A separate windowed query path duplicating the per-day maths** — rejected:
  the whole point of the engine is one source of truth; the in-memory helpers keep
  snapshot, window and export on identical logic.
