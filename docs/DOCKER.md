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

## Production notes

- Change `POSTGRES_PASSWORD` (and ideally the user/db) from the defaults; use a
  secrets mechanism rather than committing real values.
- The `atlas_db` named volume holds the database — back it up; don't delete it.
- Terminate TLS at an ingress/load balancer in front of `web`, or extend
  `deploy/nginx.conf`.
- Seeding only runs when the DB is empty (idempotent), so restarts are safe.

## The API (`server/`)

.NET 8 minimal API + EF Core (Npgsql). Implements the `/api/v1` surface the
frontend calls; entities are projected to the exact DTOs the client expects.
Auth is off unless `Auth__Enabled=true`, matching the frontend. See
`server/` for the domain model, endpoints and seed data.
