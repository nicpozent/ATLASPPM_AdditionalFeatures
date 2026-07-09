# ADR-0055 — Need-to-know internal-labour rate card

**Status:** Accepted — refines the internal-labour costing of
[ADR-0031](./0031-internal-labour-costing.md) and reuses the per-project cost-line
owner model in `Costs.cs`.

## Context
The internal-labour rate card (My Team → blended €/hour by discipline and
seniority) originally exposed two disciplines (Dev, Infra) to every viewer, with
editing limited to PMO / PM Lead / Admin. Internal cost rates are commercially
sensitive: a discipline's blended rate should only be seen by the manager who
owns that discipline (and senior leadership), not by every persona that can open
My Team. The card was also missing the **Architect**, **PM** and **PO**
disciplines that already exist as per-project cost lines in `Costs.cs`.

## Decision
Make each discipline's rate **need-to-know** — both **visible and editable** only
by the UI identities that own it, mirroring the cost-line owners in `Costs.cs`,
plus CTO/CIO who see every rate:

| Discipline | May view **and** edit |
|-----------|------------------------|
| Dev       | Global Engineering Manager, Developers Manager, CTO, CIO |
| Infra     | Infrastructure Manager, Global Service Manager, CTO, CIO |
| Architect | Chief Architect, CTO, CIO |
| PM        | PMO, PM Lead, CTO, CIO |
| PO        | PMO, PM Lead, CTO, CIO |

- The API (`/labor-rates`) resolves the caller's effective UI role and returns
  **only the disciplines that role may see** — the wire response never carries a
  rate the caller isn't entitled to. `canEdit` is true whenever the caller owns
  at least one discipline (seeing ⇒ editing), and `PUT` silently ignores any rate
  key for a discipline the caller doesn't own.
- A persona that owns no discipline (e.g. a plain PM, Team Member, Stakeholder)
  gets an empty list and a "rates are restricted" state in the card.
- The header personas are cosmetic (CLAUDE.md §7), so this is not a security
  boundary — but the server-side filtering **is** authoritative for what leaves
  the API, so the client cannot render a hidden rate by tampering with the view.

## Consequences
- **+** Commercially sensitive rates follow least-privilege; each manager sees
  only their own discipline, leadership (CTO/CIO) sees all.
- **+** Architect / PM / PO rates are now first-class in the card, consistent with
  the project cost lines.
- **+** No schema change — rates stay in the Settings store under
  `rate.<discipline>.<level>`; new disciplines are just new keys.
- **−** With auth on, the fine-grained (9-persona) distinction isn't one of the 6
  canonical backend roles, so true enforcement still rests on the resolved UI
  role; acceptable because the rate card is an internal management view, not a
  hard authorization surface, and no rate the caller can't see is ever sent.

## Alternatives considered
- **Client-side hide only** — rejected: the rates would still be on the wire and
  visible in dev tools; filtering server-side is strictly better.
- **Admin-sees-all override** — rejected per the product owner's explicit lists;
  administration of rates is by the owning managers + CTO/CIO, not the platform
  admin.
