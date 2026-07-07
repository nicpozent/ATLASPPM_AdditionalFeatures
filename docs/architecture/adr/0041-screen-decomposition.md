# ADR-0041 — Decomposing large screen files into per-tab modules

**Status:** Accepted — refines [ADR-0003](./0003-inline-styled-frontend.md)
(inline-styled screens) on the maintainability axis (ABB-01).

## Context
Two screens had grown far past a comfortable size: `Project.tsx` (~4,300 lines,
~50 sub-components across a dozen tabs) and `Resources.tsx` (~750 lines). Big
single files slow navigation, review and fast-refresh, and make ownership of a
tab unclear — the maintainability gap flagged in the application evaluation.

## Decision
Split each large screen into a folder of focused modules, **behaviour-preserving**
(no logic changes — only moves + imports):
- **`screens/project/`** — `shared.tsx` (presentational helpers: `SectionTitle`,
  `PdField`, `KV`, `Meta`, `ChipRow`, `DecLabel`), `util.ts` (non-component
  helpers: `sectionTitleS`, `fmtSize`), and one file per extracted tab
  (`Security`, `Requirements`, `Architecture`, `Quality`). `Project.tsx` imports
  them; the remaining tabs stay inline for now.
- **`screens/resources/`** — `shared.tsx` (`EmptyPanel`), `util.ts`
  (`selectStyle`), `Capacity.tsx` (capacity insight + staffing + my-allocations),
  `Availability.tsx` (availability finder). `Resources.tsx` imports them.
- **Convention**: components-only files stay `.tsx`; non-component helpers live in
  a sibling `.ts` so React fast-refresh stays clean (no mixed-export warning).

Result: `Project.tsx` ~4,300 → ~2,960 lines, `Resources.tsx` ~750 → ~420.

## Consequences
- **+** Smaller, single-responsibility files; a tab's code (types + component +
  modals) lives together and is easy to find and own.
- **+** Establishes a repeatable extraction pattern (shared/util + per-tab file)
  the remaining Project tabs can follow incrementally.
- **−** A little more cross-file import wiring; shared helpers now have an explicit
  home rather than being co-located.
- **−** `Project.tsx` is still large (~2,960) — full atomisation is deferred; the
  highest-value tabs were extracted first.

## Alternatives considered
- **Leave the files as-is** — the flagged maintainability cost remains; rejected.
- **Atomise everything in one pass** — larger, riskier diff on a critical screen;
  a staged extraction keeps each step verifiable (build + lint + tests + e2e).
