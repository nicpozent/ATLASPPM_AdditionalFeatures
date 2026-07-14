# ADR-0069 — Passwordless Postgres via TLS client-certificate auth

**Status:** Accepted

## Context

The database connection string is the single biggest secret Atlas holds. We
already layer secret *storage* (file-secrets, optional Key Vault / OpenBao —
ADR-0009/0067) and can encrypt sensitive columns (ADR-0068), but the DB password
still exists and must be protected, rotated and vaulted. On the on-prem target
(no HSM, no cloud KMS) the strongest move is to **not have a password at all**:
authenticate the app to Postgres with a client certificate.

## Decision

Support **TLS client-certificate (mutual-TLS) auth** to Postgres as an opt-in
overlay, with **no application code change** — Npgsql takes the client cert/key +
CA via connection-string keywords, and the string carries no `Password=`.

- `pg_hba.conf` TCP rule `hostssl … cert clientcert=verify-full`: every network
  login must present a cert signed by the server CA whose **CN equals the DB
  role**. No password path over TCP.
- `deploy/gen-pg-cert.sh` mints a dev CA + server cert (SAN = DB host) + client
  cert (CN = role), and sets each private key's mode/owner so the shipped
  containers can read it (server.key → uid 70; client.key → uid 1654).
- `docker-compose.pgcert.yml` turns on TLS + the cert `pg_hba`, mounts the certs,
  and sets the passwordless connection string for api/worker.
- Step-by-step runbook + the file-permission gotcha in `docs/postgres-cert-auth.md`.

Verified end-to-end against a real Postgres 16: a passwordless client-cert
connection succeeds over TLS (`current_user=atlas`, `ssl=true`); a connection with
no client cert, or a password without a cert, is rejected
("connection requires a valid client certificate").

## Alternatives

- **Password in a vault (OpenBao) or Docker secret** — still a password to hold
  and rotate; strictly weaker than removing it. Kept as the option when cert
  infra isn't available.
- **SCRAM with a strong password** — fine, but doesn't remove the secret.
- **Cloud Managed-Identity passwordless** — not applicable on-prem.

## Consequences

- The DB password stops being a secret to manage; auth becomes "hold a client
  cert signed by our CA." Fewer secrets, no DB-password rotation chore.
- New operational item: **certificate lifecycle** (issue, distribute, renew before
  expiry) and correct **key file permissions** per container user — documented,
  and the only part that must be validated per-environment.
- Pairs with disk encryption + `postgres-least-privilege.sql` + ADR-0068 field
  encryption for a defence-in-depth on-prem posture with **no HSM required**.
