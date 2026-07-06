# Jira integration (Jira Cloud, pull-only)

Atlas connects to **Jira Cloud** to pull delivery data (issues, epics, sprints,
backlog, versions, worklogs) into the matching Atlas sections. This is **read-
only** — Atlas never writes to Jira in this phase.

This guide covers **Phase 1 — foundation**: configuring credentials and
verifying the connection from **Integrations → Jira → Test connection**. Actual
data sync lands in later phases; nothing moves until then.

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

Leave them empty to keep Jira dormant — the rest of Atlas is unaffected.

## 3. Verify

1. Redeploy so the API picks up the config.
2. Go to **Integrations**. The **Jira** card shows **Configured** once the three
   values are set.
3. Click **Test connection**. Atlas calls Jira's `/rest/api/3/myself` and reports
   back — on success, "Jira connected as <your service account>". On failure it
   tells you what to fix (bad URL, wrong email/token, or a permissions error).

Testing the connection requires **Edit** on the *Integrations & connectors*
capability (Platform Admin by default).

---

## What comes next (later phases, not in this one)

Once the connection verifies, the planned pull sync maps Jira → Atlas like this:

| Atlas section | Jira source |
| ------------- | ----------- |
| Project → Tasks | issues (`POST /rest/api/3/search/jql`) |
| Project → Epics | epic issues |
| Project → Sprints / Backlog | Agile boards, sprints, backlog (`/rest/agile/1.0/...`) |
| Releases | project versions (`/rest/api/3/project/{key}/version`) |
| Financials | issue worklogs → labour cost |
| Quality | Xray (separate Marketplace app + API) |

Each Atlas project will carry its **Jira project key** and **board id** so it
knows which Jira project to pull from. Synced records are marked
externally-owned so a re-sync won't clobber local edits.

## Security notes

- The API token is a **secret** — store it as a Docker/Key Vault secret in
  production, never in source control.
- Pull-only means a leaked token can *read* the mapped Jira projects but cannot
  modify Jira. Scope the service account to only the projects Atlas needs.
