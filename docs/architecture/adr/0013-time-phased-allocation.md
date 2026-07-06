# ADR-0013 — Time-phased resource allocation

**Status:** Accepted

## Context
Early allocation was a single flat percentage per person per project, summed
over a person's lifetime. That can't answer the questions delivery managers
actually ask: *is this person free in August?*, *who can I staff for this
quarter?*, *what does the extra effort cost when the project runs long?* It also
had no way to enter effort in hours, only a bare %.

## Decision
Model each assignment as a **time-phased segment**. `TeamAssignmentMember` carries
a base segment (`Alloc` % / `AllocHours`, `StartDate`, `EndDate`) plus an optional
**extension** segment (`ExtAlloc`/`ExtHours`/`ExtStartDate`/`ExtEndDate`) for extra
capacity when work runs long — kept separate so the original plan stays intact.

- **Capacity basis** (`AllocMath`): **40 h/week = 100%**; `% = hours ÷ 40`. Weeks
  per month ≈ 4.33 (52/12) drive person-day effort maths.
- **Utilisation is a function of the day**: a segment counts only when live on the
  reference date (`ActiveOn`; empty bounds = open, so pre-dates rows are
  unchanged). `GET /resources?asOf=` and the availability finder both read this.
- People can be assigned **individually** (an "Individuals" bucket, `SubTeamId 0`),
  not only via sub-teams.

## Consequences
- **+** Real capacity planning: per-date over-allocation, availability by
  date/window, and period effort exports all fall out of one model.
- **+** Enter effort as % *or* hours; backward compatible (dateless = always live).
- **−** Read-time computation iterates segments (and, for exports, weekdays);
  bounded by dataset size and the derive-on-read stance of ADR-0012.
- **−** "Extension as a second segment" is a pragmatic two-segment model, not
  unlimited history; a full segment table can supersede this if needed.

## Alternatives considered
- **Flat lifetime %** — simple but can't express *when*; rejected.
- **Unlimited allocation-segment child table** — most general, but a larger
  refactor of the member-list editing UI; deferred until two segments prove
  insufficient.
- **Store utilisation** — drift risk; rejected per ADR-0012 (derive on read).
