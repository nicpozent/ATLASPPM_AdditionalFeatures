# ADR-0037 — WCAG AA contrast tokens + gated colour-contrast

**Status:** Accepted — closes the ABB-01 follow-up left open by
[ADR-0033](./0033-browser-a11y-sweep-and-logic-tests.md) (browser axe sweep with
colour-contrast reported-but-not-gated).

## Context
The Playwright + axe sweep (ADR-0033) gated structural WCAG rules but only
**reported** colour-contrast, because several design greys — lifted verbatim from
the prototype — failed WCAG AA (4.5:1) as body text: `faint #7B849A`,
`faint2 #8A92A6`, `faint3 #9AA2B4` (~2.8–3.6:1 on white), the hardcoded control
grey `#6A7488` on light chip/segment backgrounds (~3.8:1), and the sidebar group
label `sidebarLabel #5C6589` on the navy sidebar (~3.1:1). One dashboard emphasis
number used `danger #D13438` as text (4.35:1, just under).

The prototype fidelity rule ("do not invent colours") and accessibility
collide here; accessibility wins for **text** contrast, which is a legal/UX
requirement. The brand hues (primary, status fills, chart palette) are unchanged.

## Decision
- **Darken the muted text greys to the darkest values that stay visually close
  while passing AA on white *and* on the light surfaces they sit on
  (`#F1F3F8` / `#EEF1F6` / `#E4E8F1`):** `faint #7B849A→#5B657B`,
  `faint2 #8A92A6→#616A81`, `faint3 #9AA2B4→#636C83`, and the hardcoded control
  grey `#6A7488→#565F73` (24 call-sites).
- **Lighten `sidebarLabel #5C6589→#7C86AC`** — it only ever sits on the navy
  sidebar / login hero (`#11163A`), where a *lighter* grey is what raises
  contrast (now ≥4.5:1); verified it isn't used on any light surface.
- **Use `dangerInk #A1282B`** (not `danger`) for the dashboard "N projects need
  attention" emphasis text.
- **Flip the gate:** `e2e/a11y.spec.ts` now asserts **zero** WCAG 2 A/AA
  violations including `color-contrast` (previously contrast was logged only).

## Consequences
- **+** Every swept route (`/`, `/portfolio`, `/gantt`, `/roadmap`, `/resources`,
  `/admin`) is WCAG 2 AA clean in a real browser, and regressions now fail CI.
- **+** Muted text is more legible; the change is a small darkening, not a
  redesign — layout, brand and chart colours are untouched.
- **−** A deliberate, documented deviation from pixel-verbatim prototype greys
  for **text** tokens (the prototype's airy greys are decorative-contrast only).
- **−** The gate covers the six representative routes, not every screen/state;
  extend `ROUTES` as new high-traffic views land.

## Alternatives considered
- **Keep contrast reported-not-gated** — leaves a real accessibility gap and lets
  regressions slip in; rejected (the whole point of this pass).
- **Per-element overrides instead of token changes** — 24+ scattered call-sites;
  fixing the tokens is one change with consistent results.
- **Enlarge text to hit the 3:1 large-text threshold** — would break prototype
  layout fidelity far more than a few-shade darker grey.
