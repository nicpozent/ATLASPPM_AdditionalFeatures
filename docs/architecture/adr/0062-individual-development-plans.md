# ADR-0062 — Individual development plans (manager-scoped, development-framed)

**Status:** Accepted — extends the manager surface on *My Team* (Team SWOT,
[ADR-0016] skills matrix) with a per-person note.

## Context
Managers asked for a per-person qualitative note alongside the team-level SWOT
and the skills matrix. A raw **individual SWOT** was considered and rejected:
"weaknesses/threats" recorded against a named person is subjective personnel
data that reads as adversarial, invites grievance, and normally lives in an HRIS
(Workday/SuccessFactors) — not a PPM tool. But a lightweight, development-focused
note that a manager keeps for the people they manage is genuinely useful and
low-friction, provided it is handled as sensitive personal data.

## Decision
Add **individual development plans** with a deliberately development-focused
shape — **Strengths · Growth areas · Goals** (no weaknesses/threats) — on the
*My Team* member cards.

- **Scope = authorization.** A manager can read/write a plan only for people in a
  team within their roll-up (`Teams.MembersInScopeAsync`); Platform Admin all.
  Out-of-scope person → `403`, missing person → `400`.
- **Manager-visible only.** Plans are **never** exposed to the individual or to
  peers. The UI states this ("Visible to managers only — not shown to the team
  member"). There is no self-service read path.
- **Audited.** Every write records *who edited whose plan* (not the content) in
  the audit log.
- **Migration-free storage.** Persisted as JSON in the `Setting` store, keyed by
  display name (`devplan.{person}`, consistent with the skills matrix), and
  **redacted from the broadly-readable `GET /settings`** (confidential-prefix
  rule, ADR-0060/§2) — so it is only ever read back through the scoped
  `GET /devplans` endpoint. Text fields are length-capped.

## Consequences
- **+** Managers get a private development record next to skills/SWOT, in the
  existing UI, with no new screen and no migration.
- **+** Tight blast radius: scoped read/write, redacted from the settings dump,
  audited, and never shown to the subject.
- **−/GDPR.** This is personal data. Lawful basis, purpose limitation, retention,
  and **subject-access** still apply — a person may request what a manager wrote.
  For Birgma/Biltema (Nordic), works-council / co-determination consultation is
  advisable before switching this on in production. Treat as an org policy gate,
  not just a feature flag.
- **−** Display-name keying can collide/rename like the skills matrix; a stable
  key (Entra `Uid`) is a later refinement once the member DTO carries it.
- **−** Not integrated with an HRIS; if the org standardises on one, this should
  link out rather than duplicate.

## Alternatives considered
- **Individual SWOT** — rejected: adversarial framing for a person; higher HR/
  legal sensitivity for no added value over strengths/growth/goals.
- **Store in HRIS only / link out** — cleaner system-of-record, but heavier and
  not available now; revisit if an HRIS integration lands.
- **A first-class `DevelopmentPlan` entity + table** — preferable long-term
  (typed, per-row, FK to the person), but needs an EF migration; the `Setting`-
  JSON interim ships without one and is easy to promote later.
