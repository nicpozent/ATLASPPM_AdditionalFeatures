# ADR-0003 — Inline-styled, token-driven frontend (no CSS framework)

**Status:** Accepted

## Context
The UI must be **pixel-faithful** to an approved single-file HTML prototype that is
100% inline-styled. Fidelity and low divergence risk matter more than styling
ergonomics.

## Decision
Style the React SPA with **inline styles only**, sourced from design tokens in
`theme.ts` (`color.*`, `font.*`, `radius`, `layout`). No Tailwind, CSS modules,
styled-components or global stylesheets. Shared visual primitives live in
`components/ui.tsx`; three fonts only (Space Grotesk / Public Sans / Space Mono).

## Consequences
- **+** Structure/styles lift directly from the prototype → high fidelity, no
  design drift, no CSS build/ordering/specificity issues.
- **+** Tokens centralise the palette; theming stays consistent.
- **−** Verbose components; no `:hover`/media queries in pure inline styles →
  handled with small state hooks (focus rings) and JS; a formal responsive/a11y
  pass is tracked separately.
- **−** No utility-class velocity; acceptable given the fidelity requirement.

## Alternatives considered
- **Tailwind / CSS-in-JS** — faster authoring, but reproducing the prototype
  exactly and avoiding drift favoured verbatim inline styles.
