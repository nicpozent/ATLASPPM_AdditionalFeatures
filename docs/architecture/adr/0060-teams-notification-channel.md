# ADR-0060 — Microsoft Teams as a third notification channel

**Status:** Accepted — extends the notification system
([ADR-0028](./0028-over-allocation-alerts.md) alerts,
[ADR-0045](./0045-per-role-demand-email.md) per-role email) and the connector
pattern ([ADR-0006](./0006-jira-pull-only-board-optional.md),
[ADR-0035](./0035-azure-devops-connector.md)).

## Context
Atlas already emits notifications on three paths — entity events (a subscribed
project/program/product changes), portfolio events ("created"), and
role-addressed governance events (a demand pinging the PMO/Architect/CTO). Each
is delivered **in-app** and, when Microsoft Graph Mail.Send is configured, by
**email**. The prototype's Integrations screen lists **Microsoft Teams** as a
connector ("Channel & chat notifications"), but it was cosmetic chrome. Teams is
where the org actually works, so notifications should be able to land there too —
without inventing a new UI or a new delivery contract.

## Decision
Add **Teams as a third channel** to the *existing* emit paths, not a parallel
system. `Notifications.{EmitToEntityAsync, EmitPortfolioAsync, EmitToRolesAsync}`
each call `TeamsNotify.EmitAsync(db, title, body)` after persisting the in-app
copy and sending email, so any event already produced is mirrored to a Teams
channel with the same title/body.

**Delivery** is an **Incoming Webhook** — created in Teams via *Workflows → "Post
to a channel when a webhook request is received"*, the forward-looking
replacement for the retired O365 connectors. Atlas POSTs an **Adaptive Card**
(the `type:"message"` + `attachments[]` envelope Workflows expects). Best-effort:
the in-app copy is always written first, so an unconfigured connector or a Teams
outage degrades silently rather than failing the originating action — identical
to the email contract.

**Configuration** lives in the `Setting` key/value store (`teams.webhookUrl`,
`teams.enabled`), reachable only through **`cap-integrations`-gated** endpoints
(`GET /integrations/teams/status`, `POST …/config`, `POST …/test`). The webhook
URL is a channel secret, so — unlike the generic `GET /settings` — it is **never
returned to the client**: status exposes only a masked `scheme://host` and the
`configured`/`enabled` booleans. The Integrations screen's Teams row becomes a
live connector (Configure modal + Send-test), mirroring the Jira/ADO rows.

## Consequences
- **+** Notifications reach Teams with zero new event plumbing and no new Graph
  permissions/consent (webhook is channel-scoped, not tenant-wide).
- **+** Fully degradable and opt-in: idle until an admin pastes a URL and enables
  it; muting keeps the URL but stops delivery.
- **+** Secret-safe: the URL is write-only over the API and kept out of the
  broadly-readable `/settings` payload.
- **−** A single channel per instance (one webhook). Per-event or per-team routing
  is a candidate follow-up, not this ADR.
- **−** Outbound-only. Two-way (actionable cards, replies) would need a Teams app
  / bot registration and is out of scope.

## Alternatives considered
- **Graph channel messages** (`POST /teams/{id}/channels/{id}/messages`) — richer,
  but needs `ChannelMessage.Send` application permission (protected API, heavier
  consent/licensing) for app-only posting. Rejected for the default path; the
  webhook is the lowest-friction fit and reuses the connector mental model.
- **Legacy O365 "Incoming Webhook" connector** (MessageCard) — simplest, but
  Microsoft is retiring O365 connectors; targeting the Workflows Adaptive-Card
  envelope is future-proof.
- **A separate Teams preference per event type** — deferred; the channel rides the
  existing in-app/email preferences and subscriptions rather than adding a third
  column to every preference row now.
