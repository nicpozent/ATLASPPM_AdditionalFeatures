# ADR-0014 — Ops as a distinct work type with project-impact tagging

**Status:** Accepted

## Context
Run-the-business operational work (support, maintenance, monitoring,
infrastructure) is not project delivery, but it competes for the same people —
and that competition is the most common reason delivery slips. It needed a home
that is clearly *not* a project, yet whose load is visible against projects and
against each person's capacity.

## Decision
Add an **Ops** module: `OpsService` (a standing operational area) holding
`OpsItem` work items (type, priority, status, assignee, **allocation %**, and an
optional **impact-project** tag + note).

- **Feeds capacity**: active ops items' allocation rolls up per person into
  Resources' **Ops%** (previously always 0) and the over-allocation check.
- **Impact tag**: an item tagged to a project surfaces on that project's Overview
  as "operational load pulling capacity off delivery", and `GET
  /projects/{id}/ops-impact` totals it.
- **Governed separately**: a dedicated `cap-ops` capability (admin/PMO Full,
  PM/PM-lead/managers Edit, Quality View), reconciled onto existing DBs.

## Consequences
- **+** BAU work is first-class and its drag on delivery is explicit and
  quantified, not invisible.
- **+** Closes the Ops% gap in the capacity model without a bespoke input screen.
- **−** A new top-level section and capability to maintain; mitigated by reusing
  the standard CRUD + RBAC + audit patterns.
- **−** Ops items are dateless today (always "live"); a later change can make ops
  allocation time-phased like ADR-0013 if needed.

## Alternatives considered
- **Model ops as just another project** — blurs delivery vs. run-the-business
  reporting; rejected.
- **A single "impact %" field on projects** — loses the itemised, assignable ops
  backlog and the per-person capacity roll-up; rejected.
