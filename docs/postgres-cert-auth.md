# Passwordless Postgres — TLS client-certificate auth

The strongest way to handle the database credential is **not to have one.** With
TLS client-certificate (mutual-TLS) auth, the API/worker authenticate to Postgres
by presenting a **client certificate** whose Common Name (CN) is the database
role. There is **no password** to store, rotate, vault, or leak — only a cert
signed by a CA you control, with the right CN, is accepted over the network.

This is the on-prem equivalent of the "passwordless database auth (best)" note in
`docs/secrets.md`, and it's opt-in: the base stack keeps password auth unchanged.

> **Verified mechanism.** The server-side flow below is proven: a passwordless
> client-cert connection succeeds (`current_user=atlas, ssl=true`), while a
> connection with **no client cert** — or with a password and no cert — is
> rejected with *"connection requires a valid client certificate."* The one thing
> to validate in your environment is the container cert **file permissions** (who
> can read each private key), covered in step 4.

## How it works
- Postgres runs with TLS on and an `pg_hba.conf` whose TCP rule is
  `hostssl … cert clientcert=verify-full` — every network login must present a
  client cert signed by the server's CA, and its **CN must equal the login role**.
- The app's connection string carries the client cert/key + CA and **no
  `Password=`** — Npgsql presents the cert; Postgres maps CN → role.
- Precedence and secret layers are untouched; this replaces *how the DB login is
  proven*, not how other secrets are sourced.

## Step by step (dev certs → passwordless stack)

**1. Mint the certificates** (CA + server + client) — `db` is the compose service
host the app connects to; `atlas` is the DB role the client cert authenticates as:

```bash
sh deploy/gen-pg-cert.sh db atlas
# → deploy/pgcerts/{ca.crt,ca.key,server.crt,server.key,client.crt,client.key}
#   (git-ignored). server cert SAN=db,localhost,127.0.0.1 · client cert CN=atlas
```

> **Windows (no local `openssl`)** — generate the certs inside a throwaway
> container so you don't need OpenSSL on the host. From the repo root in
> PowerShell:
>
> ```powershell
> docker run --rm -v "${PWD}:/repo" -w /repo alpine `
>   sh -c "apk add --no-cache openssl >/dev/null && sh deploy/gen-pg-cert.sh db atlas"
> dir deploy\pgcerts   # confirm ca.crt, server.crt/key, client.crt/key exist
> ```

**2. Bring the stack up with the overlay** (name it last so it wins):

```bash
docker compose -f docker-compose.yml -f docker-compose.pgcert.yml up -d
```

The overlay turns on TLS + the cert-only `pg_hba` on `db`, mounts the certs into
`db` and `api`/`worker`, and sets each app connection string to the **passwordless
cert form** (`SSL Mode=VerifyFull;Root Certificate=…;SSL Certificate=…;SSL Key=…`).

> **Cross-platform note (how the overlay handles key permissions).** The `db`
> service mounts the cert folder **read-only** at `/etc/pgcerts-src` and, at
> startup, copies the server cert/key/CA into `/etc/pgcerts` **owned by the
> postgres user with `server.key` at `600`**. This is deliberate: host file
> permissions do **not** translate across Windows/WSL2 Docker Desktop bind mounts
> (files surface as `0777 root`, which Postgres rejects as world-readable). By
> copying-and-`chmod`-ing inside the container, cert auth works identically on
> Linux, macOS and Windows with no host `chown`. The `pg_hba.conf` is mounted at a
> **sibling** path (`/etc/pgcerts-hba/`), not inside the read-only cert dir —
> nesting a file mount inside a read-only mount fails on Docker Desktop.

**3. Verify** the app connected over TLS with no password:

```bash
docker compose -f docker-compose.yml -f docker-compose.pgcert.yml logs api | grep -i "migrations applied\|ready"
# who am I, and is TLS on?  (run from inside the db container)
docker compose exec db psql -U atlas -d atlas \
  -c "select usename, ssl, client_dn from pg_stat_ssl join pg_stat_activity using (pid) where usename='atlas';"
#   → ssl = t, client_dn = /CN=atlas
```

**4. Key file permissions — mostly handled for you now.**

- **Server key** (`db` side): handled automatically. The overlay copies the key
  into the container and `chmod 600` + `chown postgres` it at startup (step 2
  note), so the historical *"private key file has group or world access"* failure
  can't occur — including on Windows bind mounts.
- **Client key** (`api`/`worker` side): Npgsql reads the PEM client key via .NET
  crypto and does **not** enforce unix file permissions, so the read-only host
  mount is fine as-is on every platform.
- **CA key** (`ca.key`): never used at runtime — keep it offline.

If you swap in a **different Postgres image** whose runtime user isn't uid 70
(e.g. a Debian `postgres` on uid 999), change the two `chown` targets in the `db`
entrypoint of `docker-compose.pgcert.yml` to that uid; nothing else changes.

## First-boot / existing-volume notes
- The base `db` service still creates the `atlas` role on first init (with the
  `POSTGRES_PASSWORD` it was given); the cert `pg_hba` simply makes that password
  **unusable over TCP** — network logins must present the cert. You can drop the
  password entirely (`ALTER ROLE atlas PASSWORD NULL;`) once cert auth is proven.
- If the `atlas_db` volume already exists, only `pg_hba`/TLS change — no re-init
  needed.

## Production
- Mint `server.crt/key` and `client.crt/key` from **your CA** (corporate PKI),
  server SAN = the real DB host, client CN = the DB role. Same filenames in
  `deploy/pgcerts/`; nothing else changes.
- Rotate by re-issuing the client cert before expiry (no downtime if you allow
  both old and new client CNs briefly, or issue with the same CN and just swap the
  files + restart). Keep the **CA key offline**.
- This pairs naturally with the least-privilege role in
  `deploy/postgres-least-privilege.sql`.

See ADR-0069.
