# ADR-0068 — Field encryption for DPIA-gated personnel notes

**Status:** Accepted

## Context

Team SWOT and individual development-plan notes are sensitive personnel data
(ADR-0062/0063): manager-scoped, redacted from the broad settings read, gated
off until DPIA + MBL sign-off. They're stored as JSON in the `Settings` table
(`team.swot.{slot}`, `devplan.{person}`). Encryption **in transit** (TLS to
Postgres) and **at the volume** (disk encryption) are deployment concerns; what
was missing was **application-level at-rest encryption** so a stolen database —
or, more realistically, a stolen DB backup — doesn't expose these notes in the
clear. The target is on-prem single-node Docker with **no HSM and no cloud KMS**.

## Options

1. **pgcrypto** (DB-side `pgp_sym_encrypt`). Rejected: these values are written/
   read through EF Core as ordinary `Setting` rows, so pgcrypto means raw SQL for
   just these keys and the key travelling inside SQL statements (log-leak risk).
2. **EF `ValueConverter` on the Settings value.** Rejected: would encrypt *all*
   settings (including non-sensitive config), and can't be scoped to two keys.
3. **App-level field encryption at the two call sites.** Chosen.

## Decision

Encrypt only the SWOT and dev-plan JSON values in the application, at the four
`Teams.cs` read/write sites, with **AES-256-GCM** and a per-value random nonce
(`PersonnelCrypto`).

- **Key from the secret layer** — config `Personnel:EncryptionKey`, delivered by
  a `/run/secrets` file, env var, or OpenBao/Vault. **Never stored in the DB.**
- **Inert until set** — with no key, `Protect` returns plaintext, so the
  gated-off default is unchanged and **no migration/backfill** is needed.
- **Backward-compatible reads** — a value is decrypted only if it carries the
  `enc:v1:` marker; legacy plaintext passes through, and is upgraded to ciphertext
  the next time it's saved.
- **Zero-downtime rotation** — a second key `Personnel:EncryptionKeyOld` is
  accepted for reads; write-new / read-old, re-save, then drop the old key.
- **Fails closed, never crashes** — a marked value that no configured key can
  decrypt (missing/rotated-away key, or tampering caught by the GCM tag) returns
  null and the note is simply *not shown*, rather than corrupting output or
  throwing. No first-class local-key-file auto-anything: the key is a secret like
  any other.

Opt-in compose overlay `docker-compose.personnel.yml` mounts the key; the
step-by-step operator runbook (generate, back up **separately from the DB**,
verify, rotate) lives in `docs/secrets.md`.

## Consequences

- These notes are unreadable from a stolen DB/backup without the separately-held
  key — a materially better GDPR posture for the most sensitive data in Atlas.
- **Key custody is now load-bearing:** losing the key loses the notes (by design);
  it must be backed up apart from the data. Documented prominently.
- Encrypted fields can't be searched/sorted — fine, they're free-text notes.
- No per-restart ceremony (unlike a vault unseal): the app reads the key at boot.
- Nothing else depends on the key, so the blast radius of a lost key is bounded to
  these two note types.
