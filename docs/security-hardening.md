# Database security hardening

Practical controls to reduce what an attacker who reaches the environment can do
to the database. Most of these live in **deployment/DB configuration**, not the
application — this page says what to turn on and how. See also `docs/secrets.md`
(credential handling) and `docs/observability.md`.

> **Threat model reminder.** Atlas's Platform-Admin access goes *through the app*
> — authorized, scoped and audited. The controls here target the **bypass path**:
> someone reaching the database directly (a stolen app credential, or raw access
> to the container/volume). That access is *not* visible to Atlas's audit log, so
> it must be defended at the database and infrastructure layers.

---

## 1. Encryption in transit (app → database) — TLS

Atlas honours a configured TLS mode via **`Database:SslMode`** (env
`Database__SslMode`), applied to the connection at startup:

| Value | Behaviour |
| ----- | --------- |
| *(unset)* | Npgsql default — **opportunistic** TLS, falls back if the server has none. Non-breaking; fine for a local single-host container. |
| `Prefer` | Same as unset, explicit. |
| `Require` | **Enforce** TLS; fail if the server won't encrypt. Use in production / Azure. |
| `VerifyFull` | Require TLS **and** validate the server certificate/hostname. Strongest. |

- **Azure Database for PostgreSQL** requires SSL by default — set
  `Database__SslMode=Require` (or `VerifyFull` with the CA) and it works out of
  the box.
- **Local Postgres container**: the stock `postgres:16-alpine` has no
  certificate, so leave `SslMode` unset (or `Prefer`). To enforce locally, mount
  a server cert and set `ssl=on` in `postgresql.conf`, then use `Require`.

## 2. Least-privilege database role

By default the app connects as `atlas`, which is the cluster **superuser**. Run
**`deploy/postgres-least-privilege.sql`** to create a non-superuser `atlas_app`
role and point the app's connection string at it. A stolen app credential then
can't reach other databases, roles or cluster settings.

The script keeps schema-create rights because the app migrates on startup; it
documents the tighter DML-only variant for when migrations run out-of-band.

**Keep a separate privileged/DBA account** (the superuser) for maintenance,
migrations and break-glass troubleshooting — least-privilege applies to the
*application's runtime role*, not to your operators. The two are complementary.

## 3. Encryption at rest

Postgres community edition has no built-in TDE, so encryption at rest comes from
the **storage layer**:

- **Windows Server (now):** enable **BitLocker** on the volume backing the
  Docker data directory (and the `atlas_db` volume). Anyone who copies the disk
  then gets ciphertext.
- **Azure (later):** *Azure Database for PostgreSQL* is **encrypted at rest by
  default** (service-managed keys, or bring your own key in Key Vault). Nothing
  to do beyond choosing the key option.

## 4. Database-level audit & detection

App-level auditing can't see a direct DB connection — add it at the database:

- **`log_connections = on`, `log_disconnections = on`** in `postgresql.conf` —
  records every connection (who/when/from where).
- **`pgAudit`** extension — statement-level audit (reads/writes) for forensic
  trails of direct access. Install the extension and set `pgaudit.log = 'read, write'`.
- **Azure (later):** enable **Microsoft Defender for PostgreSQL** — anomalous-
  access and exfiltration alerts on the managed service, plus diagnostic logs to
  Log Analytics.

## 5. Network isolation (already in place)

The compose file publishes only the web ports (443/80); the `db` service has
**no published port**, so Postgres isn't reachable from outside the host. Keep it
that way — an attacker must already be inside the environment to reach the DB.
On Azure, use **private endpoints / VNet integration** rather than a public DB
endpoint.

---

## Not enabled: field-level encryption

Encrypting individual sensitive columns would protect data **even from someone
with raw DB access** (they'd see ciphertext; only the app holds the key). It is
**not** enabled because it removes the ability to query/sort/filter those columns
and adds migration and performance cost. It's a deliberate, scoped decision — ask
if the threat model calls for it and we'll pick the specific fields.
