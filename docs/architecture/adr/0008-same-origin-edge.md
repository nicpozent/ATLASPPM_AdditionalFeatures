# ADR-0008 — Same-origin nginx edge with security headers

**Status:** Accepted

## Context
The SPA and API must be served securely to browsers. Cross-origin setups add CORS
complexity and preflight overhead, and security headers/CSP need a single, reliable
enforcement point.

## Decision
Serve the built SPA and reverse-proxy `/api` from a single **nginx** container so
the browser is **same-origin** in production (no CORS). nginx applies transport and
**security headers** (CSP, `X-Content-Type-Options`, frame-ancestors/deny, HSTS in
prod). TLS terminates at an ingress/LB in front (or by extending `deploy/nginx.conf`).
The API additionally enforces rate limiting and upload size limits.

## Consequences
- **+** No CORS in prod; one place for headers/CSP; smaller attack surface.
- **+** Static assets cacheable/CDN-friendly; API stays internal.
- **−** One more container and an nginx config to maintain.
- **−** Same-origin coupling means the edge must be part of every deployment
  (documented in DOCKER.md/SETUP.md).

## Alternatives considered
- **Separate API origin + CORS** — more moving parts, preflight cost, header
  duplication. Rejected for the standard single-site deployment.
