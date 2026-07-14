# ADR-0067 — OpenBao / Vault secrets provider (on-prem)

**Status:** Accepted

## Context

Secrets today are layered on the .NET configuration stack (ADR-0009): file-
mounted `/run/secrets` (KeyPerFile) with an optional Azure Key Vault provider
(ADR-0009 / `docs/secrets.md`). The deployment target is on-prem single-node
Docker (ADR-0054), where Azure Key Vault isn't a fit. Teams that already run a
central secrets manager wanted an on-prem, cloud-neutral option that also gives
audited, centralized secret access and a path to automated rotation — the two
things Docker file-secrets alone don't provide (rotation is manual today, via
the Admin card).

## Options

1. **Do nothing** — keep file-secrets + (deferred) Key Vault. On-prem stays
   manual-rotation only.
2. **HashiCorp Vault** — the incumbent, but BSL-licensed since 2023.
3. **OpenBao** — the Linux Foundation's MPL-2.0 fork of Vault, API-compatible.

## Decision

Add an **OpenBao/Vault KV v2 configuration provider** as one more layer in the
existing secret seam (`Secrets.AddAtlasSecrets`), and ship a ready-to-run
`docker-compose.openbao.yml` overlay. Because OpenBao is API-compatible with
Vault, the single provider serves both.

- **Inert unless configured** — active only when `Bao:Address` **and** a token
  are set, mirroring the Key Vault switch. The token itself can be delivered by
  the file-secrets layer (`Bao__Token`), so it never has to sit in an env var.
- **Read path** — `GET {Address}/v1/{Mount}/data/{Path}` with `X-Vault-Token`;
  each KV key maps to a config key with `__` → `:` (identical to KeyPerFile /
  Key Vault), so `ConnectionStrings__Postgres` → `ConnectionStrings:Postgres`.
- **Added after the default + file layers**, so a vaulted secret wins over
  appsettings/env, and precedence stays predictable: Key Vault > OpenBao >
  file-secrets > env > appsettings.
- **Non-fatal** — a read failure is logged and boot continues on the lower
  layers, so an unreachable/sealed vault never wedges startup.
- **No new dependency** — implemented over `HttpClient` (the KV v2 read is a
  single authenticated GET); the pure response→config mapping is unit-tested.

The compose overlay runs OpenBao in **dev mode** for a one-command trial;
production is expected to use a real storage backend (file/raft), TLS and a
proper unseal/token flow (documented, not scripted).

## Consequences

- On-prem deployments get centralized, audited secrets and a foundation for
  **dynamic DB credentials / automated rotation** (a future ADR can wire the
  database secrets engine, closing the manual-rotation gap).
- One more optional moving part to operate (the vault itself, its unseal keys).
  It stays **opt-in**; the default single-node story is unchanged.
- The live read path can't be exercised in CI (no vault there); it's guarded and
  the mapping is unit-covered. First real use should be smoke-tested against a
  running OpenBao.
