# ADR-0082 — Persist dates as real `date`/`timestamptz`, format at the edge

**Status:** Proposed — *ADR only; no schema change in the introducing PR*
**Date:** 2026-08-04
**Relates to:** ADR-0081 (generated API type contract — the migrated shapes must
flow through `npm run api:types`), ADR-0018 / ADR-0021 (Jira import already
carries real ISO timestamps), CLAUDE.md §6 (Data & API). Implements
remediation item **R14 / #100**.

> This records a **decision + migration plan**. Per #100 the introducing change
> writes only this ADR and the interim CLAUDE.md rule — **no column is migrated
> and no EF migration is added here**. Each module's migration is a separate
> follow-up (listed at the end), sequenced *after* R11 so the regenerated types
> pick up the new shapes.

## Context

Atlas stores dates in **three different conventions, all typed `string`**,
distinguishable only by a trailing comment:

- **Display strings** — `"12 Sep 2026"`, `"Aug 04"`. ~23 columns.
- **ISO strings** — `"2026-09-12"`, ISO timestamps from Jira. ~25 columns.
- **Month labels** — `"Aug"`. A couple of columns.

Because the type is `string` for all three, nothing distinguishes them at the
type level, and the display ones carry real defects:

1. **Unsortable / unfilterable in SQL.** "Demands raised last quarter" cannot be
   a `WHERE` clause; no query orders by any display-date column because it can't.
2. **`Demand.Date` is lossy.** `Kernel/Domain.Portfolio.cs:46` is `"MMM dd"`
   (`"Jun 23"`), written at `Kernel/WriteEndpoints.cs:65`
   (`DateTime.UtcNow.ToString("MMM dd")`) — **no year**. Two demands twelve
   months apart are indistinguishable in storage. This is the worst offender.
3. **Locale-fragile read-back.** `Delivery/Gantt.cs:26` parses a display date
   with `DateTime.TryParse(display, …)` and **no `CultureInfo`** — it works only
   because `<InvariantGlobalization>true</InvariantGlobalization>` is set in
   `Atlas.Api.csproj:7`. Elsewhere (`Jira.cs`, `SecretRotation.cs`) parsing
   passes `InvariantCulture` explicitly, so even the convention is inconsistent.
4. **Frontend duplication.** The string contract forces the client to convert
   both ways: **12 near-duplicate `toIso`/`toDisplay` functions across 6 screens,
   with 6 separate month-name arrays** (Methodologies, Okrs, Products, Programs,
   Project, Portfolio).

There are **22 display-format write sites**, re-derivable with:

```bash
grep -rnoE 'ToString\("[^"]*MMM[^"]*"\)' server/**/*.cs   # 18 display-format sites
grep -rn 'ToString("yyyy-MM-dd HH:mm")' server/**/*.cs     # 4 watermark sites (Jira.cs)
```

## Options considered

1. **Leave as-is.** Zero cost now; the SQL-blindness, the lossy `Demand.Date`,
   the locale fuse and the frontend converter sprawl all remain. Rejected.
2. **ISO strings everywhere.** Normalise all date columns to ISO-8601 `string`.
   Fixes lexicographic sortability and losslessness cheaply (no type change), and
   kills the month-label/display conventions. But the column stays `string`: the
   database still can't do date arithmetic or range indexes, EF can't project a
   `DateOnly`, and "last quarter" is still a string comparison. A half-measure.
3. **Real `date` / `timestamptz` types (chosen).** Store each date as the
   Postgres type that matches its meaning, map to `DateOnly` / `DateTime` (UTC)
   in EF Core, and format for display **once, at the edge**. Highest migration
   cost, but it is the only option that makes dates first-class: sortable,
   filterable, range-indexable, and typed end-to-end through the ADR-0081
   generated contract.

## Decision

Adopt option 3.

- **Storage.** Each date column becomes a real Postgres type:
  - **`date` → `DateOnly`** for calendar dates with no time-of-day meaning:
    `Project.Target` / `Due` / `StartDate`, `Program`/`Product`/`Objective`
    start/end/target dates, `Demand.Date`, gate `Date`, decision `Date`,
    delivery-report `Date`, blocker/activity `Date`.
  - **`timestamptz` → `DateTime` (UTC)** for true instants:
    `*.CreatedAt` / `UploadedAt` / `DecidedAt`, backup timestamps, and the Jira
    sync watermarks. Npgsql maps `timestamptz` to a UTC `DateTime`; all writes
    use `DateTime.UtcNow` (already the case).
  - Columns that already hold **ISO strings** from Jira (`JiraCreated`,
    `StartedAt`, `ResolvedAt`, sprint dates, …) migrate opportunistically with
    their module — they are correct in value, just still `string`.
- **Wire format.** DTOs project dates to **ISO-8601 strings** (`date` →
  `yyyy-MM-dd`, `timestamptz` → round-trip `o`) at the API boundary, with
  `InvariantCulture`. ISO is stable, sortable and culture-independent, and flows
  through the ADR-0081 generated types unchanged.
- **Display.** Formatting moves to the **frontend edge**: one shared
  `formatDate(iso, style)` helper replaces all 12 converters and 6 month arrays.
  The server no longer produces display strings.
- **Read-back.** `Delivery/Gantt.cs`-style parsing disappears — the value is
  already a real date. `InvariantGlobalization=true` stays (it is defensible on
  its own), but no code will *depend* on it for date correctness.

## Consequences

- **Positive.** Dates become sortable/filterable/indexable in SQL; `Demand.Date`
  stops losing the year; the locale fuse stops being load-bearing; the frontend
  loses ~12 converters + 6 month arrays for one formatter; the three-conventions
  ambiguity is gone (the *type* now says what a column is).
- **Cost.** ~23 columns migrate with data-preserving EF migrations that must
  **parse existing display strings** into real dates (and, for `Demand.Date`,
  **infer the year** — see below). Each migration touches its module's DTOs,
  write sites, and the frontend screen that consumed the strings. This is why it
  is staged per module, not attempted at once.
- **`Demand.Date` back-fill is best-effort.** Existing `"MMM dd"` values have no
  year; the migration assigns the year that makes the date most recent but not
  in the future (nearest-past heuristic), logs each inference, and — because it
  cannot be certain — this is called out in the migration's PR. New writes store
  the full date, so the ambiguity ends at migration time.
- **EF mapping note.** `DateOnly` requires Npgsql's built-in `date` mapping (no
  converter needed on .NET 8+/Npgsql 8+). `timestamptz` requires the `DateTime`
  to be `DateTimeKind.Utc`; a model-level convention will assert this so a
  `Local`/`Unspecified` write can't slip through.

## Interim rule (holds until the migration completes)

Added to CLAUDE.md §9: **no new display-string date columns.** Every new date
field is `DateOnly` (calendar date) or `DateTime` UTC (instant), stored as
`date`/`timestamptz`, serialised as ISO at the API, and formatted for display on
the frontend. No `ToString("…MMM…")` into a persisted column.

## Migration order (per-module follow-ups — one PR each)

Each follow-up migrates one module's columns **and deletes that module's
frontend converter(s) in the same change**, then regenerates the R11 types.

1. **Portfolio — `Demand.Date` first** (actively lossy), then
   `Program`/`Product`/`Objective` start/end/target, blocker/activity `Date`,
   `CreatedAt`. Deletes `Portfolio.tsx`, `Programs.tsx`, `Products.tsx`,
   `Okrs.tsx` converters.
2. **Delivery** — `Project.Target`/`Due`/`StartDate`, delivery-report `Date`,
   artifact `UploadedAt`. Deletes `Project.tsx` converters.
3. **Governance** — decision `Date`/`DecidedAt`, artifact `UploadedAt`, gate
   `Date`.
4. **Operations** — demand/incident `Date`, `CreatedAt`.
5. **Platform** — audit/activity `Date`.
6. **Comms** — `Date`. Deletes `Methodologies.tsx` converter (create-project
   wizard) if still present.

Acceptance for the whole track (not this PR): the two `grep` patterns above
return **zero** persisted-column write sites, and
`grep -rn 'toIso\|toDisplay' src/screens` is empty.
