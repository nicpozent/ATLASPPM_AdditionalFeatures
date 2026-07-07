# ADR-0028 — Over-allocation alerts (delivered, deduplicated)

**Status:** Accepted — builds on [ADR-0024](./0024-capacity-intelligence.md) (capacity intelligence) and the notifications service.

## Context
The Capacity insight screen (ADR-0024) shows who is loaded past 100%, but only
to someone who happens to open it. A resource manager wants to be *told* when a
person tips into over-allocation, not to have to go looking. The notifications
service already delivers in-app + email events with per-user preferences, so the
gap was a source that turns the derived over-allocation state into an event.

## Decision
Add an `over_allocation` **portfolio event type** (opt-in, off by default so it
isn't a firehose) and a background pass that emits it:

- **`CapacityAlerts.RunAsync`** computes the shared roster (`ResourcesData.
  RosterAsync`, the same time-phased load the insight screen uses), takes everyone
  over 100%, and emits one `over_allocation` notification per person to users who
  opted in (`Notifications.EmitPortfolioAsync`).
- **Deduplication via a Settings snapshot.** The set of currently-over names is
  persisted at `capacity.alert.snapshot`. Only people over *now* who weren't over
  at the previous pass are notified, so a persistently-overloaded person isn't
  re-pinged; someone who dips under and climbs back over is alerted again. The
  snapshot is refreshed every pass — even when nobody has opted in — so opting in
  later doesn't dump a backlog of already-known overloads.
- **`CapacityAlertService`** runs the pass on an interval (`Capacity:AlertHours`,
  default 24h) after a start-up delay, best-effort, idle-safe.
- **`POST /capacity/alerts/run`** (capability `cap-ops`, level E) triggers a pass
  on demand and returns the freshly-flagged names — for support and testing.

## Consequences
- **+** Over-allocation becomes a push signal (in-app now, email when Graph mail
  is configured), reusing the whole notifications/preferences pipeline.
- **+** No duplicate spam: the snapshot makes the pass idempotent between changes.
- **−** Alerting granularity is the pass interval (default daily) and the snapshot
  is a single global set, not per-recipient — a user who opts in mid-day sees new
  over-allocations from the next pass, not a replay.
- **−** "Over 100%" is a fixed threshold; a configurable per-department threshold
  could come later.

## Alternatives considered
- **Emit inline when an assignment/estimate changes** — would require hooking every
  allocation-mutating path and recomputing the person's full cross-project load on
  each; the periodic roster pass is simpler and already the source of truth.
- **No dedup, notify every pass** — daily spam for the same overloaded people;
  rejected in favour of the snapshot diff.
