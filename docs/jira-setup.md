# Jira integration (Jira Cloud, pull-only)

Atlas connects to **Jira Cloud** to pull delivery data (issues, epics, sprints,
backlog, versions, worklogs) into the matching Atlas sections. This is **read-
only** — Atlas never writes to Jira in this phase.

Two steps to get data flowing: (1) configure credentials once and verify from
**Integrations → Jira → Test connection**; (2) map each Atlas project to a Jira
project key + board id, then sync its **sprints, epics, issues and backlog** in.
Sync is one-way and idempotent — it never touches locally-created rows and never
writes to Jira.

---

## 1. Create an Atlassian API token

1. Sign in to Atlassian as the **service account** Atlas should read Jira as
   (a dedicated, licensed account is cleaner than a person's).
2. Go to **id.atlassian.com → Security → Create and manage API tokens →
   Create API token**. Name it `atlas-ppm` and copy the token — you can't see it
   again.
3. Make sure that account has **Browse Projects** permission on every Jira
   project Atlas should read. (No write permissions are needed — this phase is
   pull-only.)

> Auth is HTTP **Basic** with `email:api-token`. Atlas builds the header for you;
> you only supply the three values below.

## 2. Configure Atlas

Set these (env vars, or a Docker secret for the token in production — see
`docs/secrets.md`). They map to `Jira__BaseUrl` / `Jira__Email` / `Jira__ApiToken`.

```
JIRA_BASE_URL=https://yoursite.atlassian.net    # your Jira Cloud site, no trailing path
JIRA_EMAIL=svc-atlas@birgma.com                 # the service account's email
JIRA_API_TOKEN=<the token from step 1>
```

Leave them empty to keep Jira dormant — the rest of Atlas is unaffected. The
base URL is forgiving: a missing `https://` is added and a pasted full board URL
is trimmed to the site origin.

Optional — if your site uses a non-default **story points** custom field, set
`JIRA_STORY_POINTS_FIELD` (env `Jira__StoryPointsField`) to its id. The default
is `customfield_10016`, Jira Cloud's usual "Story point estimate" field.

## 3. Verify

1. Redeploy so the API picks up the config.
2. Go to **Integrations**. The **Jira** card shows **Configured** once the three
   values are set.
3. Click **Test connection**. Atlas calls Jira's `/rest/api/3/myself` and reports
   back — on success, "Jira connected as <your service account>". On failure it
   tells you what to fix (bad URL, wrong email/token, or a permissions error).

Testing the connection requires **Edit** on the *Integrations & connectors*
capability (Platform Admin by default).

## 4. Map a project and sync

Two ways to link a Jira project to Atlas:

**A. Discover & import (recommended).** On **Integrations → Jira → Discover from
Jira**, Atlas lists every project in your Jira site. A Platform Admin, PMO or PM
clicks **Import** on one and maps it to a **new** Atlas project, an **existing**
project, or a **new project under a program** — optionally entering the board id.
It stays editable afterwards from the project's details.

**B. Manual mapping.** Open a project (**Portfolio → a project**) → **Edit**.
Under **Jira sync (pull-only)**, set the **Jira project key** (e.g. `GIT`) and
**board id** (the number in the board URL: `.../boards/93/...` → `93`). Leave both
blank to unlink.

Then pull the data: on the project's **Tasks** tab click **Sync from Jira**, or
use **Integrations → Jira → Sync now** to pull every mapped project at once.

What the sync maps, Jira → Atlas:

| Atlas section | Jira source |
| ------------- | ----------- |
| Project → Sprints | board sprints (`/rest/agile/1.0/board/{id}/sprint`); state → Planned/Active/Closed |
| Project → Epics | board epics (`/rest/agile/1.0/board/{id}/epic`); story rollup counted from issues |
| Project → Tasks | board issues (`/rest/agile/1.0/board/{id}/issue`); status category, assignee, priority, due date, points |
| Project → Backlog | issues with no sprint |

**Idempotent & safe.** Each synced sprint/epic/task carries its Jira id. A
re-sync upserts by that id, prunes synced rows that vanished from Jira, and
**never touches locally-created rows** (those you added by hand in Atlas). Points
come from the story-points custom field (see `JIRA_STORY_POINTS_FIELD` above).

Syncing requires **Edit** on the *Integrations & connectors* capability.

---

## What comes next (later phases)

| Atlas section | Jira source |
| ------------- | ----------- |
| Releases | project versions (`/rest/api/3/project/{key}/version`) |
| Financials | issue worklogs → labour cost |
| Quality | Xray (separate Marketplace app + API) |
| (later) 2-way | webhooks + write-back to Jira |

## Security notes

- The API token is a **secret** — store it as a Docker/Key Vault secret in
  production, never in source control.
- Pull-only means a leaked token can *read* the mapped Jira projects but cannot
  modify Jira. Scope the service account to only the projects Atlas needs.
