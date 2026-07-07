# ADR-0025 — Accessibility baseline in shared primitives

**Status:** Accepted

## Context
The UI is 100% inline-styled (ADR-0003), so there's no global stylesheet to hold
`:focus-visible` rings, `prefers-reduced-motion`, etc. Accessibility has to live
in the **shared primitives** (`components/ui.tsx`) so every screen inherits it,
rather than being retrofitted per screen.

## Decision
Bake keyboard/screen-reader behaviour into the shared components and cover it
with component tests:

- **Focus indicators.** `Input`/`Textarea`/`Select` already ring on focus via a
  state-tracked `useFocusRing` (inline styles can't express `:focus`). `Button`
  now uses the same ring so keyboard users can see it.
- **Dialogs.** `Modal` traps focus, moves focus in on open and restores it on
  close, closes on Escape, locks body scroll, and exposes `role="dialog"` +
  `aria-modal` + a label (existing; kept and tested).
- **Menus.** `RowMenu` trigger carries `aria-haspopup`/`aria-expanded`; the popover
  is `role="menu"` with `role="menuitem"` children, closes on Escape and returns
  focus to its trigger; menu items show a focus background (not just hover).
- **Responsive.** The shell tightens content padding on small screens via a
  `matchMedia` hook; wide content (tables, boards, timelines) scrolls inside its
  own `overflow-x` container.
- **Tests.** `ui.test.tsx` covers Button click/disabled/focus-ring, Input change,
  Modal label/Escape/scroll-lock, and RowMenu open/action/close + Escape.

## Consequences
- **+** A consistent a11y floor every screen inherits for free; regressions are
  caught by component tests.
- **−** Not a full WCAG 2.1 AA audit: colour-contrast is by-token (not
  automatically verified), and there's no automated axe sweep in CI yet.
- **−** A true mobile experience still wants a collapsible sidebar drawer; the
  padding tweak is an interim, not a full small-screen layout.

## Alternatives considered
- **A global CSS reset / utility layer for focus** — contradicts ADR-0003
  (inline-only, no framework); rejected.
- **Per-screen a11y fixes** — wouldn't compose or stay consistent; centralising in
  the primitives is the leverage point.

## Follow-ups (tracked, not done here)
- Automated axe/contrast checks in CI.
- Collapsible sidebar drawer for phone widths.
- Broader interaction-test coverage across screens.
