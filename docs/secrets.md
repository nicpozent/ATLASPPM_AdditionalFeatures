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

> **You don't have to change anything to keep running as you do today** — the
> base `docker-compose.yml` and its env-var approach still work. Docker secrets
> is an opt-in upgrade that moves the DB password out of environment variables
> (and out of `docker inspect`) into files mounted at `/run/secrets`. Atlas
> reads that directory automatically — a file named `ConnectionStrings__Postgres`
> maps to the config key `ConnectionStrings:Postgres`, so **no code change is
> needed**.

This repo ships the pieces so you don't hand-edit the base compose file:

- **`deploy/gen-secrets.sh`** — generates the two secret files (git-ignored, `chmod 600`).
- **`docker-compose.secrets.yml`** — an overlay applied only when you name it.

**Step by step:**

```bash
# 1. Generate the secret files. Reuse your CURRENT DB password if the atlas_db
#    volume already exists (see the gotcha below); otherwise omit the argument
#    to get a fresh strong password.
sh deploy/gen-secrets.sh 'YOUR_CURRENT_DB_PASSWORD'
#    → writes secrets/db_password.txt and secrets/pg_conn.txt

# 2. Start the stack WITH the overlay (order matters — overlay comes last):
docker compose -f docker-compose.yml -f docker-compose.secrets.yml up --build -d

# 3. Verify the API connected, and that the password is NOT in the env:
docker compose -f docker-compose.yml -f docker-compose.secrets.yml logs api | grep -i "migrations applied\|ready"
docker inspect "$(docker compose -f docker-compose.yml -f docker-compose.secrets.yml ps -q api)" \
  --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -i postgres
#    → shows ConnectionStrings__Postgres= (empty); the real value lives only in the secret file
```

Your everyday `docker compose up` (without `-f …secrets.yml`) still runs the old
way, so this changes nothing until you choose it.

> **⚠️ Gotcha — Postgres only sets its password on first init.** If the
> `atlas_db` volume already exists, it keeps the password it was created with;
> pointing a new one at it via the file won't change it, and the API will fail
> auth. So either **reuse the existing password** in the secret files
> (recommended — you're just moving *where* it's read from), start fresh with
> `docker compose down -v` (⚠️ deletes DB data), or rotate the role in place:
> `docker compose exec db psql -U atlas -c "ALTER USER atlas PASSWORD '<new>';"`

Override the mount directory with `Secrets:Directory` (env `Secrets__Directory`)
if you mount elsewhere.

### Running Postgres under a domain account?
This comes up, so to be clear about what applies here:

- **Postgres as a Windows *service* under a domain account** (`services.msc` →
  the PostgreSQL service → **Log On** tab → *This account* → `DOMAIN\svc-…`)
  is a **native-Windows** concept. It does **not** apply to this deployment:
  your Postgres runs inside a **Linux container** as the container's `postgres`
  user — there is no Windows service to reconfigure. It also wouldn't change how
  Atlas authenticates (the app still uses a Postgres role + password).
- **Authenticating with a domain identity (passwordless)** is the goal that
  actually removes the password. Postgres supports it via **Kerberos/GSSAPI**,
  and **Azure Database for PostgreSQL supports Microsoft Entra auth**. For the
  Windows-Docker-now → Azure-later path, the clean win is **Entra passwordless
  auth after the Azure move** (below) — no domain service account needed, and it
  fits the Linux container (unlike gMSA).

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
- **Rotate** the DB password and any Graph client secret periodically. Atlas
  tracks the database password's age under **Administration → Backups** (the
  "Database password rotation" card) — it shows days since the last rotation,
  warns at 90 days and flags "Change it now!" at 180, and an admin records each
  rotation with **Mark as rotated today**.
- Prefer a **strong, unique** Postgres password in every non-local environment
  (the `atlas`/`atlas` default is for local dev only).

---

## Changing / rotating the database password

Because Postgres only sets its password on **first initialisation** of the data
volume, changing the password is always two moves: **update the credential the
app uses**, and **change the role's password in the database itself**. Then
record it in the app so the rotation clock resets.

### If you deploy with environment variables (base compose)

```bash
# 1. Change the password on the running database role:
docker compose exec db psql -U atlas -c "ALTER USER atlas PASSWORD 'NEW_STRONG_PASSWORD';"

# 2. Update the app's copy — set POSTGRES_PASSWORD in your .env (git-ignored):
#    POSTGRES_PASSWORD=NEW_STRONG_PASSWORD

# 3. Recreate the api container so it picks up the new value:
docker compose up -d
```

### If you deploy with Docker secrets (overlay)

```bash
# 1. Regenerate the secret files with the new password:
sh deploy/gen-secrets.sh 'NEW_STRONG_PASSWORD'

# 2. Change it on the database role:
docker compose -f docker-compose.yml -f docker-compose.secrets.yml \
  exec db psql -U atlas -c "ALTER USER atlas PASSWORD 'NEW_STRONG_PASSWORD';"

# 3. Restart with the overlay so the new secret is mounted:
docker compose -f docker-compose.yml -f docker-compose.secrets.yml up -d
```

### Then record it (resets the age clock)
In **Administration → Backups → Database password rotation**, click
**Mark as rotated today**. The age counter (which starts at first deploy) resets,
and the 90-day / 180-day alerts re-arm from that date.

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
