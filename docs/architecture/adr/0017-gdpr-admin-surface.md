# ADR-0017 — GDPR data-subject actions surfaced in Administration

**Status:** Accepted

## Context
The GDPR endpoints (DSAR export, right-to-erasure, run-retention-now) existed and
were Platform-Admin gated and audited, but had no UI — an admin had to call the
API by hand. Data-subject rights need to be operable by a governance owner, not
just a developer.

## Decision
Add a **Data Privacy** tab to Administration, visible only to Platform Admin,
wiring the existing endpoints: subject picker (`/gdpr/subjects`) → **Export
(DSAR)** (`/gdpr/export`) and confirm-gated **Erase** (`/gdpr/erase`), plus **Run
retention now** (`/admin/retention/run`).

The API stays authoritative: every action remains Platform-Admin gated and
audited server-side; the tab's role check is **cosmetic** (per ADR-0004).

## Consequences
- **+** Data-subject rights are self-service for the governance owner, with an
  audit trail.
- **+** No new backend surface or risk — pure UI over vetted endpoints.
- **−** Exact-match (case-insensitive) subject matching can miss aliases; chosen
  deliberately over fuzzy matching, which risks exposing a *different* person's
  data.

## Alternatives considered
- **Leave it API-only** — safe but unusable by non-developers; rejected.
- **Fuzzy subject search** — convenience at the cost of a possible personal-data
  breach; rejected in favour of exact match.
