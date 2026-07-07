# ADR-0023 — Close allocation gaps: time-phased Ops, hours/dates editing, server-side custom dashboard

**Status:** Accepted (extends ADR-0013, ADR-0014, ADR-0020)

## Context
Three known gaps remained after the allocation work: Ops load ignored dates (so
BAU counted forever), the Resources → By-project editor was **%-only** (no hours
or window, unlike the Team panel), and the Custom dashboard layout lived in one
browser's `localStorage`.

## Decision
- **Time-phase Ops.** `OpsItem` gains `StartDate`/`EndDate`; `Ops.AllocByPersonAsync`
  takes an `asOf` and counts an item only while its window is live (empty = open),
  exactly like project allocation. Resources passes the roster's as-of date;
  capacity uses today. Item create/edit expose the dates.
- **Hours + dates in Resources → By-project.** `SetAllocReq`/the PATCH accept
  weekly hours (hours win over %), a date window, and an extension — reusing the
  `TeamAssignmentMember` fields and `AllocMath` — so an edit made here is
  time-phased, not a flat %. `ResAllocRowDto` returns the full shape; the row has
  an inline hours/date editor.
- **Server-side custom dashboard.** A per-user `DashboardLayout { UserKey, Widgets }`
  with `GET/PUT /dashboard/custom` (keyed by `CallerKey`). The Custom builder
  loads the server layout on mount and saves on every change, with `localStorage`
  as an offline fallback so nothing breaks when signed out.

## Consequences
- **+** Ops utilisation is now correct over time (a June-only incident stops
  counting in August). Capacity math is consistent across project/ops/product.
- **+** Planners get one editing model (hours or %, with dates) wherever they set
  allocation. The custom dashboard follows the user across devices.
- **−** The custom layout is per user key; with auth off (shared dev key) all
  users share one layout — acceptable, and the localStorage fallback covers it.

## Alternatives considered
- **Keep Ops date-less** — simplest but wrong over time; rejected.
- **Custom dashboard in a generic Settings row** — works, but a typed
  per-user entity is clearer and cheap.
