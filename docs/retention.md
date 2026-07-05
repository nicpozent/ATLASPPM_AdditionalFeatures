# Data retention & erasure

Atlas retains personal data for a configurable window (**default 10 years**) and
then **anonymises it rather than deleting it**. Anonymisation strips the
personal identifiers but keeps the rows, so the audit trail's integrity — the
sequence of who-approved-what, counts, timings — survives. This reconciles the
GDPR storage-limitation principle with legitimate long-term audit retention.

## How it works

- **Pseudonyms are stable.** A value is replaced by a one-way hash token
  (`Anonymised <hash>` for names, `<hash>@anonymised.invalid` for emails), so
  the same original always maps to the same token. Historical events therefore
  keep "these were the same actor" without revealing who.
- **Anonymisation is idempotent** — re-running never double-processes a row.

## 1. Age-based retention (automatic)

A background pass runs daily and anonymises records older than the window:

- **Audit events** → the `actor` is pseudonymised.
- **Notifications** → the recipient `userKey` is pseudonymised.

With the default 10-year window nothing is touched until records actually age
out; the machinery simply runs and stays a no-op until then.

Run it on demand (Platform Administrator only, audited):

```
POST /api/v1/admin/retention/run
→ { "anonymised": <count>, "cutoff": "<iso-date>" }
```

## 2. Right to erasure (on request)

Erase a specific person across every table that holds their personal data
(resource allocation, directory membership, product allocations & memberships,
subscriptions, notification preferences & inbox, audit actor, and owned
projects/programs/products/objectives/blockers + demands raised). Rows are kept;
identifiers are pseudonymised. Matching is exact and case-insensitive on name,
email or user key. Platform Administrator only, audited:

```
POST /api/v1/gdpr/erase?subject=<name | email | user key>
→ { "subject": "...", "anonymised": <count> }
```

This is the companion to the DSAR export (`GET /api/v1/gdpr/export`).

## Configuration

| Setting | Env var | Default | Purpose |
| ------- | ------- | ------- | ------- |
| `Retention:Enabled` | `Retention__Enabled` | `true` | Enable the daily background pass. |
| `Retention:Years` | `Retention__Years` | `10` | Retention window in years. |
| `Retention:Days` | `Retention__Days` | *(unset)* | Overrides `Years` when set (mainly for testing). |

The admin "run now" and erasure endpoints work regardless of
`Retention:Enabled` — that flag only governs the automatic daily pass.
