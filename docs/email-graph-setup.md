# Enabling notification email (Microsoft Graph)

Atlas sends notification email (demand alerts, over-allocation, "contact the PMO")
through **Microsoft Graph** using an **application (app-only) `Mail.Send`
permission** — not SMTP with a stored mailbox password. This is the more secure
path: no mailbox credential, a send-only permission, restrictable to specific
mailboxes, and revocable without changing anyone's password.

Until this is configured, notifications still appear **in-app**; only the email
channel is skipped. Nothing breaks before setup.

---

## 1. Prerequisites

- The Atlas **Entra app registration** (the one used for SSO, or a dedicated app).
  You need its **Application (client) ID** and **Directory (tenant) ID**, plus a
  **client secret or certificate**.
- A **sender mailbox** — the licensed mailbox mail is sent *from*
  (e.g. `atlas-noreply@yourco.com`).
- Roles to perform the steps: **Application Administrator / Global Administrator**
  (to grant + consent the Graph permission) and **Exchange Administrator**
  (to scope the sender mailbox).
- PowerShell modules: `Microsoft.Graph` and `ExchangeOnlineManagement`
  (`Install-Module Microsoft.Graph, ExchangeOnlineManagement -Scope CurrentUser`).

---

## 2. Grant + consent the `Mail.Send` application permission

`Mail.Send` as an **Application** permission lets the app send as a mailbox
without a signed-in user. It requires **admin consent**.

### Option A — Portal
1. **Entra admin center → App registrations →** *your Atlas app* **→ API permissions**.
2. **Add a permission → Microsoft Graph → Application permissions →** search
   **`Mail.Send`** → **Add permissions**.
3. Click **Grant admin consent for &lt;tenant&gt;** and confirm. `Mail.Send` should
   show **Granted**.

### Option B — PowerShell (Microsoft.Graph)
```powershell
Connect-MgGraph -Scopes "Application.ReadWrite.All","AppRoleAssignment.ReadWrite.All"

# The Microsoft Graph resource service principal (fixed appId) and its Mail.Send app role.
$graph    = Get-MgServicePrincipal -Filter "appId eq '00000003-0000-0000-c000-000000000000'"
$mailSend = $graph.AppRoles | Where-Object { $_.Value -eq 'Mail.Send' -and $_.AllowedMemberTypes -contains 'Application' }

# Your Atlas app's service principal (enterprise app), by its client (app) id.
$sp = Get-MgServicePrincipal -Filter "appId eq '<YOUR-APP-CLIENT-ID>'"

# Assign (grant + consent) the app role to the app.
New-MgServicePrincipalAppRoleAssignment `
  -ServicePrincipalId $sp.Id `
  -PrincipalId       $sp.Id `
  -ResourceId        $graph.Id `
  -AppRoleId         $mailSend.Id
```

Verify:
```powershell
Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $sp.Id |
  Where-Object ResourceId -eq $graph.Id
```

---

## 3. Restrict which mailboxes the app may send as (recommended)

By default, app-only `Mail.Send` can send as **any** mailbox in the tenant. Lock it
to just the Atlas sender(s) with an **Application Access Policy** (Exchange Online).

```powershell
Connect-ExchangeOnline

# A mail-enabled security group whose members are the mailboxes Atlas may send as.
New-DistributionGroup -Name "Atlas Senders" `
  -Alias "atlas-senders" `
  -PrimarySmtpAddress "atlas-senders@yourco.com" `
  -Type Security
Add-DistributionGroupMember -Identity "atlas-senders@yourco.com" -Member "atlas-noreply@yourco.com"

# Restrict the app to only send as members of that group.
New-ApplicationAccessPolicy `
  -AppId "<YOUR-APP-CLIENT-ID>" `
  -PolicyScopeGroupId "atlas-senders@yourco.com" `
  -AccessRight RestrictAccess `
  -Description "Restrict Atlas to its sender mailbox"

# Confirm the sender is allowed and a random mailbox is denied.
Test-ApplicationAccessPolicy -Identity "atlas-noreply@yourco.com" -AppId "<YOUR-APP-CLIENT-ID>"
Test-ApplicationAccessPolicy -Identity "someone-else@yourco.com"  -AppId "<YOUR-APP-CLIENT-ID>"
```
Policy changes can take up to ~30 minutes to propagate.

---

## 4. Configure Atlas

Set these on the **API** (env vars use `__` for the `:` separator, or place them in
`appsettings`/Docker secrets):

| Config key | Env var | Purpose |
|---|---|---|
| `Graph:TenantId` | `Graph__TenantId` | Directory (tenant) ID |
| `Graph:ClientId` | `Graph__ClientId` | Atlas app (client) ID |
| `Graph:ClientSecret` | `Graph__ClientSecret` | App client secret (or configure a certificate) |
| `Notifications:SenderUpn` | `Notifications__SenderUpn` | Sender mailbox UPN (must be in the access-policy group above) |
| `Notifications:SupportMailbox` | `Notifications__SupportMailbox` | Optional — mailbox for "Contact the PMO" (defaults to the sender) |

Restart the API so it picks up the config.

---

## 5. Verify

1. In Atlas, trigger something that emails — e.g. **create a demand** (alerts the
   leadership roles) or use **Help → Contact the PMO**.
2. Confirm the message arrives from the sender mailbox with the `[Atlas]` subject
   prefix.
3. Check the API logs: a success logs `Notification email sent to N recipient(s)`;
   a misconfiguration logs a warning with the Graph status/detail (in-app delivery
   still succeeds regardless).

---

## 6. Troubleshooting

| Symptom (API log) | Cause | Fix |
|---|---|---|
| `Graph Mail.Send not configured` (Debug) | `Graph:*` / `Notifications:SenderUpn` unset | Complete step 4 |
| Graph returns **403** `ErrorAccessDenied` | Admin consent not granted, or the sender isn't allowed by the Application Access Policy | Re-check step 2 consent; confirm the sender is in the access-policy group (step 3) |
| Graph returns **404** `ErrorInvalidUser`/unknown sender | `Notifications:SenderUpn` isn't a real, licensed mailbox | Use a valid licensed mailbox UPN |
| Sends worked, then 403 after adding a policy | Access-policy propagation delay | Wait ~30 min; verify with `Test-ApplicationAccessPolicy` |
| Role email reaches no one, in-app is fine | Directory not synced / groups not mapped to roles | Sync the directory and map groups → roles in **Admin → Teams** (per-role email resolves recipients from that mapping) |

---

_See also: in-app **Admin → Help → "Enable notification email"**, and ADR-0045
(per-role demand email)._
