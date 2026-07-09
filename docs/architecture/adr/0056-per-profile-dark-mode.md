# ADR-0056 — Per-profile dark mode via CSS variables

**Status:** Accepted — extends the design-token system (`src/theme.ts`, ADR-0003)
without introducing a CSS framework or global stylesheet (CLAUDE.md §3).

## Context
The app is styled entirely with inline styles that read hex values from the
`color.*` tokens in `theme.ts`, imported statically by ~67 files. A dark mode
therefore can't be a static import swap. Two forces constrain the approach:

1. **No global stylesheet / CSS framework** is allowed (CLAUDE.md §3), and a
   67-file refactor to thread a palette through React context would be invasive
   and error-prone.
2. The preference must be **per profile** (per the cosmetic header identity) and
   **persist per profile selection** — switching persona restores that persona's
   light/dark choice.

## Decision
Drive the palette through **CSS custom properties** and persist the choice per
profile:

- Each `color.*` token is now a `var(--atlas-<key>, <light-hex>)` reference (the
  light hex — the value the a11y contrast gate was tuned against, ADR-0037 —
  stays embedded as the fallback). Because every screen applies colours through
  the React `style` prop (element.style → CSSOM, where `var()` resolves), the
  whole app re-skins with **no per-component change**.
- `applyThemeVars(mode)` writes the active palette's variables onto
  `document.documentElement` and sets `color-scheme` + `data-theme`. A
  `ThemeProvider` (inside `RoleProvider`) calls it on mount and whenever the
  selected profile's mode changes.
- The mode is stored in `localStorage` keyed by role (`atlas.theme.<role>`), so
  each identity keeps its own choice. A sun/moon toggle sits in the top bar next
  to the role switcher.
- **SVG exception:** `var()` does **not** substitute in SVG *presentation
  attributes* (`fill=`, `stroke=`, `stopColor=`). The handful of chart/icon
  elements that set colours that way now apply them via the `style` prop instead
  (where var() resolves), and the sparkline gradient id — previously derived from
  a hex — is sanitised so a `var(--…)` token can't produce an invalid id.
  `chart.*` stays literal hex (its vivid status hues read on either background),
  so charts need no palette variables.

## Consequences
- **+** Full dark theme with a one-line palette flip; no framework, no global
  stylesheet, no 67-file churn. The light palette (and its gated contrast) is
  byte-for-byte unchanged.
- **+** Per-profile persistence falls out of keying on the existing role
  identity; no backend, no schema.
- **+** Exports (PPTX/HTML in `Reports.tsx`) already use literal hex, so
  documents are unaffected by the theme.
- **−** Dark palette contrast isn't gated by the CI axe sweep (it runs light);
  the dark values were chosen for ≥ AA on the dark surfaces by construction. A
  dark-mode axe pass can be added if the sweep is parameterised.
- **−** One conflated token (`navy`, used as both heading text and a dark
  background) had its ~3 background usages repointed to `sidebarBg` so `navy`
  could flip to a light text colour cleanly.

## Alternatives considered
- **ThemeContext palette threaded through props/context** — rejected: touches all
  67 consumers; large diff and regression surface for no gain over CSS variables.
- **A global `[data-theme]` stylesheet** — rejected: violates the inline-styles /
  no-global-CSS rule; CSS variables achieve the same with only `:root` mutated.
- **Per-user (not per-profile) preference** — the header identities are cosmetic;
  keying per identity matches how the rest of the UI treats them and satisfies
  the "persist per profile" requirement.
