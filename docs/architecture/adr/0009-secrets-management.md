# ADR-0009 — Secrets via environment / Docker secrets, never in VCS

**Status:** Accepted

## Context
Atlas holds sensitive config: DB credentials, Entra client secrets, the Jira API
token, Graph credentials. None may be committed — especially now that the
repository is public.

## Decision
Follow **12-factor config**: all secrets come from **environment variables** or
**Docker secrets** (`docker-compose.secrets.yml` + `deploy/gen-secrets.sh`), read via
`IConfiguration`. `.env` and `secrets/` and dev certs (`deploy/certs/*.key|*.crt`)
are git-ignored; only `.env.example` and tooling are committed. A secret-rotation
age panel + alerts nudge periodic rotation.

## Consequences
- **+** No secrets in source or history; environment-specific injection.
- **+** Works identically for compose, managed Postgres, and orchestrators.
- **+** Public-repo-safe (verified: no `.env`/keys tracked).
- **−** Operators must provision secrets out-of-band (documented in secrets.md).
- **−** No built-in central vault; a vault (e.g. Key Vault) can front the env layer
  later without code change.

## Alternatives considered
- **Secrets in appsettings / committed files** — rejected outright.
- **Cloud vault as the only source** — good, but not assumed; the env/secret
  indirection lets a vault plug in when present.
