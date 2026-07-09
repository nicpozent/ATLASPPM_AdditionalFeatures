# ADR-0049 — Compliance framework coverage & Zero-Trust posture

**Status:** Accepted — extends the governance module (ABB-10) and the deterministic
risk engine (`Risks.cs`).

## Context
The security/compliance module mapped controls to GDPR, ISO 27001, PCI-DSS, SOC 2,
NIS2, EU AI Act and the retail sustainability regulations, and the deterministic
risk engine cited standards per finding. A framework review surfaced gaps:

- **NIST** was entirely absent; **ISO 42001** was cited by a risk rule but not even
  selectable as a control framework (an inconsistency).
- **MITRE ATT&CK** produced a single generic advisory, not named technique classes.
- **Zero Trust** had no articulated posture, though the primitives exist.
- New frameworks needed a bespoke engine rule each — no generic coverage.

## Decision
1. **Framework catalogue** — add **NIST CSF 2.0** and **ISO 42001** to the control
   framework options (fixing the ISO 42001 inconsistency); add render tints for
   NIST CSF, SOC 2, NIS2 and EU AI Act findings.
2. **Generic coverage rule** (`Risks.cs`) — for *every* framework a project logs
   controls under, deterministically score implementation (`impl/total`) and raise
   a finding when a gap exists, skipping any framework a specific rule already
   reported and any fully-implemented one. NIST CSF, SOC 2, NIS2 and ISO 42001 now
   get findings from real control data with **no per-framework code**.
3. **MITRE ATT&CK** — the threat-model finding now names tactic/technique classes
   keyed off the architecture change type (e.g. payment → *Credential Access
   T1552*; cloud-platform → *Initial Access T1190, Valid Accounts T1078*).
4. **Zero-Trust posture** — documented here (below): a mapping of Atlas's existing
   controls to the ZT tenets, honest about what is app-level vs. infrastructure.

Everything stays deterministic (no LLM) and needs **no schema change** — controls
carry a free-text `Framework`, so new frameworks are data, not migrations. First-
class *scoping* of NIST/ISO 42001 (profile checkboxes) and AI-Act risk-tiering are
deferred to a follow-up that adds the `SecurityProfile` fields (ADR-0050, planned).

### Zero-Trust posture mapping
| ZT tenet | Atlas today | Gap (infrastructure / follow-up) |
|----------|-------------|----------------------------------|
| **Verify explicitly** | Entra ID OIDC/MSAL sign-in; API validates JWT (audience/issuer); token-driven identity | Device / session-risk conditional-access signals (Entra CA policy) |
| **Least-privilege access** | Server-authoritative RBAC capability matrix; 6 canonical roles; least-privilege DB role; UI checks cosmetic-only | Just-in-time elevation; per-record ABAC |
| **Assume breach** | Security headers/CSP, rate limiting, upload limits, correlation IDs, audit log, idle-logout, retention/anonymisation | Network micro-segmentation, egress control, mTLS between tiers (host/k8s concern) |
| **Continuous monitoring** | OpenTelemetry traces/metrics/logs, health/readiness, domain metrics + alerts | SIEM export, anomaly detection |

The identity/authorisation and observability tenets are met at the app layer; the
network-segmentation half is an infrastructure concern deferred until a hosting
target is chosen (see the deferred k8s/Helm work).

## Consequences
- **+** NIST CSF and ISO 42001 are trackable; SOC 2 / NIS2 / ISO 42001 now yield
  deterministic coverage findings; MITRE findings are specific and actionable.
- **+** Any future framework maps by adding a catalogue label — the generic rule
  scores it automatically.
- **+** A stated Zero-Trust posture with an honest gap list.
- **−** Coverage is control-presence-driven for frameworks without a profile flag:
  a framework in scope with *zero* controls logged raises nothing yet. First-class
  scoping (flags) + AI-Act risk-tiering follow in ADR-0050.

## Alternatives considered
- **A bespoke rule per framework** — doesn't scale; the generic coverage rule
  covers all current and future frameworks. Rejected.
- **Add profile flags now (schema)** — larger, migration-bearing change; separated
  into the AI-governance follow-up so this stays no-migration. Deferred.
