# ADR-0016 — Customizable skills matrix, name-keyed ratings

**Status:** Accepted

## Context
My Team needed a competency matrix that managers define themselves (their own
skill columns) and rate their people on, without a fixed taxonomy — and it must
cover the people they actually manage.

## Decision
`Skill` (customizable columns) × person × `SkillRating` (0–4 level). Ratings are
**keyed by person name**, matching how assignments and the directory already
identify people (Atlas has no single stable person entity — people come from
Entra, resources and allocations, all joined by name).

- `GET /skills` returns the matrix scoped to the caller's **Entra management
  roster** (`Teams.ScopeAsync`; Platform Admin/PMO with no scope see everyone),
  ratings pre-filtered to that roster.
- Editing needs `cap-projects` Edit (the managers who own My Team).

## Consequences
- **+** No imposed taxonomy; each team models the skills it cares about.
- **+** Ratings join cleanly to assignments/availability by name — enabling
  skills-based staffing views.
- **−** Name-keying is fragile if a person is renamed; acceptable given the whole
  identity model is name-based, and Entra display names are stable in practice.
- **−** The roster scope means a rating for someone outside the viewer's
  management scope isn't returned by `/skills`; entity-scoped skill views (e.g.
  a project's assigned team) need a dedicated, un-roster-filtered read.

## Alternatives considered
- **Fixed skill list** — simplest but doesn't fit diverse Nordic-retail teams;
  rejected.
- **Rating keyed by a person id** — cleaner, but there is no single person id in
  Atlas; would require a person-master first. Deferred.
