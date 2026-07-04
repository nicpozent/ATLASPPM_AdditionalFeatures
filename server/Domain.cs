namespace Atlas.Api;

// ============================================================================
//  Domain entities — the relational model persisted in PostgreSQL. Endpoints
//  project these to the presentation DTOs the frontend expects (see Dtos.cs).
// ============================================================================

public class Project
{
    public string Id { get; set; } = default!;      // e.g. "PRJ-204"
    public string Name { get; set; } = default!;
    public string Dept { get; set; } = default!;
    public string Owner { get; set; } = default!;
    public string Methodology { get; set; } = default!;
    public string Status { get; set; } = "green";    // green|amber|red|hold
    public string Health { get; set; } = "On track";
    public int Progress { get; set; }
    public decimal Budget { get; set; }               // in thousands of EUR
    public decimal Spent { get; set; }
    public string Target { get; set; } = default!;    // display date, e.g. "12 Sep 2026"
    public string Phase { get; set; } = default!;
    public string Due { get; set; } = default!;

    // Financials breakdown (feeds /financials).
    public decimal Capex { get; set; }
    public decimal Forecast { get; set; }
    public decimal Roi { get; set; }
    public decimal LaborDev { get; set; }
    public decimal LaborArch { get; set; }
    public decimal LaborInfra { get; set; }

    // Dashboard "needs attention" (null = not flagged).
    public string? AttentionReason { get; set; }
    public string? AttentionSeverity { get; set; }    // red|amber

    // Stakeholder visibility (feeds /projects/my for the demo stakeholder).
    public bool StakeholderVisible { get; set; }

    public List<Blocker> Blockers { get; set; } = new();
}

public class Blocker
{
    public string Id { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string ProjectId { get; set; } = default!;
    public Project? Project { get; set; }
    public string Owner { get; set; } = default!;
    public string Status { get; set; } = "Active";    // Active|In progress|Resolved
}

public class Demand
{
    public string Id { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Stage { get; set; } = "draft";      // draft|backlog|approved|progress|hold
    public string Priority { get; set; } = "Medium";  // High|Medium|Critical|Low
    public int Value { get; set; }
    public int Effort { get; set; }
    public string Requester { get; set; } = default!;
    public string Dept { get; set; } = default!;
    public string Date { get; set; } = default!;      // display date, e.g. "Jun 23"
    public bool Mine { get; set; }                     // feeds /demands/my
    public bool PendingApproval { get; set; }          // feeds dashboard approvals
    public string CreatedBy { get; set; } = "";        // owner id (Entra oid/upn); "" when auth off

    // --- IT Request & Innovation intake form -------------------------------
    public string Description { get; set; } = "";
    public string Source { get; set; } = "";           // business|regulatory|internal
    public List<string> GeoImpact { get; set; } = new();
    public bool HasDeadline { get; set; }
    public string? Deadline { get; set; }              // ISO date when HasDeadline
    public string BusinessProblem { get; set; } = "";
    public bool ImprovementExisting { get; set; }
    public int Criticality { get; set; }               // 1..5
    public int Risk { get; set; }                      // 1..5 (risk of NOT doing it)
    public string ExpectedBenefits { get; set; } = "";
    public int BenefitValue { get; set; }              // 1..5
    public List<string> Stakeholders { get; set; } = new();
    public bool AllStakeholders { get; set; }
    public List<DemandAttachment> Attachments { get; set; } = new();
}

public class DemandAttachment
{
    public int Id { get; set; }
    public string DemandId { get; set; } = default!;
    public string FileName { get; set; } = default!;
    public string ContentType { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public byte[] Bytes { get; set; } = Array.Empty<byte>();
}

// ---- Roles & permissions (in-app RBAC) ------------------------------------
// The permission matrix on Admin → Roles & Permissions is DB-backed: the six
// canonical roles + capability catalogue ship as reference data (IsSystem), and
// a Platform Administrator can add custom roles and edit any cell. This is the
// app's own authorization layer — Entra app roles stay a small, stable set and
// are NOT written from here (see the "New role" guidance in the UI).
public class RoleDef
{
    public string Id { get; set; } = default!;        // slug, e.g. "admin" or "role-7"
    public string Name { get; set; } = default!;      // "Platform Administrator"
    public string Short { get; set; } = "";           // column header, e.g. "Admin"
    public string Who { get; set; } = "";             // "IT / Platform team"
    public string Description { get; set; } = "";
    public string Icon { get; set; } = "shield";
    public string Color { get; set; } = "#11163A";
    public string Tint { get; set; } = "#E6EAF5";
    public bool IsSystem { get; set; }                 // canonical role — cannot be deleted
    public int Sort { get; set; }
    public List<RolePermission> Permissions { get; set; } = new();
}

public class Capability
{
    public string Key { get; set; } = default!;        // slug, e.g. "demands.approve"
    public string Label { get; set; } = default!;      // "Approve demands & gates"
    public int Sort { get; set; }
}

public class RolePermission
{
    public int Id { get; set; }
    public string RoleId { get; set; } = default!;
    public string CapabilityKey { get; set; } = default!;
    public string Level { get; set; } = "N";           // F(ull) | E(dit) | V(iew) | N(one)
}

public class Program
{
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Owner { get; set; } = default!;
    public string Goal { get; set; } = default!;
    public string Status { get; set; } = default!;
    public List<string> Projects { get; set; } = new();
    public decimal Budget { get; set; }
    public decimal Spent { get; set; }
    public int Progress { get; set; }
    public string Health { get; set; } = "green";
}

public class Product
{
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Owner { get; set; } = default!;
    public string Source { get; set; } = "jira";       // jira|ado
    public List<string> Projects { get; set; } = new();
    public List<string> Releases { get; set; } = new();
    public List<ProductTask> Tasks { get; set; } = new();
    public List<ProductMember> Members { get; set; } = new();
}

public class ProductTask
{
    public int Id { get; set; }
    public string TaskId { get; set; } = default!;     // e.g. "JIRA-1204"
    public string Title { get; set; } = default!;
    public string Status { get; set; } = default!;
    public int Points { get; set; }
    public string DateIso { get; set; } = default!;
    public string MappedRelease { get; set; } = "";
    public string ProductId { get; set; } = default!;
}

public class ProductMember
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;
    public int Alloc { get; set; }
    public string ProductId { get; set; } = default!;
}

public class Objective
{
    public string Id { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Owner { get; set; } = default!;
    public string Horizon { get; set; } = default!;
    public List<KeyResult> Krs { get; set; } = new();
}

public class KeyResult
{
    public string Id { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Link { get; set; } = default!;
    public int Progress { get; set; }
    public string ObjectiveId { get; set; } = default!;
}

public class Resource
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;
    public string Role { get; set; } = default!;
    public string Dept { get; set; } = default!;
    public string Initials { get; set; } = default!;
    public string Color { get; set; } = default!;
    public int OpsPct { get; set; }
    public int ProjectPct { get; set; }
    public int ProductPct { get; set; }
    public bool Over { get; set; }
}

public class Release
{
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;
    public int Reqs { get; set; }
    public int Crs { get; set; }
    public string Owner { get; set; } = default!;
    public string Link { get; set; } = default!;
    public string Scope { get; set; } = "Product";     // Product|Project|Program
    public string Date { get; set; } = default!;
    public string Env { get; set; } = default!;
    public int Progress { get; set; }
    public string Risk { get; set; } = default!;
    public string Status { get; set; } = "Planned";    // Planned|In progress|Deployed|Rolled back
}

public class DeliveryReport
{
    public string Period { get; set; } = default!;     // weekly|monthly|quarterly|half|yearly (PK)
    public int Completed { get; set; }
    public int InProgress { get; set; }
    public int Planned { get; set; }
    public int Velocity { get; set; }
    public string VelTrend { get; set; } = default!;
    public int OnTime { get; set; }
    public int BlockersCleared { get; set; }
    public int BlockersOpen { get; set; }
    public int Milestones { get; set; }
    public string BudgetBurn { get; set; } = default!;
    public int SpendPct { get; set; }
    public string Satisfaction { get; set; } = default!;
    public string CostPerDeliverable { get; set; } = default!;
    public string ValuePerEuro { get; set; } = default!;
}

// Dashboard presentation extras (time-series / curated content that isn't
// derivable from the core tables).
public class DashboardKpi
{
    public string Key { get; set; } = default!;        // PK, e.g. "active"
    public int Ord { get; set; }
    public string Value { get; set; } = default!;
    public string Delta { get; set; } = default!;
    public bool Good { get; set; }
    public List<int> Spark { get; set; } = new();
}

public class ActivityEvent
{
    public int Id { get; set; }
    public int Ord { get; set; }
    public string Who { get; set; } = default!;
    public string Action { get; set; } = default!;
    public string Time { get; set; } = default!;
    public string Initials { get; set; } = default!;
    public string Color { get; set; } = default!;
}

public class MyTask
{
    public int Id { get; set; }
    public int Ord { get; set; }
    public string Name { get; set; } = default!;
    public string Sprint { get; set; } = default!;
    public string Status { get; set; } = default!;
}

// Single-row budget snapshot for the dashboard budget-burn chart.
public class BudgetSnapshot
{
    public int Id { get; set; }
    public string Allocated { get; set; } = default!;  // "€48.2M"
    public string Spent { get; set; } = default!;
    public int SpentPct { get; set; }
    public List<string> Months { get; set; } = new();
    public List<int> Planned { get; set; } = new();
    public List<int> Actual { get; set; } = new();
    public int Max { get; set; }
}

// ---- Stage gates (G0–G5 governance) ---------------------------------------
// Each project carries the standard six-gate rail; the gate names & criteria
// labels are the reference framework (structural), while status/date/criteria
// completion are real per-project governance data.
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

// ---- Audit log ------------------------------------------------------------
// Append-only record of governance-relevant actions (role & permission changes,
// creates/deletes). Written from the write endpoints; read on Admin → Audit Log.
public class AuditEvent
{
    public int Id { get; set; }
    public DateTime At { get; set; }                    // UTC
    public string Actor { get; set; } = "";             // signed-in user (or role in dev)
    public string Role { get; set; } = "";              // resolved role id
    public string Category { get; set; } = "";          // "Roles" | "Demands" | "Projects" | …
    public string Action { get; set; } = "";            // "Created role", "Advanced demand", …
    public string Target { get; set; } = "";            // affected object (id/name)
}
