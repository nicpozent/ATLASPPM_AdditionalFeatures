namespace Atlas.Api;

// ============================================================================
//  Governance domain — gates, RAID, architecture, security, requirements, quality.
//  (Split out of the former monolithic Domain.cs — same namespace.)
// ============================================================================

public class Gate
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Code { get; set; } = default!;      // "G0".."G5"
    public string Name { get; set; } = default!;       // "G0 · Concept / Mandate"
    public string Approver { get; set; } = "";         // e.g. "Sponsor", "PMO Lead"
    public string Status { get; set; } = "Not started"; // Not started | Pending | Approved | Rejected
    public string Date { get; set; } = "";             // display date when decided
    public int Ord { get; set; }
    public List<GateCriterion> Criteria { get; set; } = new();
}

public class GateCriterion
{
    public int Id { get; set; }
    public int GateId { get; set; }
    public string Label { get; set; } = default!;
    public bool Met { get; set; }
    public int Ord { get; set; }
}

// ---- Project tasks (board + table) ----------------------------------------

public class TestPlan
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Stage { get; set; } = "System";        // Unit | Integration | System | UAT | Regression | Performance | Security
    public int Cases { get; set; }
    public int Passed { get; set; }
    public int Failed { get; set; }
    public int Blocked { get; set; }
    public int Ord { get; set; }
    public int JiraBoardId { get; set; }                 // linked Jira agile board; 0 ⇒ none. Ingested issues land as tasks.
    public List<TestPlanTask> Tasks { get; set; } = new();
}

// An individual test-case / task tracked under a test plan.

public class TestPlanTask
{
    public int Id { get; set; }
    public int TestPlanId { get; set; }
    public string Title { get; set; } = default!;
    public string Status { get; set; } = "Not run";      // Not run | In test | Passed | Failed | Blocked
    public string Assignee { get; set; } = "";
    public string Description { get; set; } = "";         // steps / expected result / notes
    public string StartDate { get; set; } = "";           // ISO date the test work starts
    public string DueDate { get; set; } = "";             // ISO date it's due
    public double EstimateHours { get; set; }             // planned time to spend (hours)
    public string JiraKey { get; set; } = "";             // source Jira issue key when ingested; "" = local
    public int Ord { get; set; }
}

public class Defect
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Code { get; set; } = default!;         // "DEF-01"
    public string Title { get; set; } = default!;
    public string Severity { get; set; } = "Medium";      // Critical | High | Medium | Low
    public string Owner { get; set; } = "";
    public string Status { get; set; } = "Open";          // Open | In progress | Resolved | Closed
    public string Test { get; set; } = "";
    public int Ord { get; set; }
}

// ---- Architecture governance (TOGAF ADM) ----------------------------------

public class ArchProfile
{
    public string ProjectId { get; set; } = default!;    // PK
    public string ChangeType { get; set; } = "";          // drives required governance level
}

public class AdmPhase
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Code { get; set; } = default!;          // P, A, B, C, D, E, F, G, H
    public string Phase { get; set; } = default!;          // "A · Architecture Vision"
    public string Focus { get; set; } = "";
    public string Owner { get; set; } = "";
    public string Artefact { get; set; } = "";
    public string Status { get; set; } = "Not started";   // Not started | Draft | In progress | In review | Approved
    public int Ord { get; set; }
}

// A Help centre article. Two kinds: "guide" (role-based how-tos, keyed by
// Audience) and "troubleshooting" (keyed by an error Code prefix, linked from
// the error UI). Seeded with a curated baseline; Platform Admins can edit it.

public class ArchApproval
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Role { get; set; } = default!;          // Chief Architect, Solution Architect, …
    public string Decision { get; set; } = "pending";     // pending | approved | conditions | rejected
    public string DecidedBy { get; set; } = "";           // who recorded the sign-off
    public string DecidedAt { get; set; } = "";           // display timestamp
    public string Note { get; set; } = "";                // conditions / rejection rationale
    public int Ord { get; set; }
}

// ---- Requirements & traceability ------------------------------------------

public class Requirement
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Code { get; set; } = default!;         // "REQ-01"
    public string Title { get; set; } = default!;
    public string Type { get; set; } = "Functional";     // Functional | Non-functional | Compliance
    public string Priority { get; set; } = "Medium";      // Critical | High | Medium | Low
    // Draft | In review | Approved | Replaced | Archived | Retired (Requester|PM|Team)
    public string Status { get; set; } = "Draft";
    public string Description { get; set; } = "";
    public string Epic { get; set; } = "";
    public string Story { get; set; } = "";
    public string Test { get; set; } = "—";
    public string TestStatus { get; set; } = "Not run";   // Not run | In test | Passed | Failed
    public string Release { get; set; } = "Backlog";
    public bool Verified { get; set; }
    public int Ord { get; set; }
    public List<RequirementAttachment> Attachments { get; set; } = new();
}

// A file attached to a requirement (spec doc, mockup, acceptance evidence).

public class RequirementAttachment
{
    public int Id { get; set; }
    public int RequirementId { get; set; }
    public string FileName { get; set; } = default!;
    public string ContentType { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public string UploadedAt { get; set; } = "";
    public byte[] Bytes { get; set; } = Array.Empty<byte>();
}

public class SecurityProfile
{
    public string ProjectId { get; set; } = default!;   // PK
    public string Classification { get; set; } = "Internal";  // Public|Internal|Confidential|Restricted
    public string Residency { get; set; } = "EU / EEA";       // EU / EEA | Global | On-prem only
    public string Subjects { get; set; } = "";
    public string Retention { get; set; } = "";
    public bool PersonalData { get; set; }
    public bool SpecialCategory { get; set; }
    public bool AutomatedDecisions { get; set; }
    public bool CardholderData { get; set; }
    // Applicable frameworks/regulations
    public bool Gdpr { get; set; }
    public bool Pci { get; set; }
    public bool Iso { get; set; }
    public bool AiAct { get; set; }
    public bool Soc2 { get; set; }
    public bool Nis2 { get; set; }
    // Product & sustainability regulations
    public bool Dpp { get; set; }     // Digital Product Passport (ESPR)
    public bool Ppwr { get; set; }    // Packaging & Packaging Waste Regulation
    public bool Eudr { get; set; }    // EU Deforestation Regulation
    // EU AI Act classification + ISO 42001 AI-management (ADR-0050). Empty tier =
    // unclassified; the deterministic engine derives obligations from the tier.
    public string AiSystemName { get; set; } = "";
    public string AiRiskTier { get; set; } = "";    // prohibited | high | limited | minimal
    public bool AiAnnexIii { get; set; }             // Annex III high-risk use case
    public bool AiHumanOversight { get; set; }       // Art 14 — human oversight in place
    public bool AiTransparency { get; set; }         // Art 50/13 — users informed they interact with AI
}

public class SecurityControl
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Code { get; set; } = default!;        // "CTL-01"
    public string Control { get; set; } = default!;
    public string Framework { get; set; } = "ISO 27001";
    public string Evidence { get; set; } = "";
    public string Owner { get; set; } = "";
    public string Status { get; set; } = "Planned";     // Planned | Partial | Implemented | Archived
    public string Description { get; set; } = "";
    public string Reason { get; set; } = "";              // rationale / why archived or modified
    public int Ord { get; set; }
}

// One project's applicability decision for a single ISO 27001:2022 Annex A
// control (the Statement of Applicability). The control catalogue itself is
// static reference data (Soa.Catalogue); only a project's per-control decision
// — applicable? why? implementation status, owner — is persisted here. Absent
// row ⇒ the SoA baseline (applicable, "Not started") for that control.

public class SoaEntry
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Ref { get; set; } = default!;          // "A.5.1"
    public bool Applicable { get; set; } = true;
    public string Justification { get; set; } = "";      // why included / excluded
    public string Status { get; set; } = "Not started";  // Not started | Planned | Partial | Implemented
    public string Owner { get; set; } = "";
}

// A scheduled security/architecture/privacy review checkpoint for a project.

public class SecurityReviewGate
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Name { get; set; } = default!;          // e.g. "G2 Security review"
    public string Type { get; set; } = "Security";        // Security | Architecture | Privacy | Threat model | Data protection
    public string Reviewer { get; set; } = "";
    public string Status { get; set; } = "Scheduled";     // Scheduled | Passed | Failed | Waived | Not required
    public string Date { get; set; } = "";                // ISO date
    public string Note { get; set; } = "";
    public int Ord { get; set; }
}

// ---- RAID register --------------------------------------------------------

public class RaidItem
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Type { get; set; } = "Risk";        // Risk | Issue | Assumption | Dependency
    public string Title { get; set; } = default!;
    public string Owner { get; set; } = "";
    public string Status { get; set; } = "Open";
    public int Ord { get; set; }
    // Auto-raised by the system (e.g. sprint spillover) — reconciled automatically,
    // so it isn't hand-editable/deletable in the UI.
    public bool Auto { get; set; }
}

// ---- Decision log (ADR) ---------------------------------------------------

public class Decision
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Code { get; set; } = default!;       // "DEC-01"
    public string Title { get; set; } = default!;
    public string Context { get; set; } = "";
    public string DecisionText { get; set; } = "";
    public string Owner { get; set; } = "";
    public string Date { get; set; } = "";
    public string Status { get; set; } = "Proposed";    // Proposed | Approved | Rejected
    public int Ord { get; set; }
}

// ---- Program Increment Planning (PIP) -------------------------------------
// A Program Increment (PI) is a quarterly planning container spanning the whole
// portfolio (projects, programs, products, releases). It holds iterations, PI
// objectives (with a business-value score and a team confidence vote), and
// cross-team dependencies. Capacity vs load is tracked per iteration.
