# ADR-0079 — Stakeholder relationship intelligence (coverage, strength, next engagement)

**Status:** Proposed — *awaiting product-owner decision (scope + fit)*
**Date:** 2026-07-23
**Relates to:** ADR-0001 (modular monolith), ADR-0004 (RBAC), ADR-0012
(empty-by-default / derive-on-read), ADR-0049 (deterministic risk engine, no LLM
in the decision path), ADR-0025/0037 (a11y), ADR-0074 (theming)

> This is a **scoping/decision record**, not an accepted design. It exists so the
> product owner can **accept, reshape, or reject** the capability before any code
> is written. If accepted, it graduates to *Accepted*, is added to CLAUDE.md §2
> "Approved extensions", and `design/` is flagged for regeneration.

## Context

A feature was proposed: *"Identify meaningful account stakeholders, assess
influence and relationship strength, surface coverage gaps and risks, and
recommend the next engagement."*

**What Atlas has today.** A per-project/programme **stakeholder register** with a
**power/interest (Mendelow) 2×2 matrix** (`StakeholderEntry`: name, role, Power
High/Low, Interest High/Low; `StakeholderMatrixCard`), plus a static
**communication plan** on the project Overview and periodic **Delivery Status**
stakeholder reporting.

**What it does not have.** Relationship *strength* (warmth/owner/last-contact),
**coverage-gap/risk** analysis, **next-engagement** recommendations, or any
**"account"** grouping. Atlas stakeholders are scoped to a *project* or
*programme*, never to an account.

**The fit question.** The request is **account / relationship-management** in
flavour — closer to CRM / customer-success than to Portfolio & Project Management.
Atlas deliberately has no account object. So this is not a defect in Atlas's
intended scope; it is a **new capability in an adjacent domain**. The first
decision is therefore *whether it belongs in Atlas at all* (build) vs *belongs in
the CRM* (integrate/defer).

## Proposed decision (for the PO to confirm)

**Recommended: a bounded, PMO-flavoured extension of the existing stakeholder
register — not a CRM.** Keep it scoped to the entities Atlas already owns
(project / programme; optionally a lightweight *engagement scope* grouping),
reuse the power/interest foundation, and keep every recommendation
**deterministic and rule-based** (no LLM in the decision path, ADR-0049). If the
org actually needs account-centric selling/relationship management, that belongs
in a CRM and Atlas should **integrate** rather than reimplement it.

### Scope if accepted

1. **Richer stakeholder profile.** Extend `StakeholderEntry` (or a new
   `StakeholderProfile`) with: **influence** (reuse Power), **relationship
   strength** (e.g. Champion / Supporter / Neutral / Blocker, or 1–5),
   **sentiment**, **owner** (the Atlas person accountable for the relationship),
   and **last-engaged date**. All manually maintained (empty-by-default, ADR-0012).
2. **Engagement log.** A new `StakeholderEngagement` row (date, channel, owner,
   note, optional outcome) so "last engaged" and cadence are derived, not typed.
3. **Coverage & risk view.** A derive-on-read panel that flags, per scope:
   *unowned* high-power stakeholders, *single-threaded* relationships (one owner /
   one contact), *stale* engagements (no contact in N days), *blockers/detractors*
   among high-power, and low-coverage quadrants of the matrix. These surface as
   stakeholder-coverage **risks** (distinct from RAID delivery risks).
4. **Next-engagement recommendation.** A **deterministic** ranker (owner-less →
   stalest → highest power × weakest relationship first) producing a prioritised
   "who to engage next and why" list. Explainable rule output, not a black box.

### Data / API / UI (sketch, if accepted)
- **Data:** extend `StakeholderEntry` + add `StakeholderEngagement`; per-scope,
  server-authoritative, audited; capability-gated (reuse `cap-approve`/governance,
  or a new `cap-stakeholders`).
- **API:** additive under the existing stakeholder group — coverage roll-up +
  engagement CRUD; roll-ups **derive on read** (ADR-0012), no new hot path.
- **UI:** built in the existing design language/tokens (theming per ADR-0074),
  extending the stakeholder matrix card with a **Coverage/Risks** tab and a
  **Next engagement** list; a11y-gated (ADR-0037). `design/` regen flagged.

## Consequences

**Positive** — turns the static 2×2 into an actionable engagement tool; reuses the
existing register, RBAC, derive-on-read, theming and a11y machinery; recommendations
stay explainable and auditable.

**Negative / risks** — **scope creep toward CRM** is the main danger (accounts,
pipelines, contacts belong elsewhere — hold the line at project/programme scope);
relationship/sentiment data is **people data** with GDPR implications (may fall
under the personnel-data processing gate, ADR-0063 — needs a DPIA check); manual
upkeep means the coverage view is only as good as the data entered.

## Alternatives considered

- **Do nothing** — the power/interest matrix stays as-is. Cheapest; leaves the
  ask unmet.
- **Integrate with a CRM** (read stakeholders/engagements from an external CRM and
  render coverage/risk in Atlas). Best if the org already runs a CRM — avoids
  reimplementing relationship management. Larger integration surface.
- **Full account-relationship module in Atlas** (accounts, contacts, pipelines).
  Rejected as a first step: it re-scopes Atlas from PPM into CRM.

## Open questions for the product owner

1. **Fit:** does this belong in Atlas (PPM) or in the CRM? Build vs integrate?
2. **Scope object:** project/programme only, or a new account/engagement grouping?
3. **Data sensitivity:** is relationship/sentiment data in scope for the
   personnel-data / DPIA gate (ADR-0063)?
4. **Recommendation transparency:** confirm deterministic-rules-only (no LLM),
   per ADR-0049.
5. **Ownership:** who maintains the register + engagement log (PM? PMO? account
   owner?), and which capability gates edits?
