# Sweden — legal & regulatory map (beyond baseline GDPR)

> **Not legal advice.** This is an engineering-side map for the DPO / employment
> counsel to validate. Atlas now stores **manager assessments of named employees**
> (development plans, Team SWOT, skills), **activity/presence data** (the live PI
> board), **financial data**, and integrates with **cloud processors** — which
> pulls in Swedish and EU-in-Sweden rules beyond the GDPR baseline we already
> handle. Items marked **[gate]** are enforced in-product (see the personnel-data
> processing toggle, `Teams.PersonnelFlagKey`, ADR-0062/0063).

## 1. Employment & co-determination (most relevant to SWOT / dev plans)
| Law | Why it applies | Action |
| --- | --- | --- |
| **MBL — Lag (1976:580)** (co-determination) | Introducing a system that stores manager assessments of employees is typically an "important change" → **primary negotiation §11** with unions before rollout. | **[gate]** Keep SWOT/dev plans off until §11 negotiation is done. |
| **Kollektivavtal** (collective agreements) | Sector agreements can add rules on employee data / monitoring beyond statute. | Check the applicable agreement. |
| **Diskrimineringslagen (2008:567)** | Subjective assessment records must not enable or evidence discrimination on protected grounds. | Governs *use*; train managers; keep records factual/development-framed. |
| **LAS — Lag (1982:80)** (employment protection) | Assessment data feeding redundancy/termination becomes dispute evidence. | Retention + accuracy discipline for assessment data. |
| **Arbetsmiljölagen (1977:1160)** + **OSA (AFS 2015:4)** | Psychosocial/organisational work-environment duties if tracking affects workload/stress. | Consider in rollout comms. |

## 2. Data protection (Swedish layer on top of GDPR)
| Item | Why | Action |
| --- | --- | --- |
| **Dataskyddslagen (2018:218)** | Swedish supplementary act (national derogations on top of GDPR). | Confirm any national specifics with DPO. |
| **IMY guidance — personal data in working life** | The live board's **presence + cursors are workplace monitoring**; must be proportionate + transparent. | Proportionality assessment; transparency notice; possibly MBL. |
| **DPIA (GDPR Art. 35)** | Systematic evaluation of employees (SWOT/dev plans/skills) likely **requires** a DPIA. | **Do the DPIA before enabling [gate].** |
| **Records of processing (Art. 30)** | Legal obligation. | Add SWOT/dev-plans/board to the RoPA. |
| **Employee privacy notice (Art. 13/14)** | Employees must be told their data (assessments, presence) is processed. | Update the notice. |
| **Processor DPAs (Art. 28)** | Microsoft (Entra/Graph/Teams), Atlassian (Jira), the OTLP/observability vendor. | Signed DPAs on file. |
| **Transfers (GDPR Ch. V / Schrems II)** | Cloud SaaS may process personal data outside EU/EEA. | Confirm EU/EEA residency or SCCs + transfer impact assessment. |

## 3. Financial & accounting (financials / costs data)
| Law | Why | Action |
| --- | --- | --- |
| **Bokföringslagen (1999:1078)** | 7-year retention for accounting records — **conflicts** with GDPR minimisation and our ~10-year anonymisation pass. | **Documented retention schedule per data category**: keep accounting records 7y; delete/anonymise personal data on its own clock. |

## 4. Applicability to verify (do not assume "covered")
| Item | Likely status | Note |
| --- | --- | --- |
| **NIS2 / Swedish cybersecurity law (2025)** | Verify — retail is usually **not** an in-scope essential/important entity. | ADR-0049 lists NIS2 as covered; confirm any in-scope activity rather than asserting. |
| **European Accessibility Act — Lag (2023:254)** | Likely **out of scope** — targets consumer products/services, not an internal employee tool. | Our a11y work (WCAG / EN 301 549) is good practice, not a statutory must here. |
| **Digital public-sector accessibility — Lag (2018:1937)** | **Not applicable** — public-sector only. | — |
| **Säkerhetsskyddslagen (2018:585)**, **kamerabevakningslagen (2018:1200)** | **Not applicable** — no security-sensitive activity, no cameras. | Listed to rule out. |
| **Visselblåsarlagen (2021:890)** | Out of scope | Only if Atlas becomes a whistleblowing channel (it isn't). |

## Implemented lifecycle controls
- **Subject access (Art. 15)** — development plans are included in `GET /gdpr/export`.
- **Erasure (Art. 17)** — `POST /gdpr/erase` deletes the subject's development plan.
- **Leaver cleanup** — explicit member removal deletes that person's development
  plan (the bulk directory re-sync deliberately does **not**, to avoid deleting a
  plan during no-Uid→Uid re-keying churn).
- **Off-by-default gate** — SWOT + development plans are disabled until
  `personnel.assessmentsEnabled` is set (server-enforced; ADR-0063).
- *Team SWOT is team-level, not a person's personal data, so it is not part of
  subject export/erasure; set the retention/cleanup policy for it separately.*

**Backup note**: the full snapshot (admin-only download) now contains the Teams
webhook secret **and** personnel-assessment data. Treat backup files as
sensitive — store them encrypted with restricted access; don't email/share them
casually.

## Tracked to-dos (before enabling personnel features in production)
1. **DPIA** for SWOT / development plans / skills + the board's presence/monitoring aspect — a pre-filled template is in [`docs/dpia-personnel-data.md`](./dpia-personnel-data.md).
2. **MBL §11 negotiation** with the unions.
3. **Retention schedule** reconciling Bokföringslagen (7y) ⟷ GDPR minimisation ⟷ the anonymisation pass.
4. **Processor DPAs + Ch. V transfer assessment** (Microsoft, Atlassian, observability).
5. **Employee privacy notice** covering assessments and board presence.
6. **Re-verify NIS2 applicability**; correct ADR-0049 if not in scope.

Until 1–2 are signed off, leave the **personnel-data processing** toggle OFF
(Integrations & Settings → Governance) — the SWOT and development-plan features
are disabled and the API refuses reads/writes while it is off.
