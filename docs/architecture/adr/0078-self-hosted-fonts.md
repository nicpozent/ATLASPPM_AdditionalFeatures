# ADR-0078 — Self-hosted fonts (no external font CDN)

**Status:** Accepted
**Date:** 2026-07-22
**Relates to:** ADR-0054 (on-prem single-node Docker), ADR-0003 (inline-styled,
token-driven frontend), ADR-0074/0077 (themes + per-theme typography)

## Context

The app loaded all its webfonts from the Google Fonts CDN via a `<link
rel="stylesheet">` in `index.html` (Space Grotesk, Public Sans, Space Mono, and —
after ADR-0077 — IBM Plex Sans/Mono). The on-prem deployment target (ADR-0054) has
**no outbound internet egress**, so those requests fail and every family falls back
to a system font — the app renders in the wrong typography.

## Decision

**Bundle the fonts and serve them same-origin.** No external font CDN.

- The latin + latin-ext subsets (Nordic/European glyph coverage) of every used
  family/weight are committed as `.woff2` under `src/fonts/`, with a generated
  `src/fonts/fonts.css` of `@font-face` rules referencing them by relative path.
- `fonts.css` is imported once in `main.tsx`; Vite bundles it, fingerprints the
  `.woff2` into `/assets/`, and nginx serves them same-origin. The Google Fonts
  `<link>` and its `preconnect`s are removed from `index.html`.
- Variable families (Space Grotesk, Public Sans, IBM Plex Sans) ship as one file
  per subset with each weight's `@font-face` mapping onto it; static families
  (Space Mono, IBM Plex Mono) ship one file per weight. After de-duplication:
  **18 files, ~334 KB** total (cached after first load).

`fonts.css` contains **only `@font-face` rules** — no component styling — so it
does not conflict with the inline-styles / no-global-stylesheet rule (ADR-0003);
it is the self-hosted equivalent of the font `<link>` it replaces.

## Consequences

**Positive**
- The app is **fully self-contained** — verified with all non-localhost requests
  blocked: **zero external requests** attempted, and IBM Plex Sans/Mono, Public
  Sans and Space Grotesk all load from local assets.
- Works in air-gapped on-prem; also removes a third-party runtime dependency and
  the privacy/latency cost of the CDN.

**Negative / trade-offs**
- ~334 KB of fonts committed to the repo and shipped in the image (small; cached).
- Adding a new family/weight now means adding its subset `.woff2` + `@font-face`
  (a small documented step) rather than editing a URL.
- Coverage is latin + latin-ext; scripts outside those ranges (e.g. Cyrillic,
  Greek, Vietnamese — offered by the CDN) are not bundled. Add those subsets if a
  future locale needs them.

## Alternatives considered

- **Keep the CDN link.** Rejected: breaks on the air-gapped target.
- **Base64-embed the fonts directly in the CSS.** Rejected: inflates the CSS bundle
  and forgoes separate caching/fingerprinting; separate `.woff2` assets are the
  standard, cache-friendly approach.
- **Bundle every subset (Cyrillic/Greek/Vietnamese too).** Deferred: latin +
  latin-ext covers the current locales; extra subsets are dead weight until needed.

## Verification

`tsc` + build clean; **0** `googleapis`/`gstatic` references in `dist`; with the
network blocked to all non-localhost hosts the page makes **0 external requests**
and `document.fonts` reports the families loaded. Axe sweep 16/16.
