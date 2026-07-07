# ADR-0026 — Automated a11y sweep + mobile navigation drawer

**Status:** Accepted — extends [ADR-0025](./0025-accessibility-baseline.md)

## Context
ADR-0025 baked an accessibility floor into the shared primitives and covered it
with component tests, but left two follow-ups open: (1) there was **no automated
WCAG rule engine** in CI — contrast/label/role regressions could only be caught by
eye, and (2) the small-screen story was a **padding tweak**, not a real layout —
the fixed sidebar rail ate most of a phone's width.

## Decision
**Automated axe sweep.** Add `vitest-axe` (dev-only, wraps `axe-core`) and register
its `toHaveNoViolations` matcher globally in the test setup. `a11y.test.tsx` runs
axe over the shared primitives (Button, labelled form controls, Card + empty state,
Modal dialog). Because these components compose every screen, a violation here would
propagate app-wide, so the primitives are the highest-leverage place to gate. The
suite runs in the existing `npm test` CI step — no new job. (Note: jsdom has no
canvas, so axe's colour-contrast rule is a no-op in CI; structural rules — roles,
names, labels, `aria-*` — are fully enforced. Contrast stays token-governed per
ADR-0003.)

**Mobile navigation drawer.** Below a 900px breakpoint the shell swaps the static
sidebar rail for an **off-canvas drawer**: a hamburger button (rendered only in
narrow mode) in the topbar opens it; it slides in over a dimming backdrop, is a
labelled `role="dialog"` with `aria-modal`, closes on Escape / backdrop click /
navigation, and locks background scroll while open. The effective-open state is
gated on `narrow` so leaving narrow mode can't strand an open panel, and the
route-change reset happens during render (React's "adjust state on prop change"),
not in an effect.

## Consequences
- **+** Structural a11y regressions now fail CI automatically, not just review.
- **+** The app is usable one-handed on a phone; the nav no longer steals width.
- **−** Colour-contrast still isn't machine-verified (jsdom/canvas limitation); a
  full browser-based axe run (Playwright) would close that, deferred.
- **−** The drawer isn't a full focus-trap like `Modal` (it closes on Escape and
  restores context via navigation); acceptable for a nav surface, revisit if it
  grows interactive controls.

## Alternatives considered
- **Playwright + axe in a headed browser** — would verify contrast too, but adds a
  browser to CI and a second test runner; the primitive-level jsdom sweep catches
  the common regressions at a fraction of the cost. Revisit for full-page audits.
- **Keep the padding-only responsive approach** — rejected; it never reclaimed the
  rail's width, which is the actual phone pain point.
