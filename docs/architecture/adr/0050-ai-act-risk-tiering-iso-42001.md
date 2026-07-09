# ADR-0050 — EU AI Act risk-tiering & ISO 42001 AI management

**Status:** Accepted — the schema follow-up promised by [ADR-0049](./0049-compliance-coverage-and-zero-trust.md)
(compliance coverage). Extends the deterministic risk engine (ABB-10) with
AI-specific governance.

## Context
ADR-0049 added ISO 42001 and NIST to the control catalogue and a generic coverage
rule, but AI governance was still shallow: the EU AI Act was a single boolean
`AiAct` flag with one advisory rule, and there was no way to record a system's
**risk tier** or its Art. 14 / Art. 50 measures — the fields the Act's obligations
actually key off. The AI Act is in force and Birgma is an EU entity, so this is
the highest-value compliance gap.

## Decision
Add first-class AI-Act classification to the per-project `SecurityProfile`
(one migration, `AiActClassification`):

- `AiRiskTier` — `""` (unclassified) | `minimal` | `limited` | `high` | `prohibited`
- `AiAnnexIii` — Annex III high-risk use case (implies the high tier)
- `AiHumanOversight` — Art. 14 human oversight in place
- `AiTransparency` — Art. 50/13 users informed they interact with AI
- `AiSystemName` — the AI system/model in scope (a light ISO 42001 AIMS inventory)

The deterministic risk engine (`Risks.cs`) derives obligations from the tier — no
LLM, reproducible:

| Tier | Findings |
|------|----------|
| `prohibited` | **High** — Art. 5 prohibited practice |
| `high` / Annex III | **High** if no human oversight (Art. 14); **Medium** if no ISO 42001 control Implemented (Art. 9 risk mgmt + Art. 10 data governance) |
| `limited` | **Low** if no transparency measure (Art. 50) |
| in scope but unclassified | **Medium** — classify it (Art. 6) |

The Security tab gains an **AI system classification** card (shown when AI is in
scope) with the tier selector, system name, and the oversight/transparency/Annex-III
toggles, plus a per-tier obligation headline.

## Consequences
- **+** EU AI Act obligations are tracked and deterministically scored per project;
  ISO 42001 AIMS has a concrete home (system name + oversight + controls).
- **+** Reuses the existing profile/PATCH/audit machinery and the risk report —
  the new findings render with the framework tints from ADR-0049.
- **+** One additive migration (five nullable-with-default columns); safe on
  existing rows (default: unclassified, no oversight recorded).
- **−** Classification is self-declared by the governance owner (as with the other
  compliance flags); the engine scores what's declared, it doesn't infer the tier.
- **−** A full AIMS (model cards, dataset lineage, post-market monitoring) is still
  future work; this covers classification + core obligations.

## Alternatives considered
- **A separate `AiSystem` inventory table** — richer, but heavier for the current
  need; profile fields cover per-project classification with no new aggregate.
  Revisit if multiple AI systems per project must be tracked independently.
- **Leave it as the single `AiAct` flag** — fails to capture the tier the Act's
  obligations depend on; rejected.
