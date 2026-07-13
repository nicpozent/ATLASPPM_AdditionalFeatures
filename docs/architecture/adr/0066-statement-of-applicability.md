# ADR-0066 — ISO 27001 Statement of Applicability

**Status:** Accepted — product-owner-approved extension (post-prototype). Built in
the existing design language on Project → Security; recorded here and in
CLAUDE.md §2 until `design/` is regenerated.

## Context
The Security, privacy & compliance tab (ADR era of the security module) already
carried a data-classification/privacy profile, a framework-scope toggle set
(incl. ISO 27001), a *control-evidence register* and review gates. But the
register only held the controls someone typed in — there was no view of the
**full** Annex A control set, and no **Statement of Applicability (SoA)**, which
ISO/IEC 27001:2022 clause 6.1.3 d) makes a **mandatory** ISMS record: for *every*
Annex A control, state whether it applies, justify inclusion/exclusion, and give
its implementation status. The evaluation flagged this gap ("SoA adoption +
broader control-coverage automation pending").

## Decision
Add a per-project SoA covering all **93 ISO 27001:2022 Annex A controls** across
the four themes (Organizational 37, People 8, Physical 14, Technological 34).

- **Catalogue is static reference data** (`server/Soa.cs` `Catalogue`) — it is the
  standard, not user data, so it needs no table or seed and can't drift per
  environment. The full set always renders, so **control coverage is complete by
  construction** rather than limited to ad-hoc entries (the "broader coverage" the
  evaluation asked for).
- **Only the decision is persisted** — `SoaEntry(ProjectId, Ref, Applicable,
  Justification, Status, Owner)`, one row per (project, control), unique on
  `(ProjectId, Ref)` (migration `SoaEntries`). An absent row is the baseline:
  *applicable, "Not started"*. Upserts are single-row writes.
- **Endpoints** (`/projects/{id}/soa`, `PUT …/soa/{ref}`): GET merges catalogue +
  decisions, groups by theme and returns a **coverage roll-up** (applicable /
  excluded / reviewed / implemented / % implemented of applicable). PUT validates
  the ref against the catalogue and the status against the allowed set.
- **UI** (`src/screens/project/SoaPanel.tsx`): collapsible theme sections, each
  row an applicability toggle, status select, justification and owner; coverage
  KPIs in the header. Inline-styled with theme tokens, shared UI, no new deps.

## Security & compliance
- **Authorization is server-authoritative (ISO A.5.15).** Reads are open to any
  authenticated caller (parity with the rest of the Security tab); recording a
  decision requires Edit on **`cap-approve`** ("Approve demands & gates") — the
  governance right that already gates controls and review gates. UI `canEdit` is a
  cosmetic affordance only.
- **Accountability / audit (ISO A.8.15; NIST AU-2).** Every decision writes an
  audit event with the actor, control ref, applicability and status, so the SoA's
  change history is traceable — itself an ISMS expectation.
- **Input validation.** Control ref must be in the Annex A catalogue; status must
  be one of the allowed values; both are rejected `400` otherwise.
- **Data minimisation.** The SoA holds only governance metadata (applicability,
  justification, status, owner) — no personal or sensitive data.

## Consequences
- **+** The ISMS's mandatory SoA now exists in-tool with complete Annex A
  coverage, beside the evidence register and review gates it complements.
- **+** Reuses the existing capability, screen, audit and theme — no new
  authorization surface, framework or dependency.
- **−** The catalogue is ISO 27001:2022-specific; other frameworks (SOC 2, NIST
  CSF) would each need their own catalogue if the org wants their SoAs too — a
  clean follow-up (the coverage roll-up and row model generalise).
- **−** Coverage is a *roll-up of stated status*, not automated evidence
  collection; linking a control to concrete system evidence (e.g. "A.8.13 backup"
  → the backup-run record) remains a future enhancement.

## Alternatives considered
- **Keep only the free-form control-evidence register** — rejected: it can't be a
  Statement of Applicability (no guarantee every Annex A control is addressed).
- **Seed the 93 controls as DB reference data** (like the RBAC matrix) — rejected:
  the catalogue is a fixed standard, so a static code array avoids a seed/reconcile
  path and can never be partially populated; only the per-project decision varies
  and is what deserves a row.
- **Org-level single SoA** — deferred: Atlas governs per initiative, and the
  existing Security tab is per-project, so a per-project SoA fits the model and the
  screen; a portfolio roll-up across projects is a later addition.
