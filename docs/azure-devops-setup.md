# Azure DevOps integration (connector scaffold)

Atlas connects to **Azure DevOps Services** (dev.azure.com) to discover the
organisation's projects and **map** them to Atlas projects. This is the first
phase of the connector: **connect → test → discover → import/map**. Pulling
boards / work items into Atlas tasks & sprints is a planned follow-up — the
mapping is stored now so that sync can wire it (see
`docs/architecture/adr/0035-azure-devops-connector.md`).

Two steps: (1) configure a PAT once and verify from **Integrations → Azure
DevOps → Test connection**; (2) from the **Discover from Azure DevOps** panel,
import a project to create — or link — an Atlas project (optionally under a
program). Everything stays dormant until a PAT is set.

---

## 1. What is a PAT?

A **Personal Access Token (PAT)** is a scoped, expiring credential you generate
in Azure DevOps to authenticate API/tooling access **as yourself**, without your
password and without interactive login. It's the Azure DevOps analogue of a
Jira API token: you grant it only the scopes it needs, set an expiry, and can
revoke it at any time. Atlas uses it as the password in an HTTP **Basic** header
with an **empty username** (`:PAT`) — the standard Azure DevOps PAT scheme.

Prefer a PAT tied to a dedicated **service account** rather than a person, so
access survives staff changes and is clearly attributable.

## 2. Create the PAT

1. Sign in to `https://dev.azure.com/<your-org>` as the account Atlas should
   read as.
2. **User settings (top-right) → Personal access tokens → New Token.**
3. Name it `atlas-ppm`, pick the **organisation**, and set an expiry.
4. Scopes (least-privilege):
   - **Project and Team → Read** — required for connection test & discovery.
   - **Work Items → Read** — add this now if you want the later board/work-item
     sync to work without regenerating the token.
5. **Create**, then copy the token — you can't see it again.

## 3. Configure Atlas

Set these (env vars, or a Docker secret for the token in production — see
`docs/secrets.md`). They map to `AzureDevOps__Organization` / `AzureDevOps__Pat`.

```
ADO_ORG=contoso                  # a bare org name, or https://dev.azure.com/contoso
ADO_PAT=<the token from step 2>
```

Leave them empty to keep the connector dormant — the rest of Atlas is
unaffected. In the Integrations screen the Azure DevOps card then reads
**Not configured**.

## 4. Test & import

1. **Integrations → Azure DevOps → Test connection.** Atlas calls the org's
   projects endpoint and reports success or the exact error (a `401/403`
   usually means the PAT lacks **Project and Team: Read**, or has expired).
2. Once configured, a **Discover from Azure DevOps** panel lists every project
   in the org. **Import** one to:
   - create a **new** Atlas project mapped to it, or
   - link an **existing** Atlas project, or
   - create a new project **under a program**.
3. The mapping is stored on the Atlas project (`AdoProject`) and stays editable
   from the project's details. Importing requires **Full on Projects & tasks**
   (Platform Admin / PMO / PM); testing requires **Edit on Integrations &
   connectors**.

## 5. What's not here yet

- **Board / work-item sync** (ADO work items → Atlas tasks, sprints & backlog).
  The mapping laid down by import is what that sync will read.
- **Repos / pipelines** surfacing.

These are tracked as the connector's next phase; the scaffold intentionally
ships connect + discover + map first so the credential and mapping model are in
place and verifiable.
