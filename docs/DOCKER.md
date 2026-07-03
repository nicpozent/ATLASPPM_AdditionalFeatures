# Running Atlas PPM with Docker Compose

This composes the **frontend** (this repo, built and served by nginx) with the
**API** (the separate .NET backend). nginx serves the SPA and reverse-proxies
`/api/*` to the backend, so the app is same-origin — no CORS.

```
┌─────────────── docker network ───────────────┐
│  web (nginx :80)                              │
│    /            → static SPA (dist/)          │
│    /api/v1/...  → proxy → api:8080            │
│  api (.NET Kestrel :8080)                     │
└───────────────────────────────────────────────┘
        ▲ published on host :${WEB_PORT:-8080}
```

## Prerequisites

- Docker + Docker Compose v2.
- A backend image, because the .NET API is in a **different repo**. Either:
  - **A —** a prebuilt image, referenced by `ATLAS_API_IMAGE`, or
  - **B —** a local checkout: in `docker-compose.yml`, comment out the `api`
    service's `image:` and uncomment `build: ../atlas-ppm-api`.

## Configure

Copy the env template and fill it in (all optional for a no-auth demo):

```bash
cp .env.example .env
```

| Variable | Purpose |
|----------|---------|
| `VITE_AUTH_ENABLED` | `true` to require Entra sign-in (baked at build time) |
| `VITE_AUTH_TENANT_ID` / `VITE_AUTH_CLIENT_ID` | from the **Atlas PPM Web** app registration (+ tenant) |
| `VITE_API_AUDIENCE` | Application ID URI of the **Atlas PPM API** app registration |
| `ATLAS_API_IMAGE` | backend image for the `api` service |
| `WEB_PORT` | host port for the frontend (default `8080`) |

> `VITE_*` are **build-time** values (Vite bakes them into the bundle), so after
> changing them you must rebuild: `docker compose build web`.

## Run

```bash
docker compose up --build          # build the frontend image + start both services
# open http://localhost:8080
```

- With **no API image available**, the `api` service won't start and `/api`
  calls return 502 — but the frontend still loads and shows its empty states
  (by design), so you can review the UI standalone.
- With **auth enabled**, you'll hit the branded sign-in gate first. Register the
  site origin (e.g. `http://localhost:8080`) as a **SPA** redirect URI on the
  Atlas PPM Web app registration.

## Notes

- The frontend image is a static nginx build — no Node.js at runtime.
- Fingerprinted assets under `/assets/` are long-cached; `index.html` is
  `no-cache` so new deploys are picked up immediately.
- To serve behind TLS/a real hostname, terminate TLS at an ingress/load
  balancer in front of the `web` service, or extend `deploy/nginx.conf`.
