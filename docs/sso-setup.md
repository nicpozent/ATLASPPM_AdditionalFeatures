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
stays in manual-add mode until all three are set:

| Setting | Value |
| ------- | ----- |
| `Graph__TenantId` | tenant GUID |
| `Graph__ClientId` | app registration client id |
| `Graph__ClientSecret` | client secret (store as a Docker/Key Vault secret, not in `.env`) |

**Graph application permission required:** `GroupMember.Read.All` (with **admin
consent**). If you also enable email notifications, add `Mail.Send`. Atlas uses
the client-credentials flow, so these are *application* permissions, not
delegated.

Without these, the screen shows *"Microsoft Graph isn't configured — add groups
manually, or set Graph credentials to sync,"* and you map groups to manager
slots by hand.

---

## 4. Where to put the secrets
`Auth__*` and `VITE_AUTH_*` are non-secret (client/tenant ids, audience) and can
live in `.env`. The **`Graph__ClientSecret`** is a real secret — put it in a
Docker secret (see `docs/secrets.md`) or Azure Key Vault, not in `.env` or the
image.
