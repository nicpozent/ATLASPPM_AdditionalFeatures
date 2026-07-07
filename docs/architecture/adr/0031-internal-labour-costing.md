# ADR-0031 — Internal-labour costing (PM/PO lines + rate card)

**Status:** Accepted — extends the cost taxonomy (Costs) and Financials.

## Context
Financials tracked internal-labour cost for Dev, Architecture and Infra, but not
for **Project Management** or **Product Ownership**, and there was no way to turn
an *effort estimate* (days/months/hours) into a labour cost — teams did that in a
spreadsheet. Two gaps: (1) missing PM/PO cost lines editable by the people who own
that budget (PMO / PM Lead), and (2) no blended rate card to drive a calculator.

## Decision
- **PM & PO cost lines.** The standard cost taxonomy gains `laborPM`
  ("Internal labor · PM") and `laborPO` ("Internal labor · PO"), owned by
  `pmlead` (PMO/Admin edit all lines). They're system lines on every project/
  program/product, in `actual` and `forecast`.
- **Self-healing seeding.** `Costs.EnsureAsync` now backfills any *missing*
  system template line on read (keyed by line key), so owners created before
  PM/PO existed gain them automatically without disturbing existing amounts or
  custom lines — no data migration needed.
- **Rate card.** A new `/labor-rates` endpoint stores average blended cost/hour by
  **discipline** (Dev, Infra) × **seniority** (Junior, Semi-Senior, Senior,
  Specialist, Expert) in the Settings store (`rate.<discipline>.<level>`).
  `GET` is open (read); `PUT` is restricted to PMO / PM Lead / Admin.
- **Cost calculator.** My Team renders the rate card plus a calculator: pick a
  discipline + seniority and enter months/days/hours; it computes
  `hours × rate` using 1 month = 21 working days, 1 day = 8 h.

## Consequences
- **+** PM/PO labour is now first-class in Financials, editable by the right role.
- **+** A single source of truth for internal rates, reused by the calculator (and
  available to future auto-costing of task-estimate hours).
- **−** Rates are a flat blended card (no per-person or time-varying rates); a
  historical rate table could come later if finance needs it.
- **−** Calculator assumptions (21 d/month, 8 h/day) are fixed constants, not
  configurable per region/contract yet.

## Alternatives considered
- **Store rates in a dedicated table** — cleaner typing, but the Settings
  key/value store already exists and rates are a small, flat set; a table would be
  over-engineering for now.
- **Per-person cost rates** — most accurate, but needs sensitive salary data and a
  bigger data model; the blended card matches how the PMO estimates today.
