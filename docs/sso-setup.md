# SSO & directory setup (Microsoft Entra)

How to turn on Entra sign-in, the app roles to create, and the Microsoft Graph
credentials that power the Teams directory sync. Everything here is **off until
configured** — Atlas runs anonymously for local/demo use.

---

## 1. Sign-in (Entra bearer auth)

Enable token validation on the API and MSAL sign-in on the frontend:

| Setting | Where | Value |
| ------- | ----- | ----- |
| `Auth__Enabled` | API env | `true` |
| `Auth__TenantId` | API env | your tenant GUID |
| `Auth__Audience` | API env | `api://<app-client-id>` (or the GUID) |
| `VITE_AUTH_ENABLED` | web build arg | `true` |
| `VITE_AUTH_TENANT_ID` | web build arg | tenant GUID |
| `VITE_AUTH_CLIENT_ID` | web build arg | app client id |
| `VITE_API_AUDIENCE` | web build arg | `api://<app-client-id>` |

With auth **off**, the top-bar role switcher drives the view (demo). With auth
**on**, the signed-in user's Entra **app roles** decide access — the switcher is
only usable by a Platform Administrator (for support).

---

## 2. App roles to create (App registration → App roles)

Create these **`value`** strings (the display name/description is up to you).
There are two kinds:

### Permission roles (drive what a user can do)
| App role value | Grants |
| -------------- | ------ |
| `PlatformAdmin` | Full platform control |
| `PMO` | Portfolio governance |
| `ProjectManager` | Delivery / project management |
| `PMLead` | Same as Project Manager (leads a PM group) |
| `TeamMember` | Contributor |
| `Executive` | Read-only dashboards, approvals |
| `Stakeholder` | Only their own projects/demands |

### Manager identity roles (drive team roll-up — *and now also grant permissions*)
| App role value | Team roll-up | Permission level |
| -------------- | ------------ | ---------------- |
| `GlobalEngineeringManager` | Engineering | Team |
| `GlobalServiceManager` | Service | Team |
| `DevelopersManager` | Developers | Team |
| `InfrastructureManager` | Infrastructure | Team |
| `ChiefArchitect` | Architecture | PMO-level |

> **A manager needs only their manager role.** It now grants both the right
> permission level *and* the team-roll-up identity — you no longer have to also
> assign `TeamMember`. (`PMO` and `PMLead` already double as permission + manager
> identity.)

### Holding several roles
Entra allows multiple app-role assignments. When a user holds several, the
**most-privileged permission wins** (order: Admin → PMO → PM → PM Lead →
Executive → Team → Stakeholder), while the **manager identity is resolved
independently**. So *Platform Admin + Global Service Manager* → **admin
permissions and the Service team view** at the same time.

---

## 3. Microsoft Graph (Teams → directory sync)

The Teams admin screen's "Sync from Entra" reads groups + members via Graph. It
stays in manual-add mode until all three are set.

**Use the ATLAS PPM _API_ app registration — not the Web SPA.** Graph sync uses
the **client-credentials (app-only)** flow, which needs a **confidential client
with a client secret**. The Web registration is a public SPA and can't do this.

**Only the groups you ASSIGN to the Atlas Enterprise Application are synced** —
not the whole directory. So the sync stays small and fast, and *you* decide
what syncs by assigning groups (see step 4 below).

On the **API** registration:
1. **Certificates & secrets → New client secret** — copy the secret **Value**
   (not the Secret ID).
2. **API permissions → Microsoft Graph → Application permissions**, add these,
   then **Grant admin consent** (they must be **Application**, not Delegated):
   - **`Application.Read.All`** — lets Atlas read its own assigned groups.
   - **`GroupMember.Read.All`** — lets Atlas read those groups' members.
   - **`User.Read.All`** — lets Atlas read each member's **profile** (display
     name, email, job title). **Without it, Graph returns only the object id and
     members show as "(unknown)" in Teams / My Team.** If you've already synced
     once with names missing, just grant this and re-run "Sync now" — the sync
     upserts by object id, so it fills in the names without losing anything.
   - (Add **`Mail.Send`** too if you enable email notifications.)
3. **App roles → Create app role** — a *marker* role to tag groups for sync
   (it grants no Atlas permissions):
   - Display name **Atlas Team Group**, Allowed member types **Users/Groups**,
     Value **`AtlasTeamGroup`**, enabled.
4. **Enterprise Applications → Atlas → Users and groups → Add assignment** —
   assign each team group to the **Atlas Team Group** role. Those are the groups
   Atlas will sync (with their members).

Then set (the compose forwards these to the API container):

| `.env` key | Container setting | Value |
| ---------- | ----------------- | ----- |
| `GRAPH_TENANT_ID` | `Graph__TenantId` | tenant GUID |
| `GRAPH_CLIENT_ID` | `Graph__ClientId` | the **ATLAS PPM API** app (client) id |
| `GRAPH_CLIENT_SECRET` | `Graph__ClientSecret` | the client secret **Value** |
| `GRAPH_SYNC_APP_ROLE_ID` *(optional)* | `Graph__SyncAppRoleId` | the **Atlas Team Group** app-role id (GUID). Set it to sync *only* groups assigned to that role; leave empty to sync **all** groups assigned to the app |

> **`.env` alone is not enough unless the compose forwards it.** Docker Compose
> uses `.env` only to fill `${…}` placeholders in the compose file — it does not
> inject arbitrary vars into containers. The `api` service now maps
> `GRAPH_*` → `Graph__*`, so setting them in `.env` works. Restart with
> `docker compose up -d` to apply. In production, put `GRAPH_CLIENT_SECRET` in a
> Docker secret (see `docs/secrets.md`) rather than `.env`.

Common failures: permission added as **Delegated** not Application; **admin
consent** not granted; using the secret **ID** instead of its **Value**; an
**expired** secret.

Without these, the screen shows *"Microsoft Graph isn't configured — add groups
manually, or set Graph credentials to sync,"* and you map groups to manager
slots by hand.

---

## 4. Where to put the secrets
`Auth__*` and `VITE_AUTH_*` are non-secret (client/tenant ids, audience) and can
live in `.env`. The **`Graph__ClientSecret`** is a real secret — put it in a
Docker secret (see `docs/secrets.md`) or Azure Key Vault, not in `.env` or the
image.
