# ADR-0035 — Azure DevOps connector (scaffold: connect · discover · map)

**Status:** Accepted — first realisation of the roadmap building block "Azure
DevOps connector (next)" in `building-blocks.md` (ABB-05 Integration). Follows
the Jira connector pattern (ADR-0006/0018/0021).

## Context
Only Jira and Microsoft Graph were implemented for ABB-05. Azure DevOps is the
next-most-requested source. A connector is a sizeable surface (auth, discovery,
work-item/board sync, repos, pipelines); shipping it all at once is risky and
delays any value. We want the credential model and the project-mapping model in
place — and independently verifiable — before building the heavier sync.

## Decision
Ship a **scaffold** that mirrors Jira's connector shape and is dormant until a
PAT is configured:

- **Config & auth.** `AzureDevOps:Organization` (bare org name or full
  `https://dev.azure.com/<org>` URL) + `AzureDevOps:Pat`. Auth is HTTP **Basic**
  with an empty username and the PAT as the password (`:PAT`) — the standard
  Azure DevOps PAT scheme, analogous to Jira Cloud's `email:api-token`. All
  empty ⇒ the connector stays off and the rest of Atlas is unaffected.
- **Endpoints** (`/api/v1/integrations/ado/*`): `status` (config only, never
  calls ADO), `test` (lists the org's projects, reports ok/error gracefully),
  `projects` (discovery — lists the org's projects, flagging those already
  mapped), and `import` (map an ADO project to a **new/existing** Atlas project
  or a new project **under a program**). Gated exactly like Jira: `status`/`test`
  need Edit on Integrations; discovery needs Edit and import needs Full on
  Projects & tasks.
- **Mapping storage.** `Project.AdoProject` holds the linked ADO project
  name; surfaced in `ProjectDetailDto`. The org is global config, so it isn't
  stored per project.
- **Frontend.** The Azure DevOps card in Integrations is wired to the real
  status/test; a **"Discover from Azure DevOps"** panel and import modal mirror
  the Jira ones (no board field, no Ops target).

## Consequences
- **+** Credentials and the mapping model are in place and covered by tests
  (`AzureDevOpsTests`), so the follow-up sync has a foundation to build on.
- **+** Reuses Jira's proven patterns (graceful not-configured, capability
  gates, discovery/import) — low conceptual overhead.
- **−** No board / work-item sync yet: importing stores the mapping but does not
  pull tasks, sprints or backlog. Called out in the UI and `docs/azure-devops-
  setup.md`.
- **−** PAT auth is per-token (no OAuth app / Entra-federated identity yet);
  acceptable for a service-account PAT, revisit if org policy forbids PATs.

## Alternatives considered
- **Build the full connector (incl. work-item sync) in one pass** — larger,
  riskier change with no intermediate, verifiable milestone; rejected in favour
  of the connect→discover→map scaffold.
- **Store the ADO mapping in a separate table** — unnecessary; a project links
  to at most one ADO project, so a column on `Project` mirrors `JiraProjectKey`.
- **Entra-federated auth instead of a PAT** — heavier setup; a scoped,
  revocable service-account PAT is the pragmatic first step (ADR can supersede).
