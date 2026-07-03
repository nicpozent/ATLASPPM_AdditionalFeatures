# Atlas PPM — Production Setup

Everything the code can't decide for you: the two Entra app registrations, the
environment values, and secrets. Code changes are **not** needed — this is
configuration only.

## 1. Microsoft Entra ID — two app registrations

Atlas is a SPA that calls a protected API, so it needs two registrations in the
same tenant.

### A. Atlas PPM API (the backend)
1. **App registrations → New registration** → name `Atlas PPM API`.
2. **Expose an API → Add a scope**: set the Application ID URI (e.g.
   `api://atlas-ppm`) and add a scope such as `access_as_user`.
3. Note the **Application ID URI** — this is `VITE_API_AUDIENCE` / `Auth__Audience`.

### B. Atlas PPM Web (the frontend SPA)
1. **New registration** → name `Atlas PPM Web`.
2. **Authentication → Add a platform → Single-page application**, and add the
   redirect URIs (the site origin — **HTTPS**), e.g. `https://atlas.yourco.com`
   and `https://localhost` for local Docker. (Entra only accepts HTTPS redirect
   URIs off `localhost`, which is why the stack terminates TLS — see step 3.)
3. **API permissions → Add a permission → My APIs → Atlas PPM API →** the
   `access_as_user` scope. **Grant admin consent.**
4. Note the **Application (client) ID** — this is `VITE_AUTH_CLIENT_ID`.

Both share the **Directory (tenant) ID** — this is `VITE_AUTH_TENANT_ID` /
`Auth__TenantId`.

> SPAs use PKCE and have **no client secret**. The API validates tokens using
> Entra's public keys, so it needs no secret either. The only real secret in
> this stack is the database password.

## 2. Environment (`.env`)

```bash
cp .env.example .env
```

| Variable | Value | Secret? |
|----------|-------|---------|
| `VITE_AUTH_ENABLED` | `true` | no |
| `VITE_AUTH_TENANT_ID` | Directory (tenant) ID | no |
| `VITE_AUTH_CLIENT_ID` | **Atlas PPM Web** client ID | no |
| `VITE_API_AUDIENCE` | **Atlas PPM API** Application ID URI (`api://atlas-ppm`) | no |
| `HTTPS_PORT` / `HTTP_PORT` | published host ports (default `443` / `80`) | no |
| `POSTGRES_USER` / `POSTGRES_DB` | database name/user | no |
| `POSTGRES_PASSWORD` | **change from the default** | **yes** |

### TLS certificate (required)

nginx terminates HTTPS with a bring-your-own cert at `deploy/certs/atlas.crt` +
`atlas.key` (git-ignored). For now, generate a self-signed `localhost` cert:

```bash
sh deploy/gen-dev-cert.sh
```

When your domain's A record is ready, replace those two files with your real
certificate (same filenames), reissue for the hostname, and add
`https://<your-domain>` as a SPA redirect URI in Entra.

`VITE_*` are baked into the frontend bundle at build time (public values only —
never put a secret in a `VITE_*` var). `Auth__*` and `ConnectionStrings__Postgres`
are read by the API at runtime; compose derives them from the same `.env`.

## 3. Bring it up

```bash
docker compose up --build -d
# → https://localhost   (self-signed cert warns locally; expected)
```

On first start the API waits for Postgres, applies migrations, and seeds the
demo portfolio. With `VITE_AUTH_ENABLED=true` you'll get the sign-in gate; the
API rejects any request without a valid Entra token.

## 4. Smoke test

1. Sign in with a tenant account — you should land on the dashboard with data.
2. Create a demand (Demand Pipeline → New demand) — it should persist after a
   full page reload (it's stored in Postgres, not the browser).
3. `docker compose logs api` should show the migration + seed on first run only.

## 5. Production hardening checklist

- [ ] `POSTGRES_PASSWORD` changed from `atlas`; ideally injected via a secrets
      manager, not committed.
- [ ] TLS terminated at an ingress/load balancer in front of the `web` service
      (or extend `deploy/nginx.conf`); use HTTPS redirect URIs in Entra.
- [ ] Back up the `atlas_db` volume (or use a managed Postgres and point
      `ConnectionStrings__Postgres` at it).
- [ ] Conditional Access / MFA enforced on the Atlas PPM Web app as needed.
- [ ] If the API misconfigures auth (enabled but no tenant/audience) it now
      **fails to start** by design — check `docker compose logs api`.

## 6. Not-yet-done (known scope)

- The API is read-focused plus create endpoints for demands, blockers,
  projects, programs and objectives (wired into the Demand and Blocker UIs).
  Broader edit/delete flows and the remaining screens' writes are future work.
- Seed data is the demo portfolio; it only loads into an empty database.
