# ADR-0076 — Server-persisted theme preference + theme-aware charts

**Status:** Accepted
**Date:** 2026-07-22
**Relates to:** ADR-0056 (per-profile dark mode), ADR-0074 (Atlas brand themes),
ADR-0075 (primary fill/text split)

## Context

Two follow-ups to the Atlas brand themes (ADR-0074):

1. **Persistence was per-browser only.** The chosen theme was saved in
   `localStorage`, keyed by the cosmetic role persona — so it did not follow a
   signed-in user to another device or browser.
2. **Charts didn't re-skin.** `chart.*` was literal hex, so on the dark themes the
   structural greys (grid, progress-bar track, planned line) stayed light-grey and
   the status hues were fixed. (Text/surface tokens already themed via ADR-0074.)

## Decision

### Server-persisted theme (cross-device)

Add a per-user theme preference, mirroring the existing `DashboardLayout`
per-user store (which already "follows the user across devices; client falls back
to localStorage when signed out"):

- **Entity** `ThemePref { UserKey (PK), Theme }`, keyed by `Permissions.CallerKey`.
- **Endpoints** `GET /api/v1/prefs/theme` → `{ theme }` and `PUT /api/v1/prefs/theme`
  `{ theme }`. The PUT **whitelists** the known theme ids (server-authoritative;
  an unknown id is rejected 400) — kept in sync with `theme.ts` `THEMES`.
- **Client** (`ThemeContext`): signed **in**, hydrate the theme from the server on
  mount and write it back on change (best-effort); the theme is then **per user**,
  not per persona (persona switches don't reset it). Signed **out**, unchanged —
  `localStorage` per persona. `localStorage` remains an optimistic/offline cache.

### Theme-aware charts

Make `chart.*` themeable through the **same** CSS-variable mechanism as `color.*`:
each flat token becomes `var(--atlas-chart-<key>, <light-hex>)`, `applyThemeVars`
writes `--atlas-chart-*` for the active theme, and per-theme `chartPalettes` supply
the values. The chart primitives already apply colours via the `style` prop
(CSSOM), where `var()` resolves; the one remaining raw SVG `stroke=` attribute was
flipped to `style`. `chart.method` (methodology chip hues) stays literal — it reads
on every ground. Chart hues are graphics, not text, so they are **not**
contrast-gated; per-theme values are tuned for harmony.

## Consequences

**Positive**
- A signed-in user's theme follows them across devices/browsers; server is
  authoritative and validates the id.
- Charts (grid, track, planned, status hues, pipeline stages) re-skin per theme —
  the dark themes no longer show light-grey chart chrome.
- Both reuse existing machinery (the `DashboardLayout` pattern; the `--atlas-*`
  var system), so little new surface.

**Negative / trade-offs**
- One more per-user table + migration (`ThemePref`).
- New white-content charts must keep applying colours via `style` (not SVG
  attributes) for the var to resolve — documented in `charts.tsx`.
- Signed-in first paint on a new device briefly shows the local/default theme
  before the server value hydrates (one-frame flash; acceptable).

## Alternatives considered

- **A generic `UserSetting { UserKey, Key, Value }` KV** instead of a dedicated
  table. Rejected: the codebase uses dedicated per-feature per-user tables
  (`DashboardLayout`); matching that idiom is clearer than introducing a KV.
- **Keep charts literal and only theme the greys inline.** Rejected: piecemeal;
  the var mechanism already exists and covers all chart tokens uniformly.

## Verification

Backend: `dotnet build` clean; **472/472 tests pass** on net10; migration creates
only the `ThemePrefs` table. Frontend: `tsc` + build clean; 124 unit tests; axe
sweep 16/16. Verified end-to-end that `:root` carries the active theme's
`--atlas-chart-*` values (e.g. Atlas Carbon → `--atlas-chart-grid: #20242e`).
