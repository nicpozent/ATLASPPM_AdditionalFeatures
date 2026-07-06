# ADR-0015 — Server-side colour-graded Excel exports (ClosedXML)

**Status:** Accepted

## Context
Managers asked for Excel exports with colour (a resource-allocation histogram
by day/week/month/quarter/half/year, and the skills matrix). Colours mean cell
fills — which the free SheetJS build doesn't do — and the export should reuse
the numbers the app already computes, not re-derive them in the browser.

## Decision
Generate `.xlsx` **on the backend with ClosedXML**, streamed through the existing
authenticated download path (`apiDownload`, same as artifacts/DSAR).

- `GET /resources/allocation-report.xlsx?from=&to=&period=` — per-person heat grid
  of **average % utilisation** per bucket (green→amber→red, >100% red), with the
  underlying **person-days in the cell comment**. Effort from the ADR-0013
  time-phased allocations, weekdays only; span capped to bound columns.
- `GET /skills/export.xlsx` — the skills matrix as a blue proficiency ramp.

## Consequences
- **+** True cell colouring, frozen headers, comments — first-class Excel.
- **+** No frontend bundle growth; one source of truth for the maths (backend).
- **+** Reuses the proven auth'd file-download flow.
- **−** A managed dependency (ClosedXML) and CPU/memory to build workbooks in
  process; acceptable for on-demand, bounded exports.

## Alternatives considered
- **Client-side ExcelJS** — ships a large lib to every user and re-implements the
  allocation maths in TS; rejected.
- **CSV** — no colour, no comments, poor for a histogram; rejected.
