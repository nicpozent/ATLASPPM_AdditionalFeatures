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

## 6. Automated application-security scanning (CI)

Beyond the supply-chain gates (`npm audit`, `dotnet list --vulnerable`), the
`security-scan.yml` workflow runs the automated half of a penetration test
(ADR-0051):

- **SAST — Semgrep** (`p/security-audit`, `p/owasp-top-ten`, `p/secrets`): source
  analysis of the C#/TypeScript for injection, authz, crypto and hardcoded-secret
  patterns.
- **SCA · secrets · IaC — Trivy** (`fs`): dependency CVEs, committed secrets, and
  Dockerfile/compose misconfiguration.
- **DAST — OWASP ZAP baseline** (`workflow_dispatch` with a `zap_target` URL):
  probes a *running* test environment from the outside (never production) — the
  same run-against-a-test-server model as the k6 perf suite.

**Run it without GitHub.** `scripts/security-scan.sh` fires the same SAST + SCA
(and optional `--dast <url>`) from any machine or on-prem build agent — no GitHub
connection, and the running app is never involved (SAST/SCA read the source on
disk). It auto-honours `.semgrepignore` / `.trivyignore`, so the exceptions below
apply identically. The posture is also viewable in-app at **Admin → Security
Posture** (a static reference — the app runs no scans and reaches nothing
external).

SAST + Trivy are **gating** — a HIGH/CRITICAL finding fails the build (ADR-0053,
after the baseline triage below). GitHub-native **CodeQL** is complementary and
enabled via the repo's *Code scanning → Default setup* toggle. A human
penetration test / red-team is a separate external engagement this does not
replace.

### Baseline triage & scoped exceptions (ADR-0053)

The first scan was triaged to a clean, gating baseline.

**Fixed:** the API image runs non-root (`server/Dockerfile` → `USER 1654`);
Dependabot got a 7-day `cooldown` on every ecosystem (delays adopting a freshly
published — possibly compromised — version).

**Accepted (scoped, documented) exceptions** — deliberate risk acceptances, not a
blanket disable:

| Exception | Where | Why |
|-----------|-------|-----|
| nginx edge runs as root (DS-0002 / `missing-user`) | `.trivyignore` (`AVD-DS-0002`) + Semgrep `--exclude-rule` | Master binds privileged 80/443 + reads certs; workers drop to the `nginx` user. The API image is non-root (USER 1654), so this applies only to the nginx edge. Unprivileged-nginx (8080/8443) tracked. |
| `mutable-action-tag` | Semgrep `--exclude-rule` | Actions pinned to major versions, kept current by Dependabot's `github-actions` ecosystem; SHA-pinning deferred. |
| `gha-curl-pipe-shell` | Semgrep `--exclude-rule` | Official Trivy installer over TLS from the vendor repo. |
| nginx `request-host` / `dynamic-proxy-host` / `missing-internal` | Semgrep `--exclude-rule` | Standard same-origin reverse proxy; the `proxy_pass` upstream is an internal config value, not attacker input. |
| nginx `possible-h2c-smuggling` | Semgrep `--exclude-rule` | Purely-syntactic rule that fires on any WebSocket proxy (`proxy_http_version 1.1` + `Upgrade` + `Connection` together), which the `/hubs` SignalR proxy requires. The actual h2c vector **is** mitigated: `$atlas_ws_upgrade`/`$atlas_ws_connection` maps emit `websocket`/`upgrade` only for a genuine WebSocket request and clear both headers for any other Upgrade token (incl. `h2c`), so a cleartext upgrade can't be smuggled to the backend (ADR-0061). |
| `design/` (prototype reference) | `.semgrepignore` | The approved prototype (CLAUDE.md §2) — never bundled or served, so its demo helpers aren't application AppSec. |

### CodeQL (GitHub-native, complementary)

CodeQL runs semantic dataflow analysis that Semgrep's pattern rules don't, so we
run it **in addition to** the SAST above — but it lives in GitHub's own scanning,
not in a workflow file we commit. Enabling it is a one-time **repo Settings**
toggle, not code:

> **Settings → Code security → Code scanning → CodeQL analysis → Set up →
> Default setup → Enable.** Pick languages **JavaScript/TypeScript** and **C#**;
> leave the schedule at the default (on push/PR to `main` + weekly). Findings
> surface under the repo's **Security → Code scanning** tab.

Default setup needs no `codeql.yml` in the repo and no secrets. It only reads the
source GitHub already hosts — it never touches the running application, so it
doesn't change the "no connection between GitHub and the app" posture. Promote
findings to gating (branch-protection required check) once the baseline is
triaged, the same way SAST/Trivy were (ADR-0053).

### Performance smoke (on-demand)

`perf-smoke.yml` (`workflow_dispatch`) stands up a throwaway Postgres + a seeded
API and runs the single-VU k6 smoke pass (`perf/smoke.js`) over every hot roll-up
endpoint, failing on any error or on roll-up p95 latency past budget (ADR-0047).
It's the deterministic subset of the k6 suite wired into CI; `load.js`/`stress.js`
stay manual against a real test server. Not a security control — a
performance-regression gate — but it shares the "run against a *test* server,
never production; the seeder is a throwaway fixture" model.

### Manual penetration test (out of band)

The automated SAST/SCA/DAST above is the machine-checkable half. A human
penetration test / red-team is a separate external engagement it does not
replace — scope, rules of engagement, and the remediation register live in
[`docs/pentest-scope.md`](./pentest-scope.md).

### Threat model

The qualitative companion to these gates is the platform
[**threat model**](./threat-model.md) — a STRIDE analysis over the system's trust
boundaries, a LINDDUN privacy pass over the personal/personnel data, an OWASP-rated
risk register, and a MITRE ATT&CK mapping, each tied back to the implemented
controls and their ADRs. Re-review it every release and on any new trust boundary,
external interface, or data class.
