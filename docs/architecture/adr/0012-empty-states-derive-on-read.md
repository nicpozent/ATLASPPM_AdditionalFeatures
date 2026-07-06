# ADR-0012 — Empty-by-default data with derive-on-read roll-ups

**Status:** Accepted

## Context
Atlas must reflect *real* portfolio data, never fabricated demo content, and its
many roll-ups (portfolio health, OKR progress, epic completion, capacity
utilisation, ROI, assignee flags) must stay consistent with their sources.

## Decision
**Empty is the correct default**: with no data the UI shows tasteful empty states
inside the real layout, not seed rows. A demo portfolio loads **only** when
`Seed:Enabled=true` (non-prod). Derived/aggregate values are **computed at read
time** from normalised sources rather than stored, so they cannot drift.

## Consequences
- **+** No fabricated data; what you see is real. No stale denormalised roll-ups.
- **+** Sources stay normalised and single-owner; roll-ups are always current.
- **+** Onboarding a fresh tenant is honest (blank until wired to API/Jira/Entra).
- **−** Read-time computation costs CPU on each request; bounded by dataset size,
  small projections, and client-side query caching. If a roll-up becomes hot and
  large, introduce a cached/materialised view behind the same read API.
- **−** First-run screens look empty; mitigated by clear empty-state guidance and
  the Help centre.

## Alternatives considered
- **Stored/denormalised roll-ups** — faster reads, but drift risk and write-time
  complexity; rejected until a measured hotspot justifies caching.
- **Seed data by default** — rejected: fabricated numbers mislead.
