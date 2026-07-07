# ADR-0033 — Browser-based a11y sweep + extracted screen-logic tests

**Status:** Accepted — extends [ADR-0025](./0025-accessibility-baseline.md) / [ADR-0026](./0026-axe-automation-and-mobile-drawer.md).

## Context
ADR-0026 added an axe sweep over the shared primitives in **jsdom**, which can't
evaluate computed styles or colour-contrast and only saw isolated components, not
composed pages. Two ABB-01 gaps remained: a **browser-based full-page** WCAG sweep
and **broader per-screen tests**. Screen logic (labour-cost maths, roadmap year
grouping, Jira-sync toast mapping) was also inline in components, untestable
without rendering.

## Decision
- **Playwright + axe full-page sweep.** A new `e2e/a11y.spec.ts` (Playwright,
  `@axe-core/playwright`) builds the app, serves it with `vite preview` (no
  backend → empty states), and runs axe over key routes (`/`, `/portfolio`,
  `/gantt`, `/roadmap`, `/resources`, `/admin`) in real Chromium. It runs in a
  dedicated CI job (`Accessibility (Playwright + axe)`); locally it reuses a
  pre-installed Chromium when present.
- **Structural gate, contrast reported.** The test **fails on structural
  violations** (roles, names, labels, aria — e.g. it caught unlabelled `<select>`
  filters, now fixed) and **reports colour-contrast without gating**: the design
  tokens (ADR-0003) carry some low-contrast greys, so gating contrast today would
  block the build on pre-existing debt. Contrast findings are logged for a
  dedicated follow-up.
- **Extracted, unit-tested screen logic.** Pure helpers moved to `src/lib/`
  (`labor.ts`, `roadmap.ts`; `jiraSync.ts` already there) with vitest coverage —
  labour hours/cost maths, roadmap `yearOf`/`yearColumns`, and `syncToast`
  outcome mapping. Frontend test count rose from 45 → 59.

## Consequences
- **+** Real-browser structural a11y is now gated in CI; jsdom's blind spots
  (computed DOM, visibility) are covered for the main routes.
- **+** The unlabelled-control class of bug is caught automatically going forward.
- **+** Screen arithmetic/grouping is tested independently of React.
- **−** Colour-contrast is surfaced but not enforced yet — a token-contrast pass
  is the tracked follow-up before flipping the gate on.
- **−** The sweep covers a curated route list, not every screen or interactive
  state (open modals, populated tables); extend `ROUTES` as coverage grows.
- **−** Adds a CI job that installs Chromium (~cacheable) and ~1–2 min wall time.

## Alternatives considered
- **Gate colour-contrast immediately** — would fail on existing token greys and
  block unrelated work; report-first is the pragmatic ramp.
- **Render whole screens in jsdom instead** — still can't do contrast/computed
  styles and needs heavy api/query mocking per screen; a real browser is the
  correct tool for full-page a11y.
- **Keep logic inline** — leaves the maths untested; extraction is cheap and
  durable.
