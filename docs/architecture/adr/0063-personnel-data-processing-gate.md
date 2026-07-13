# ADR-0063 — Personnel-data processing gate + Sweden compliance posture

**Status:** Accepted — governs the personnel-assessment features
([ADR-0062](./0062-individual-development-plans.md) development plans, Team SWOT)
and extends the compliance coverage work
([ADR-0049](./0049-compliance-coverage-and-zero-trust.md)).

## Context
Team SWOT and individual development plans process **sensitive employee personal
data**. In Sweden that pulls in obligations beyond baseline GDPR — notably a
**DPIA (GDPR Art. 35)** and **MBL §11 co-determination negotiation** with unions
*before* such a system goes live, plus transparency, retention reconciliation
with the Accounting Act, and processor/transfer diligence. Shipping the features
"on by default" would risk processing personal data before those gates are met.
(Full map: `docs/compliance-sweden.md`.)

## Decision
Add a single **compliance gate** that keeps the personnel-assessment features
**off until an organisation explicitly approves data processing**.

- A `Setting` flag, `personnel.assessmentsEnabled`, **defaults to off**.
- **Server-enforced** (`Teams.PersonnelEnabledAsync`): while off, the SWOT and
  development-plan write endpoints return **403**, and the read endpoints return
  `enabled:false` with **no data** — so nothing is served or stored regardless of
  the client.
- **UI**: the *My Team* SWOT panels and per-member development-plan affordances
  are hidden while off. A Platform Admin flips the flag in **Integrations &
  Settings → Governance**, where the copy names the prerequisites (DPIA + MBL §11).
- The flag is a normal operator toggle (not a secret), so it round-trips through
  `GET/PATCH /settings` like the other governance toggles.

The gate is the **technical enforcement point** for the compliance to-dos in
`docs/compliance-sweden.md`; the go/no-go is an org-policy decision, not a code
change.

## Consequences
- **+** Personal-data processing cannot happen until a deliberate, admin-level
  opt-in — a clean control to point auditors/works-council at.
- **+** Enforced at the API, not just the UI, so it holds regardless of client.
- **+** Reuses the existing settings machinery; no migration.
- **−** The features ship **disabled** — after this lands, SWOT/dev-plans are
  invisible until an admin enables the flag (intended, but a visible behaviour
  change; documented in the PR and here).
- **−** A single global flag (not per-team/per-region). Finer-grained gating is a
  later refinement if a market needs staged rollout.

## Alternatives considered
- **Ship on by default** — rejected: risks processing personal data before the
  DPIA/MBL gates, in a jurisdiction where that ordering matters.
- **Build-time feature flag / config value** — rejected: not runtime-toggleable
  by an admin, and not visible/auditable in-product.
- **Separate flags per feature** — deferred; one personnel-data gate is simpler
  and matches how the sign-off (DPIA/MBL) is granted (for the capability as a
  whole), with per-feature/region splits as a future refinement.
