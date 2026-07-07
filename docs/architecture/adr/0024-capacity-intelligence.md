# ADR-0024 — Capacity intelligence over the shared roster

**Status:** Accepted (extends ADR-0013, ADR-0020, ADR-0023)

## Context
The allocation engine (ADR-0020) and time-phasing (ADR-0013/0023) made per-person
utilisation correct. Teams then needed to *act* on it: spot over-allocation, see
where headroom is, compare demand to capacity by department, and find who to
staff for a given skill.

## Decision
Add read-only **capacity-intelligence** endpoints that derive everything from the
one shared roster, so they can never disagree with the Resources screen.

- **Shared roster.** Extract `ResourcesData.RosterAsync(db, asOf)` — the single
  time-phased roll-up (project via `AllocationEngine`, ops via `Ops`, product via
  `ProductAllocation`, plus directory names) — and reuse it in `/resources` and
  the new endpoints.
- **`GET /capacity/insight`** — portfolio capacity vs demand (headcount × 100 vs
  summed load), over-allocated (>100%), under-utilised (0–50%), unallocated and
  ≥50%-free counts, and a per-department breakdown.
- **`GET /capacity/staffing?skill=&minLevel=&minFree=`** — people rated ≥minLevel
  in a skill who have ≥minFree spare capacity, ranked by free% then rating. Joins
  `SkillRating` to the roster's free capacity.
- **Frontend** — a "Capacity insight" tab on Resources: summary tiles, a
  demand-vs-capacity bar, over/under lists, by-department bars, a skills-based
  staffing finder, and a **My allocations** panel (the signed-in identity's slices
  and free %, matched by name via the availability read).

## Consequences
- **+** Actionable capacity views with zero new data model — pure derivation over
  the existing time-phased allocation. Consistent with the roster by construction.
- **+** Skills-based staffing connects the skills matrix to real availability.
- **−** "My allocations" matches the signed-in identity **by name**; with auth off
  it uses the cosmetic demo identity. Real matching arrives with Entra SSO.
- **−** Over-allocation is surfaced on-screen (pull), not yet pushed as a
  notification — a background emitter can layer on later using the same insight.

## Alternatives considered
- **Precomputed capacity tables / nightly job** — unnecessary; the roster derives
  fast enough on read and stays live.
- **Notify on every allocation change** — noisy and needs a trigger at every write
  site; deferred in favour of the on-screen alert list.
