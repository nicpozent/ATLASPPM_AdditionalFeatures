# Microsoft Teams notifications

Atlas can post every notification it raises (project/program/product events,
new-item alerts, and role-addressed governance events) to a **Microsoft Teams
channel** as an Adaptive Card — in addition to the in-app inbox and email.

This is **outbound-only** and **best-effort**: the in-app copy is always written
first, so if Teams is unreachable or unconfigured nothing else breaks. See
[ADR-0060](./architecture/adr/0060-teams-notification-channel.md).

## 1. Create a channel webhook (Workflows)

Microsoft has retired the classic *Office 365 connectors*; the current mechanism
is a **Workflow** with an HTTP trigger:

1. In Teams, open the target channel → **⋯ → Workflows**.
2. Choose the template **“Post to a channel when a webhook request is
   received”** and complete the short wizard (pick the team + channel).
3. Copy the generated **HTTP POST URL**. This URL is a **secret** — anyone with
   it can post to the channel.

## 2. Connect Atlas

1. Sign in as a user with **Edit** on *Integrations & connectors* (Platform
   Admin / PMO).
2. Go to **Integrations & Settings → Connected tools → Microsoft Teams →
   Configure**.
3. Paste the webhook URL, tick **Deliver notifications to this channel**, and
   **Save**.
4. Click **Send test** — a card should appear in the channel within a few
   seconds.

The webhook URL is stored server-side and is **never** shown again (the status
API returns only the host, e.g. `https://prod-12.westeurope.logic.azure.com`).
To rotate it, paste a new URL over the old one; to stop delivery without losing
the URL, untick the toggle; to remove it entirely, use **Disconnect**.

## 3. What gets posted

Every notification Atlas already emits — the same title and body as the in-app
and email copies. A card carries an **Atlas PPM** header plus the event title and
detail. Delivery rides the existing subscriptions and preferences; there is no
separate per-event Teams setting (a candidate follow-up).

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| **Send test** returns an error with a 4xx | The webhook URL is wrong/expired, or the Workflow was deleted — recreate it and re-paste. |
| Test succeeds but events don't post | The **Deliver notifications** toggle is off (status shows *Muted*), or no one is subscribed to the item that changed. |
| Nothing at all, no error | The connector isn't configured — the Teams row shows *Not connected*. |

Delivery failures are logged under `Atlas.TeamsNotify` (they never fail the
originating request).
