# DPIA — personnel-assessment features (Team SWOT & development plans)

> **Template, pre-filled with the technical facts.** Fields marked
> **[DPO/org to complete]** are policy/legal decisions Atlas can't make for you.
> This DPIA (GDPR Art. 35) is a **prerequisite to enabling** the personnel-data
> processing gate (`personnel.assessmentsEnabled`; ADR-0063). Companion:
> `docs/compliance-sweden.md`.

## 1. Why a DPIA is needed
The features involve **systematic evaluation of employees** based on personal
data (development notes, team SWOT, skills), which meets the GDPR Art. 35(3)(a)
trigger. A DPIA is therefore expected before go-live.

## 2. Description of the processing
| | |
| --- | --- |
| **Data subjects** | Employees who are members of mapped Entra teams; the managers who author notes. |
| **Personal data** | *Development plans*: free-text Strengths / Growth areas / Goals per person. *Team SWOT*: free-text per team (not per person). *Skills matrix*: 0–4 ratings per person/skill. *Live PI board*: presence (display name/initials) + ephemeral cursor position. |
| **Special categories (Art. 9)** | None intended. **[DPO: instruct managers not to record health, union, or other special-category data in free-text.]** |
| **Purpose** | Talent/development planning, capability planning, PI-planning facilitation. **[DPO/org to confirm the stated purpose.]** |
| **Lawful basis** | **[DPO to choose]** — typically legitimate interest (Art. 6(1)(f)) with an LIA, or performance of the employment relationship. *Consent is generally not valid in an employment context.* |
| **Recipients** | The employee's manager and managers above them in the roll-up; Platform Admin. **Never the data subject or peers.** Processors: Microsoft (Entra/Graph/Teams), Atlassian (Jira), the observability vendor. |
| **Retention** | **[DPO to set]** — reconcile with Bokföringslagen (7y, non-personal accounting only) and GDPR minimisation; align with the anonymisation pass (`docs/retention.md`). |
| **Transfers** | **[DPO]** confirm EU/EEA residency of the processors above, or SCCs + transfer impact assessment (Ch. V / Schrems II). |

## 3. Necessity & proportionality
- **Data minimisation**: development framing (Strengths/Growth/Goals) instead of
  SWOT for individuals — no "weaknesses/threats" on a named person. Team SWOT is
  team-level only. Free-text fields are length-capped (4 000 chars).
- **Access**: strictly manager-and-up, scoped to the roll-up tree; never exposed
  to the subject or peers.
- **Storage limitation**: **[DPO to set retention]**, then it is enforced by the
  retention pass.

## 4. Risks to data subjects & mitigations (as built)
| Risk | Mitigation already implemented |
| --- | --- |
| Unauthorised access / over-broad visibility | Scope = the manager roll-up tree (`Teams.ScopeAsync`/`MembersInScopeAsync`); out-of-scope → 403; never shown to the subject/peers. |
| Accidental exposure via a general API | Redacted from the broadly-readable `GET /settings`; served only via scoped endpoints (ADR-0060/0062). |
| Processing before governance sign-off | **Off-by-default gate** (`personnel.assessmentsEnabled`), server-enforced: writes 403, reads return no data until enabled (ADR-0063). |
| Lack of accountability | Every write audited (who edited whose record — not content) in the audit log. |
| Function creep to adversarial assessment | Development framing by design; individual SWOT deliberately not built. |
| Monitoring via the live board | Presence/cursors are ephemeral, non-PII-minimised (name/initials only), never persisted; **[DPO: cover in the privacy notice; assess proportionality; MBL].** |

## 5. Residual risk & open actions **[org to complete before enabling the gate]**
1. Complete this DPIA and record the **lawful basis** (+ LIA if legitimate interest).
2. **MBL §11** co-determination negotiation with the unions.
3. Set the **retention schedule** and configure the anonymisation window.
4. Confirm **processor DPAs** + **transfer** posture (Microsoft, Atlassian, observability).
5. Publish/refresh the **employee privacy notice** (assessments + board presence).
6. Define the **subject-access** handling for these records.

## 6. Sign-off
| Role | Name | Date | Decision |
| --- | --- | --- | --- |
| Data Protection Officer | **[…]** | | Approve / Reject |
| HR / People lead | **[…]** | | |
| Union / works-council (MBL) | **[…]** | | |
| System owner (enables the gate) | **[…]** | | |

Only once this is signed does a Platform Admin enable **Integrations & Settings →
Governance → Personnel-data processing**.
