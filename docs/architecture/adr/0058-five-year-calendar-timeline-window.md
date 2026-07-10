# ADR-0058 — Calendar timeline window (up to 5 years), absolute-month model

**Status:** Accepted — extends the derived-window timelines of
[ADR-0029](./0029-timeline-derived-windows.md).

## Context
The project/programme/portfolio Gantt laid items out on a **single-year, 12-month**
grid indexed by month-of-year (0–11). Multi-year work couldn't be seen end-to-end,
and a bar spanning a year boundary had no correct position. Users needed to look up
to five years ahead by calendar date.

## Decision
Model timeline positions as **absolute months** (`year*12 + monthIndex`) and render
against a **user-selected calendar window**:

- A `Win { start, span }` context (`WinCtx`) carries the visible range; span is
  capped at `MAX_SPAN = 60` (5 years).
- From/To `<input type="month">` pickers plus **1y / 2y / 3y / 5y / This-year**
  presets set the window; the default is the current calendar year (identical to
  the old 12-month behaviour).
- Geometry helpers (`barAbs`, `segPct`, `centerPct`, `gridBg`) place/clip bars and
  markers within the window; anything fully outside is hidden, anything crossing an
  edge is clipped. Items with real ISO dates are placed by them; a bare
  month-of-year (manual phases, derived sprints) is anchored to a base year supplied
  by its context (its project's start year).

Frontend-only; no API or schema change.

## Consequences
- **+** Multi-year portfolios render correctly across year boundaries; the horizon
  is selectable up to 5 years.
- **+** Default view is unchanged (current year), so nothing regresses for existing
  single-year use.
- **+** One shared geometry model for every timeline (project/programme/portfolio/
  task), so window behaviour is consistent.
- **−** A very wide window compresses month cells; the month header thins labels to
  years past ~18 months to stay legible.

## Alternatives considered
- **Keep month-of-year, add a year selector** — rejected: can't represent a bar
  that spans two years, and cross-year layout stays wrong.
- **Continuous pixel-per-day scale** — rejected: heavier and unnecessary; month
  granularity matches how phases/sprints/roll-ups are already modelled.
