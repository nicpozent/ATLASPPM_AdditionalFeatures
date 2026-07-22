# ADR-0077 — Per-theme brand typography (IBM Plex on the Atlas brand themes)

**Status:** Accepted
**Date:** 2026-07-22
**Relates to / amends:** ADR-0074 (Atlas brand themes — "colours only, fonts
unchanged"), ADR-0003 (inline-styled, token-driven frontend), ADR-0056 (theming
via CSS variables)

## Context

ADR-0074 shipped the three Atlas brand themes as a **colours-only** change and
explicitly left fonts unchanged (Space Grotesk / Public Sans / Space Mono). The
brand themes originated from a preview whose typography paired Space Grotesk
(display) with **IBM Plex Sans** (body) and **IBM Plex Mono** (labels). The
product owner has now asked to bring that typography in.

Atlas Light must stay pixel-faithful to the prototype (CLAUDE.md §2), which uses
Public Sans / Space Mono — so the fonts cannot change globally.

## Decision

Make body/mono fonts **theme-aware**, through the same CSS-variable mechanism as
colours and chart hues:

- `font.body` / `font.mono` become `var(--atlas-font-body|mono, <light-stack>)`
  references; `applyThemeVars` writes `--atlas-font-body|mono` for the active theme.
- **Atlas Light & Atlas Dark keep** Public Sans / Space Mono (prototype-faithful).
- **Atlas Command / Daylight / Carbon use** IBM Plex Sans / IBM Plex Mono.
- `font.head` (display) stays **Space Grotesk** on every theme.
- The fonts are loaded the same way the app already loads its type — added to the
  Google Fonts `<link>` in `index.html` (IBM Plex Sans + IBM Plex Mono).

This **amends** ADR-0074's "colours only / fonts unchanged" note for the brand
themes; Atlas Light's typography is unchanged.

## Consequences

**Positive**
- The brand themes match their intended typographic identity; Atlas Light stays
  prototype-faithful.
- Reuses the `--atlas-*` var mechanism — `font.*` is applied via the `style` prop
  everywhere (364 sites), where `var()` resolves, so no per-component change.

**Negative / trade-offs**
- Two more webfont families on the Google Fonts request (slightly larger font
  payload; only fetched because they're in the CSS `<link>`). If the on-prem
  deployment has no egress to Google Fonts, self-hosting the families (or the
  embedded-@font-face approach) would be a follow-up — this matches the app's
  existing CDN-font strategy, so it's no worse than today.
- A brand-theme first paint may show the Public Sans fallback for a frame before
  the IBM Plex face loads (`display=swap`).

## Alternatives considered

- **Swap fonts globally to IBM Plex.** Rejected: breaks Atlas Light's prototype
  fidelity (CLAUDE.md §2) and ADR-0003's "match the prototype exactly".
- **Self-host / embed the fonts now.** Deferred: the app already loads fonts from
  the Google Fonts CDN; matching that keeps the change minimal. Self-hosting is a
  separate hardening step that would apply to all four families, not just IBM Plex.

## Verification

`tsc` + build clean; axe sweep 16/16 (fonts don't affect contrast). Confirmed
`:root` carries `--atlas-font-body: 'IBM Plex Sans', …` under Atlas Command and
`'Public Sans', …` under Atlas Light.
