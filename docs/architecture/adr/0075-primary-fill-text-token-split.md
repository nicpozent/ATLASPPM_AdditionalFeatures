# ADR-0075 — Split `primary` into fill + text tokens; contrast-gate all themes

**Status:** Accepted
**Date:** 2026-07-22
**Relates to:** ADR-0037 (WCAG AA contrast tokens + gated colour-contrast),
ADR-0056 (per-profile dark mode), ADR-0074 (Zeus brand themes)

## Context

ADR-0074 shipped the three Zeus brand themes but could only colour-contrast-gate
the light ones (Atlas Light, Zeus Daylight). The two **dark** themes (Command,
Carbon) were selectable but structurally-gated only, because a single `color.primary`
token was doing two incompatible jobs:

- **A white-text button/badge background** (used on every page — the Export button,
  primary CTAs, active segmented controls, avatars). White text on it must meet AA,
  so it has to be a reasonably **dark** blue.
- **A foreground accent** — text, KPI numbers, tab labels, icons, borders, meter
  fills, indicator dots (144 `color:` uses). As text on a near-black surface it must
  be a **light** blue.

On a light ground one mid-blue satisfies both. On a near-black ground it cannot: dark
enough for white-on-fill is unreadable as text, and vice-versa. Atlas Dark (ADR-0056)
had quietly accepted the broken side (a light `primary`, so its white-on-primary
buttons fail); it ships disabled and was never gated, so nobody hit it.

## Decision

Split the brand colour into **two tokens**:

- **`primary`** — the **foreground/accent** (text, icons, borders, meters, dots).
  Tuned to read as text on each theme's surfaces (light-on-dark in the dark themes).
- **`primaryFill`** — the **background for white-content** buttons/badges/avatars.
  Dark enough for white text ≥ AA in every theme.

They are set **equal** in the light palettes (Atlas Light `#0F6CBD`, Zeus Daylight
`#0e6ab0`), so the default look is byte-for-byte unchanged. They diverge only in the
dark themes:

| theme | `primary` (accent text) | `primaryFill` (white-text bg) |
|-------|-------------------------|-------------------------------|
| Zeus Command | `#6fa8ef` | `#2c6fce` |
| Zeus Carbon  | `#6fb0f5` | `#2f6fd0` |
| Atlas Dark   | `#4C9DE0` | `#2c6fce` |

Call sites were repointed by role: **white-content backgrounds** (`background`/`bg`/
`tint` carrying `#fff` text) → `primaryFill`; **everything else** (all foreground text,
icons, borders, and decorative fills like unread dots, progress meters and timeline
markers) stays `primary`. The ~113 `color:` foreground sites were left untouched — the
lighter `primary` simply makes them readable on the dark grounds.

The axe sweep (`e2e/a11y.spec.ts`) now colour-contrast-gates **all three Zeus themes**,
promoting Command and Carbon from structural-only. This supersedes the ADR-0074
follow-up note.

## Consequences

**Positive**
- All three Zeus themes are fully WCAG AA and CI-gated for colour-contrast.
- The fix also repairs **Atlas Dark's** white-on-primary buttons (should it be
  re-enabled).
- Default look unchanged: `primary === primaryFill` on every light palette.

**Negative / trade-offs**
- One more brand token to keep in sync when defining a palette.
- New white-content buttons must use `primaryFill`, not `primary`, for their
  background — documented in `theme.ts`. Missing it is caught by the gate on the swept
  routes.
- Charts still don't re-skin per theme (unchanged from ADR-0074; SVG presentation
  attributes don't resolve `var()`).

## Alternatives considered

- **Leave the dark themes structurally-gated (ADR-0074 status quo).** Rejected: the
  product owner asked for all three fully AA.
- **Split the 144 foreground `color:` sites instead** (add `primaryText`, keep
  `primary` as the fill). Rejected: more call sites, higher churn, and every future
  brand-coloured label would need the non-default token; splitting the ~30 fill sites
  is smaller and the default (foreground) token keeps the intuitive name.

## Verification

`tsc` + build clean; 124 unit tests pass. The browser axe sweep runs the 7 routes on
Atlas Light and a dense subset on **each** Zeus theme with the **full** WCAG 2 A/AA
rule set (colour-contrast included) — all pass. Each palette re-screenshotted.
