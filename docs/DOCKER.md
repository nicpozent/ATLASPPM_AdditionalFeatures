# Running Atlas PPM with Docker Compose

This composes the whole solution: the **frontend** (nginx-served SPA), the
**.NET API** (`server/`), and **PostgreSQL**. nginx serves the SPA and
reverse-proxies `/api/*` to the API (same-origin, no CORS); the API talks to
Postgres. The API applies EF Core migrations and seeds demo data on startup.

```
┌──────────────────── docker network ────────────────────┐
│  web (nginx :443 TLS, :80→443)                          │
│    /            → static SPA (dist/)                    │
│    /api/v1/...  → proxy → api:8080                       │
│  api (.NET :8080)  ── EF Core ──►  db (PostgreSQL :5432) │
└─────────────────────────────────────────────────────────┘
        ▲ published on host :${HTTPS_PORT:-443}         ▲ volume: atlas_db
```

## Prerequisites

- Docker + Docker Compose v2.
- A **TLS certificate** at `deploy/certs/atlas.crt` + `atlas.key` (nginx
  terminates HTTPS; Entra only accepts HTTPS redirect URIs off localhost).
  For local use, generate a self-signed one: `sh deploy/gen-dev-cert.sh`.

## Configure

```bash
cp .env.example .env
sh deploy/gen-dev-cert.sh          # self-signed localhost cert (or drop in your real cert)
```

| Variable | Purpose |
|----------|---------|
| `VITE_AUTH_ENABLED` | `true` to require Entra sign-in (frontend gate **and** API validation) |
| `VITE_AUTH_TENANT_ID` / `VITE_AUTH_CLIENT_ID` | from the **Atlas PPM Web** app registration (+ tenant) |
| `VITE_API_AUDIENCE` | Application ID URI of the **Atlas PPM API** app registration |
| `HTTPS_PORT` / `HTTP_PORT` | host ports (default `443` / `80`; HTTP redirects to HTTPS) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | database credentials (used by both `db` and the API connection string) |

> `VITE_*` are **build-time** values (Vite bakes them into the bundle), so after
> changing them rebuild the web image: `docker compose build web`.
> `Auth__*` are passed to the API at runtime for token validation.

## Run

**Whole stack (default):**

```bash
docker compose up --build -d
# open https://localhost  — screens populate from the seeded database
```

On first start the API waits for Postgres to be healthy and runs migrations.
It starts **empty** by default — screens show empty states and fill as you
create real data. (A self-signed cert triggers a browser warning locally.)

### Demo data (optional)

To preload the demo portfolio (e.g. for a walkthrough), set `SEED_DEMO_DATA=true`
and start against a **fresh** database. If the DB was already seeded and you want
it clean, reset the volume (this deletes all data):

```bash
docker compose down -v      # removes the atlas_db volume
docker compose up --build -d
```

**Frontend only (no data, for a quick UI look):**

```bash
docker compose up --build web
# /api returns 502; the SPA shows its empty states
```

- With **auth enabled**, you'll hit the branded sign-in gate first. Register the
  site origin (e.g. `https://localhost`) as a **SPA** redirect URI on the
  Atlas PPM Web app registration, and make sure the API audience matches.

## Composition recipes (base + hardening overlays)

The base `docker-compose.yml` runs the full app with a password-authenticated
database — fine for dev. Each hardening concern is an **opt-in overlay** you add
with `-f`; the base file is never edited. Overlays compose, with one exception
(the two DB-credential overlays are alternatives — pick one).

| Overlay | What it does | One-time prep |
|---------|--------------|---------------|
| `docker-compose.secrets.yml` | DB password via `/run/secrets` file, not env | `sh deploy/gen-secrets.sh` |
| `docker-compose.pgcert.yml` | **Passwordless** DB via TLS client-cert (no password at all) | generate certs — see below |
| `docker-compose.personnel.yml` | AES-256-GCM key for the DPIA-gated SWOT / dev-plan notes | create `secrets/personnel_key.txt` |
| `docker-compose.openbao.yml` | On-prem OpenBao/Vault feeding secrets to the API | seed `bao kv put` after up |

> Don't combine `secrets.yml` **and** `pgcert.yml`: the cert overlay removes the
> password entirely, so the password-file overlay is redundant.

### Recommended lean production stack (no HSM required)

Passwordless Postgres + encrypted personnel notes. This is the stack most sites
should run.

**1. Enable SSO** (edit `.env`; `VITE_*` are baked into the bundle at build time):

```dotenv
VITE_AUTH_ENABLED=true
VITE_AUTH_TENANT_ID=<entra-tenant-guid>
VITE_AUTH_CLIENT_ID=<web-SPA-app-registration-guid>
VITE_API_AUDIENCE=api://atlas-ppm     # or the API app GUID for a single-app setup
```

Compose forwards the matching `Auth__*` values to the API automatically, so the
API validates the same tokens. (Full walkthrough: `docs/sso-setup.md`.)

**2. Generate the Postgres client-auth certs** into `deploy/pgcerts/`:

```bash
sh deploy/gen-pg-cert.sh db atlas
```

On **Windows** (no local OpenSSL), generate them in a throwaway container:

```powershell
docker run --rm -v "${PWD}:/repo" -w /repo alpine `
  sh -c "apk add --no-cache openssl >/dev/null && sh deploy/gen-pg-cert.sh db atlas"
```

> These go in `deploy/pgcerts/` — **not** `deploy/certs/` (that folder holds the
> separate nginx web-TLS cert). The overlay copies the certs into the `db`
> container and sets `server.key` to `600` at startup, so key permissions work
> the same on Linux, macOS and Windows. Details + verification:
> `docs/postgres-cert-auth.md`.

**3. Create the personnel-notes encryption key**:

```bash
openssl rand -base64 32 | tr -d '\n' > secrets/personnel_key.txt
```

Windows PowerShell:

```powershell
docker run --rm alpine sh -c "apk add --no-cache openssl >/dev/null && openssl rand -base64 32 | tr -d '\n'" > secrets\personnel_key.txt
```

**4. Bring the stack up** (overlays named after the base so they win):

```bash
docker compose -f docker-compose.yml -f docker-compose.pgcert.yml -f docker-compose.personnel.yml up --build -d
```

Windows PowerShell is identical, or use `COMPOSE_FILE` (note the `;` separator on
Windows, `:` on Linux/macOS):

```powershell
$env:COMPOSE_FILE = "docker-compose.yml;docker-compose.pgcert.yml;docker-compose.personnel.yml"
docker compose up --build -d
```

**5. Verify each layer:**

```bash
# DB up over TLS with a client cert (no password):
docker compose exec db psql -U atlas -d atlas \
  -c "select usename, ssl, client_dn from pg_stat_ssl join pg_stat_activity using (pid) where usename='atlas';"
#   → ssl = t, client_dn = /CN=atlas

# Personnel key mounted as a FILE (not leaking as an env var):
api=$(docker compose ps -q api)
docker exec "$api" ls -l /run/secrets/Personnel__EncryptionKey     # present, ~44 bytes
docker inspect "$api" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -i personnel   # no output = good
```

To confirm the personnel notes are actually **encrypted at rest**: turn the
feature on (Integrations → Governance → personnel-data processing, or
`insert into "Settings" ("Key","Value") values ('personnel.assessmentsEnabled','true')`),
save a Team SWOT note, then check the stored value — it should start with
`enc:v1:` (ciphertext), not `{` (plaintext). See `docs/secrets.md`.

> **Windows/PowerShell quoting tip:** `docker compose exec db psql … -c "select ""X"" …"`
> strips the quotes and Postgres lowercases the identifier. Use an interactive
> shell (`docker compose exec db psql -U atlas -d atlas`) or pipe a here-string.

### First-boot gotcha (all DB-credential overlays)

Postgres only applies `POSTGRES_PASSWORD` / initialises credentials on the
**first** creation of the `atlas_db` volume. If you switch credential approach
after the volume exists, either `docker compose down -v` (wipes data — dev only)
or reconcile the role manually. Migrations run automatically on API boot, so
there's no separate migration step.

## Production notes

- Change `POSTGRES_PASSWORD` (and ideally the user/db) from the defaults; use a
  secrets mechanism rather than committing real values.
- The `atlas_db` named volume holds the database — back it up; don't delete it.
- Terminate TLS at an ingress/load balancer in front of `web`, or extend
  `deploy/nginx.conf`.
- Seeding only runs when the DB is empty (idempotent), so restarts are safe.

## The API (`server/`)

.NET 10 minimal API + EF Core (Npgsql). Implements the `/api/v1` surface the
frontend calls; entities are projected to the exact DTOs the client expects.
Auth is off unless `Auth__Enabled=true`, matching the frontend. See
`server/` for the domain model, endpoints and seed data.
