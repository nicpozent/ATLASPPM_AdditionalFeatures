# ADR-0084 — i18n scope: localised chrome, English content

**Status:** Accepted
**Date:** 2026-08-04
**Relates to:** NFR-I18N-1 / SBB-02 (`docs/requirements.md`, the 6-locale
catalogue + completeness test), ADR-0078 (self-hosted fonts cover the locale
character sets), CLAUDE.md §3. Implements remediation item **R16 / #102**.

> Analysis + decision only — **no strings are migrated** in the introducing PR.

## Context

`src/i18n/messages.ts` ships a **six-locale** catalogue — en, sv, fi, da, no, fr
— with **60 keys each** (`const en/sv/fi/da/no/fr` at lines 37/101/165/229/293/357),
guarded by a completeness test (`messages.test.ts`). Its header states the scope
is *"intentionally UI CHROME ONLY (nav, headings, common controls) — user-entered
data … is never translated."*

Measured today:

- **Consumers are shell components only:** `Topbar.tsx` (8 `t()` calls),
  `Sidebar.tsx` (5), `LanguagePicker.tsx` (2), plus the `t` definition in
  `i18n/index.tsx`. **Every screen file has zero `t()` calls.**
- Sidebar resolves nav keys **dynamically** — ``t(`screen.${id}.label`, s.label)``
  (`Sidebar.tsx:37`) — so most `screen.*` keys are reachable through that one
  call site even though key literals don't appear in a grep. Resolving the ids
  from `nav.ts`, the catalogue's `screen.*` / `group.*` / `common.*` keys are
  effectively all live; there is no meaningful "dead key" set.
- Screen bodies hardcode English: a heuristic count (JSX text nodes only, so an
  undercount — it misses `label`/`placeholder`/`title` props) finds **~830
  user-visible literals across ~50 screen/sub-screen files** (heaviest: Admin
  ~62, Project ~59, Releases ~52, Requirements ~47, Security ~42). The true
  figure including attribute strings is higher — order ~1,000–1,500 distinct
  strings.

So switching language today translates the nav + topbar while every screen body
stays English — a half-translated UI in any non-English locale.

**Is multi-language a hard requirement?** The only commitment in the docs is
**NFR-I18N-1** *(Implemented)*: "The UI SHALL be driven by a message catalogue
with **6 locales and a completeness test**. *Trace: SBB-02.*" The HLD echoes this
("a test guarantees every screen has a translatable label/subtitle" — i.e. the
nav label/subtitle, which are chrome). **Nothing requires screen-body copy to be
translated.** The existing chrome catalogue + completeness test already satisfy
NFR-I18N-1. (For Birgma/Biltema — Nordic retail — the commercially relevant
locales are sv/fi/da/no, not fr; that matters if the scope is ever widened.)

## Options

- **(a) Finish it.** Extract the ~1,000+ screen strings into the catalogue across
  all six locales, add an ESLint rule banning literal user-visible JSX text so it
  can't regress, keep all six locales complete in CI. Delivers a fully localised
  product; costs a large one-time extraction **plus** an ongoing translation
  burden on every new string in six languages — with no requirement mandating it,
  and no committed translator pipeline for the Nordic locales.
- **(b) Chrome-only is the decision.** Record that Atlas is an
  **English-content app with localised chrome** (nav, topbar, global controls,
  language picker). Keep the six-locale catalogue as the fast, offline,
  test-guarded baseline it already documents itself to be. Add a rule so new
  strings land in the right place by rule, not taste.

## Decision — (b), with a clean path to (a)

Adopt **chrome-only** as the deliberate, documented scope for now:

- **Chrome** (navigation, topbar, language picker, and global/common controls
  and the empty/error-state framework shared across screens) is localised via
  `messages.ts` + `t()`, all six locales, gated by the completeness test.
- **Screen content** (in-screen headings, field labels, section titles,
  empty-state copy, buttons specific to a screen) is **English**, written inline.
- **User-entered data** (project names, comments, demands, …) is **never**
  translated.

Rationale: NFR-I18N-1 is already met; option (a) is a large, open-ended cost with
no requirement or translator pipeline behind it, so committing to it now would be
speculative. Recording chrome-only stops the undocumented middle (someone
half-extending `t()` into a few screens) without foreclosing full i18n — the
infrastructure (`t()`, the catalogue, the completeness test, self-hosted locale
fonts from ADR-0078) is all in place, so a later product-owner decision to widen
scope is a follow-up ADR that flips option (a) on: extract per screen + add the
lint rule, no re-architecture.

## The rule a developer applies (added to CLAUDE.md §3)

*Where does a new string go?*

1. Is it **user-entered data**? → never translated; store/display as-is.
2. Is it **chrome** — navigation, topbar, the language picker, or a
   global/common control/state shared across screens? → add a key to all six
   locales in `src/i18n/messages.ts` and render it with `t()`. The completeness
   test will fail if a locale is missing the key.
3. Otherwise it is **screen content** → write it inline in **English**. Do not
   route it through `t()` (that would re-open the half-translated middle this ADR
   closes).

## Consequences

- **Positive.** The scope is now a decision, not an accident; a developer knows
  where every new string belongs. The catalogue keeps earning its keep (localised
  nav is what most users see first) and stays honest to its own header. No
  speculative translation debt.
- **Negative / accepted.** Non-English users see localised chrome around English
  screen content. This is the explicit, recorded trade-off — acceptable because
  no requirement asks for more and the audience is an internal PPM tool.
- **Reversible.** Widening to full i18n is a scoped follow-up (option a) that the
  existing infrastructure already supports; this ADR would then be superseded.
- **No code change here** beyond the CLAUDE.md rule — no strings migrated, the
  catalogue and its test are unchanged.
