# Secrets management

Atlas reads its secrets (the Postgres connection string, and any Graph client
secret when notifications/SSO are enabled) through the standard .NET
configuration stack, with two extra providers layered on top so **secrets never
have to live in `appsettings.json` or an image layer**:

1. **File-mounted secrets** (Docker/Kubernetes) — read from `/run/secrets`.
2. **Azure Key Vault** — optional, passwordless via Managed Identity.

Both are **inert until configured**, so nothing changes until you opt in. A
configured secret store takes precedence over `appsettings.json` and
environment variables.

> **Azure Key Vault is deferred for now** — this layer just makes the eventual
> switch a single setting. See the roadmap at the end.

---

## Now — Windows Docker (Linux container)

### Why not gMSA?
gMSA (group Managed Service Account) is **Windows-only**: it needs the process
to run under an AD machine identity on a Windows host. Atlas ships as a **Linux
container** talking to **Postgres**, so gMSA doesn't apply here — even on a
Windows Docker host, the container itself is Linux. Use Docker secrets instead
(below); gMSA only becomes relevant if you ever run the app as a native Windows
service against SQL Server.

### Option A — Docker secrets (recommended)
Mount each secret as a file; Atlas reads `/run/secrets` automatically. A file
named with `__` maps to a config section — e.g. `ConnectionStrings__Postgres`
becomes `ConnectionStrings:Postgres`.

`docker-compose.yml`:

```yaml
services:
  api:
    # …
    secrets:
      - ConnectionStrings__Postgres
    # do NOT also set the ConnectionStrings__Postgres env var — the file wins,
    # but keeping the plaintext out of the environment is the point.

secrets:
  ConnectionStrings__Postgres:
    file: ./secrets/postgres-connection-string.txt   # git-ignored, perms 600
```

The file's *contents* are the full connection string, e.g.
`Host=db;Port=5432;Database=atlas;Username=atlas;Password=<strong-password>`.

Override the directory with `Secrets:Directory` (env `Secrets__Directory`) if
you mount elsewhere.

### Option B — environment variables (baseline)
If you're not using Docker secrets yet, inject secrets as env vars from your
platform rather than committing them:

```
ConnectionStrings__Postgres=Host=db;...;Password=<strong-password>
```

The repo's `docker-compose.yml` already interpolates `${POSTGRES_PASSWORD}` from
the host environment, and `appsettings.json` only carries the throwaway local
dev password.

### Interim hygiene (do these regardless)
- **Never commit real secrets.** Keep `secrets/` and `.env` git-ignored.
- **Lock file permissions** — `chmod 600`, owned by the service user.
- **Rotate** the DB password and any Graph client secret periodically.
- Prefer a **strong, unique** Postgres password in every non-local environment
  (the `atlas`/`atlas` default is for local dev only).

---

## Later — Azure (containers + Azure Database for PostgreSQL)

When you move to Azure, two upgrades make most stored secrets disappear:

### 1. Passwordless database auth (best)
Azure Database for PostgreSQL supports **Microsoft Entra authentication**. Give
the app a **Managed Identity**, grant it a Postgres role, and the connection
string carries **no password at all** — Azure issues short-lived tokens. This is
strictly better than vaulting a password because there's no password to vault.

### 2. Azure Key Vault (for the secrets that remain)
For anything still secret (e.g. a Graph client secret), set one value:

```
KeyVault__Uri=https://<your-vault>.vault.azure.net/
```

Atlas then pulls secrets with `DefaultAzureCredential` — i.e. the app's Managed
Identity in Azure, so there's **no client secret to store to reach the vault**.
Secret names use `--` for section nesting (Key Vault doesn't allow `:`), e.g.
`ConnectionStrings--Postgres`.

No code change is needed — the provider is already wired and switches on the
moment `KeyVault:Uri` is set.

---

## Precedence (highest wins)

```
Azure Key Vault  >  /run/secrets (KeyPerFile)  >  environment variables  >  appsettings.{env}.json  >  appsettings.json
```
