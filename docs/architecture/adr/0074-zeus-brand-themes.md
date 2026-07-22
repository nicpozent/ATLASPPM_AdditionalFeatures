# ADR-0074 — Zeus brand themes (selectable, token-mapped)

**Status:** Accepted
**Date:** 2026-07-22
**Relates to:** ADR-0003 (inline-styled, token-driven frontend), ADR-0037 (WCAG AA
contrast tokens + gated colour-contrast), ADR-0056 (per-profile dark mode via CSS
variables)

## Context

The product owner approved a set of three **"Zeus" brand themes** — *Command* (deep
navy), *Daylight* (light) and *Carbon* (near-black) — supplied as a portable
`zeusthemes.css` of CSS custom properties (`--panel`, `--brandA`, `--accent`,
`--ok`, …). A standalone preview rendered real Atlas components in all three; the
next step is to make them **selectable inside the app**.

Atlas is inline-styled with no CSS framework (ADR-0003); every colour is a
`var(--atlas-<key>, <light-hex>)` reference written onto `:root` by
`applyThemeVars()`, keyed by a palette map (ADR-0056). Flipping the palette
re-skins the whole app with no per-component change. Zeus is therefore a natural
extension of the **existing** theming mechanism, not a new one.

## Decision

Add the three Zeus themes as **additional palettes in the same `colorPalettes`
map**, selected through a per-profile theme picker.

- **Palettes.** Each Zeus source palette is translated into the full Atlas token
  key set (`primary`, `surface`, `bg`, `accent`, status, borders, tints, `*Ink`
  text-on-tint pairs, sidebar tokens). Keys Zeus does not define are **derived**
  (tint washes; the `*Ink` readable-on-tint colours; sidebar tokens — the sidebar
  stays dark on the light *Daylight* theme, matching the Atlas layout idiom).
- **Selection.** `ThemeMode` (`light`/`dark`) is generalised to a `ThemeId`
  (`light` | `dark` | `zeus-command` | `zeus-daylight` | `zeus-carbon`). Each id
  maps to a palette and a light/dark `color-scheme`. `ThemeContext` stores the
  chosen id per profile (keyed by the cosmetic role identity, as ADR-0056), and a
  **theme picker** in the top bar replaces the old dark-mode toggle.
- **Default unchanged.** **Atlas Light stays the default** — the axe-gated palette
  (ADR-0037) is untouched, so nothing changes look unless a user opts in. **Atlas
  Dark** remains gated behind `DARK_MODE_ENABLED` (still off); the Zeus themes are
  not gated.
- **Fonts unchanged.** Colours only. Atlas keeps Space Grotesk / Public Sans /
  Space Mono (Space Grotesk display already matches Zeus). Adopting Zeus's IBM Plex
  body/mono is a separate, larger change (bundled font files) and is out of scope.
- **Charts.** `chart.*` stays literal hex — SVG presentation attributes don't
  resolve `var()` (as ADR-0056 notes); the vivid status hues read on every ground.
  Fully themeable charts are a noted follow-up.

## Consequences

**Positive**
- Three brand themes with zero per-screen changes — the token indirection already
  in place carries them.
- **Zeus Daylight is fully WCAG AA and colour-contrast gated** by the browser axe
  sweep (ADR-0037), alongside Atlas Light. Body text, tables, headings, surfaces,
  borders, status inks and sidebar tokens are AA on **all** palettes (the derived
  pairs were tuned with a contrast calculator).
- Reversible and low-risk: default look is unchanged; a profile can switch back to
  Atlas Light at any time.

**Negative / trade-offs**
- `color.primary` is a single token used **both** as the white-text button
  background (on every page) **and** as accent *text* (labels, KPI numbers, tab
  text — 144 call sites). On a light ground one mid-blue satisfies both; on a
  near-black ground it cannot (a blue dark enough for white button text is
  unreadable as text on the dark surface, and vice-versa). So the two **dark** Zeus
  themes (**Command**, **Carbon**) are **not colour-contrast gated yet**: they are
  selectable and structurally a11y-gated, exactly as **Atlas Dark** already is
  (ADR-0056). Only `primary`-coloured accents are low-contrast there; the rest is
  AA. **Follow-up:** split `primary` into a fill token and a text token app-wide
  (which also fixes Atlas Dark's white-on-primary buttons), then contrast-gate all
  five palettes.
- Charts don't yet re-skin per theme (follow-up).
- `design/` (the frozen prototype) does not include a theme picker or these
  palettes — flagged for the design team to regenerate; not hand-edited here.

## Alternatives considered

- **A separate CSS file / `data-theme` on `:root` (as shipped in `zeusthemes.css`).**
  Rejected: Atlas forbids global stylesheets (ADR-0003) and already resolves colours
  through `--atlas-*` tokens; a second variable namespace would fight the existing
  one and bypass the contrast gate.
- **Replace Atlas Light with Zeus.** Rejected: needlessly changes the default look
  and retires the axe-tuned reference palette; offering Zeus alongside is safer.
- **Include the Zeus fonts now.** Deferred: bundling IBM Plex is independent of the
  colour work and adds weight/licensing review; can be a follow-up ADR.

## Verification

`tsc` + production build clean. The browser axe sweep (`e2e/a11y.spec.ts`) runs the
7 routes on **Atlas Light** and a dense route subset on **Zeus Daylight** with the
**full** WCAG 2 A/AA rule set (colour-contrast included) — all pass. **Zeus Command**
and **Zeus Carbon** are swept for the same rule set **minus colour-contrast**
(structural a11y) — all pass. Each palette was screenshotted for visual
confirmation.
