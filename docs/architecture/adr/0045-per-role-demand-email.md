# ADR-0045 — Per-role email for demand notifications

**Status:** Accepted — extends role-addressed notifications (ADR-0043) and the
directory group→role mapping (ADR-0030-era Teams).

## Context
Demand create / status changes already fan out **in-app** to leadership roles
(PMO, Chief Architect, CTO, CIO, PM Lead) via role-addressed notifications
(ADR-0043). Email — the channel execs actually watch — was missing for that
fan-out, because "notify a role" needs role → people → addresses, and the naïve
source (the Entra `manager` attribute) can be **overridden** by the in-app
manager mapping, so it isn't authoritative here.

## Decision
- **Resolve recipients via the IN-APP mapping.** `Notifications.ResolveRoleEmailsAsync`
  finds `EntraGroup`s whose `ManagerKey` is one of the target roles and takes their
  members' (`TeamMemberRow`) emails. The in-app group→role mapping (Admin → Teams)
  is authoritative — it wins over the raw directory manager attribute, matching how
  the app already resolves manager identity.
- **Default-on, per-person opt-out.** Everyone in a target role is emailed by
  default; a person opts out with a `NotificationPref` for that event type with
  `Email=false` (the same subscribe/unsubscribe surface users already have). In-app
  role fan-out is unchanged and always delivered.
- **CTO / CIO are mappable.** Added `cto` and `cio` to the Teams manager slots so a
  directory group can be mapped to them (the UI reads slots from the API, so it
  picks them up automatically).
- **Best-effort, degrades cleanly.** Email goes through the existing Graph
  `Mail.Send` path (ADR-config). No directory sync ⇒ no mapped members ⇒ no
  addresses ⇒ **in-app only** — nothing fabricated, nothing breaks.

## Consequences
- **+** Leadership gets demand email without anyone subscribing per-demand, using
  the mapping the org actually maintains — and any individual can still opt out.
- **+** Onboarding a person (directory sync populates `TeamMemberRow.Email`) is all
  that's needed for them to receive it; no per-recipient config.
- **+** Reuses the notification-prefs consent surface (GDPR-friendly: default-on
  but revocable, no new consent store).
- **−** Requires the directory + group→role mapping to be populated; until then the
  fan-out is in-app only (acceptable, and the honest empty-state default).
- **−** Opt-out is keyed by the person's directory `Uid`; a member without a `Uid`
  can't be individually excluded (still receives — conservative, and such rows only
  exist for hand-added manual members).

## Alternatives considered
- **Resolve from the Entra `manager` attribute** — the exact thing the user flagged
  as overridable; rejected in favour of the in-app mapping.
- **Opt-in only (email off by default)** — contradicts "keep the default role
  notifications we have today"; default-on with opt-out matches intent.
- **Per-demand recipient picker** — more UI per demand; the standing leadership set
  plus personal opt-out is simpler and matches the ask.
