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
    public string StartDate { get; set; } = "";        // display date, project start
    public string Summary { get; set; } = "";           // editable Overview summary

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

    // Jira Cloud mapping (pull-only sync). Empty/null ⇒ this project isn't linked
    // to Jira and is never touched by a sync. JiraProjectKey is the Jira project
    // key (e.g. "GIT"); JiraBoardId is the agile board to pull sprints/backlog from.
    public string JiraProjectKey { get; set; } = "";
    public int? JiraBoardId { get; set; }

    // Lifecycle. IsSystem marks seeded/demo projects — they can be archived but
    // never hard-deleted. Archived projects drop out of the active portfolio,
    // dashboards and financials but are retained (soft delete).
    public bool IsSystem { get; set; }
    public bool Archived { get; set; }

    public List<Blocker> Blockers { get; set; } = new();
}

// A stakeholder on a project's or program's power/interest matrix.
public class StakeholderEntry
{
    public int Id { get; set; }
    public string ScopeType { get; set; } = "project";   // project|program
    public string ScopeId { get; set; } = default!;
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string Power { get; set; } = "High";           // High|Low
    public string Interest { get; set; } = "High";        // High|Low
}

// A comment on a project's collaboration thread. Author/initials captured at
// post time from the caller's identity.
public class ProjectComment
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Author { get; set; } = "";
    public string Initials { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTime At { get; set; }
}

public class Blocker
{
    public string Id { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Description { get; set; } = "";
    public string ProjectId { get; set; } = default!;
    public Project? Project { get; set; }
    public string Owner { get; set; } = default!;
    public string Status { get; set; } = "Active";    // Active|In progress|Resolved|Cancelled|Archived
}

// A recorded backup run — created by "Back up all now". Metadata only; the
// downloadable snapshot is generated on demand from live data.
public class BackupRun
{
    public int Id { get; set; }
    public DateTime At { get; set; }
    public string Actor { get; set; } = "";
    public string Role { get; set; } = "";
    public long SizeBytes { get; set; }
    public int Records { get; set; }
    public string Status { get; set; } = "Completed";
}

// A block on the PMO-curated Weekly Updates news wall. Kind drives which fields
// are shown; all content fields are optional strings.
public class NewsBlock
{
    public int Id { get; set; }
    public string Kind { get; set; } = "headline"; // headline|highlight|shoutout|image|milestone|doc
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string Metric { get; set; } = "";
    public string Label { get; set; } = "";
    public string Tone { get; set; } = "good";
    public string Who { get; set; } = "";
    public string Caption { get; set; } = "";
    public string Date { get; set; } = "";
    public string Meta { get; set; } = "";
    public int Ord { get; set; }
}

// Simple operator settings (key → value), e.g. the integration/backup toggles.
public class Setting
{
    public string Key { get; set; } = default!;
    public string Value { get; set; } = "";
}

// A request to delete a project, routed to PMO/Admin for approval. Approving
// archives the project (soft delete); rejecting drops the request. Lets roles
// that can't archive directly still ask for a project to be removed.
public class DeletionRequest
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string ProjectName { get; set; } = default!;
    public string RequestedBy { get; set; } = "";
    public string RequestedRole { get; set; } = "";
    public string Date { get; set; } = "";            // display date
    public string Status { get; set; } = "Pending";
}

// Operational work (incidents, maintenance, service requests, on-call, changes)
// that can affect a project's delivery. Linked to the project it impacts; active
// high-severity items surface as deterministic risks. Source is Manual today but
// the field is connector-ready (ServiceNow / ManageEngine SDP / Jira / ADO).
public class OperationalItem
{
    public int Id { get; set; }
    public string Ref { get; set; } = default!;       // "OPS-001" or an external key
    public string Title { get; set; } = default!;
    public string Type { get; set; } = "Incident";    // Incident | Maintenance | Service request | On-call | Change
    public string Severity { get; set; } = "Medium";  // Critical | High | Medium | Low
    public string Status { get; set; } = "Open";       // Open | In progress | Resolved | Closed
    public string Source { get; set; } = "Manual";     // Manual | ServiceNow | ManageEngine SDP | Jira | Azure DevOps
    public string? ProjectId { get; set; }             // affected project (null = unlinked)
    public string Owner { get; set; } = "";
    public string Date { get; set; } = "";             // raised, display date
}

// A person assigned to a project role. RoleKey is "pm" (the project lead, set by
// PMO) or one of the architecture role keys (set by the Chief Architect). One
// row per (project, role). Person "" = unassigned, "N/A" = not applicable.
public class RoleAssignment
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string RoleKey { get; set; } = default!;
    public string Person { get; set; } = "";
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

// Review comment on a demand — Platform Admin, PMO and Chief Architect discuss a
// demand before it's approved (gated by cap-comment-demand).
public class DemandComment
{
    public int Id { get; set; }
    public string DemandId { get; set; } = default!;
    public string Author { get; set; } = "";
    public string Body { get; set; } = "";
    public string CreatedAt { get; set; } = "";        // ISO timestamp
}

// A manager-owned roster of people. Managers create sub-teams that PMs then
// attach to a project/program/product/release (see TeamAssignment).
public class SubTeam
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string ManagerKey { get; set; } = "";       // owning manager slot (teammgr/svcmgr/…)
    public string Description { get; set; } = "";
    public List<SubTeamMember> Members { get; set; } = new();
}

public class SubTeamMember
{
    public int Id { get; set; }
    public int SubTeamId { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Title { get; set; } = "";
}

// A sub-team attached to an entity, with the specific members working on it.
public class TeamAssignment
{
    public int Id { get; set; }
    public string EntityType { get; set; } = "";       // project|program|product|release
    public string EntityId { get; set; } = "";
    public int SubTeamId { get; set; }
    public List<TeamAssignmentMember> Members { get; set; } = new();
}

public class TeamAssignmentMember
{
    public int Id { get; set; }
    public int TeamAssignmentId { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Title { get; set; } = "";
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
    public string Dept { get; set; } = "";              // owning department
    public string Goal { get; set; } = default!;
    public string Status { get; set; } = default!;
    public List<string> Projects { get; set; } = new();
    public decimal Budget { get; set; }
    public decimal Spent { get; set; }
    public int Progress { get; set; }
    public string Health { get; set; } = "green";
    public string StartDate { get; set; } = "";        // display date, program start
    public string EndDate { get; set; } = "";          // display date, program target/end
    public bool Archived { get; set; }
}

public class Product
{
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Owner { get; set; } = default!;
    public string Dept { get; set; } = "";              // owning department
    public string Source { get; set; } = "jira";       // jira|ado
    public string Status { get; set; } = "Active";     // Active|Retired|Replaced (products aren't deleted)
    public string StartDate { get; set; } = "";        // display date
    public string EndDate { get; set; } = "";          // display date, end-of-life / target
    public string TeamKey { get; set; } = "";          // owning team-manager slot (teammgr/devmgr/…); "" = unassigned
    public List<string> Projects { get; set; } = new();
    public List<string> Releases { get; set; } = new();
    public List<ProductTask> Tasks { get; set; } = new();
    public List<ProductMember> Members { get; set; } = new();
    public List<ProductAllocation> Allocations { get; set; } = new();
}

// A person from an Entra team allocated to a product's delivery team. The
// member's identity is captured from the team roster at allocation time; the
// allocating manager (or Platform Admin) owns the row. Roles with access to
// products can see the allocated team — allocation itself is manager-only.
public class ProductAllocation
{
    public int Id { get; set; }
    public string ProductId { get; set; } = default!;
    public string MemberName { get; set; } = default!;
    public string MemberEmail { get; set; } = "";
    public string MemberTitle { get; set; } = "";
    public string SourceTeamKey { get; set; } = "";    // manager slot the member came from (for scope checks)
    public int Alloc { get; set; }                      // allocation % on this product
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
    public string Status { get; set; } = "Active";     // Active|Completed (objectives aren't deleted)
    public string Health { get; set; } = "green";      // manual RAG: green|amber|red (PMO / Platform Admin)
    public string StartDate { get; set; } = "";        // display date, objective start
    public string TargetDate { get; set; } = "";       // display date, horizon target (drives timeline + warnings)
    public List<KeyResult> Krs { get; set; } = new();
}

public class KeyResult
{
    public string Id { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Link { get; set; } = default!;    // display label (linked entity's name, or free text)
    public string LinkType { get; set; } = "";       // "" | project | program | product
    public string LinkId { get; set; } = "";         // id of the linked entity
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

// An Entra (Azure AD) security/M365 group, synced from the directory (or added
// manually when Graph isn't configured). The Platform Admin maps each group to a
// team-manager slot inside Atlas — the mapping lives here, never hardcoded.
public class EntraGroup
{
    public string Id { get; set; } = default!;        // Entra group object id (or "manual-…")
    public string DisplayName { get; set; } = default!;
    public string ManagerKey { get; set; } = "";      // mapped manager slot (teammgr/svcmgr/…); "" = unmapped
    public bool Manual { get; set; }                    // added by hand (no Graph)
    public string LastSynced { get; set; } = "";        // display timestamp
    public List<TeamMemberRow> Members { get; set; } = new();
}

public class TeamMemberRow
{
    public int Id { get; set; }
    public string GroupId { get; set; } = default!;
    public string Uid { get; set; } = "";                 // Entra object id — lets a re-sync upsert (not clobber) known names
    public string DisplayName { get; set; } = default!;
    public string Email { get; set; } = "";
    public string JobTitle { get; set; } = "";
}

// The management roll-up tree: each manager slot's parent, set by the Platform
// Admin. A manager sees their own teams plus every team beneath them here.
public class ManagerNode
{
    public string Key { get; set; } = default!;        // manager slot key (PK)
    public string ParentKey { get; set; } = "";        // parent manager slot; "" = top of tree
}

// ---- Notifications, subscriptions & per-user preferences -------------------
// A user's subscription to an entity's activity. UserKey is the caller's stable
// identity (Entra oid under auth; the role identity when auth is off). Entity
// events (risk, date slip, status, approvals) reach a user only if they're
// subscribed to that entity and have the event's channel switched on.
public class Subscription
{
    public int Id { get; set; }
    public string UserKey { get; set; } = default!;
    public string Email { get; set; } = "";             // captured at subscribe time (for email delivery)
    public string TargetType { get; set; } = default!;  // project|program|product
    public string TargetId { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
}

// A per-user, per-event-type channel choice. Absent → the role-aware default
// (Notifications.DefaultPref) applies, so the system works before anyone opts in.
public class NotificationPref
{
    public int Id { get; set; }
    public string UserKey { get; set; } = default!;
    public string EmailAddr { get; set; } = "";         // captured at pref-set time (for email delivery)
    public string EventType { get; set; } = default!;   // risk|date_slip|status_change|approval|created
    public bool InApp { get; set; } = true;
    public bool Email { get; set; }
}

// An in-app notification in a user's inbox. Email delivery (when the user's pref
// asks for it and Graph Mail.Send is configured) is fired at emit time; this row
// is the durable in-app copy and drives the bell's unread count.
public class Notification
{
    public int Id { get; set; }
    public string UserKey { get; set; } = default!;
    public string EventType { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Body { get; set; } = "";
    public string TargetType { get; set; } = "";
    public string TargetId { get; set; } = "";
    public bool Read { get; set; }
    public DateTime At { get; set; }
}

// A per-project override of the methodology's default "ways of working". Absent
// → the project shows the methodology default (see WaysOfWorking.For). Present →
// the edited cadence/summary/ceremonies/artifacts/roles. Lists are stored as
// simple serialised text to keep the model flat.
public class WowOverride
{
    public string ProjectId { get; set; } = default!;   // PK
    public string Cadence { get; set; } = "";
    public string Summary { get; set; } = "";
    public string CeremoniesJson { get; set; } = "[]";   // JSON: [{label,detail}]
    public string Artifacts { get; set; } = "";          // newline-delimited
    public string Roles { get; set; } = "";              // newline-delimited
}

// A scheduled delivery phase / workstream on a project's timeline (Gantt).
// Months are 0-11 within the planning year; Progress drives the complete vs
// planned fill. Seeded from the methodology scaffold, then editable.
public class Phase
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Name { get; set; } = "";
    public int StartMonth { get; set; }     // 0-11
    public int EndMonth { get; set; }        // 0-11 inclusive
    public int Progress { get; set; }        // 0-100
    public int Ord { get; set; }
}

// A key date pinned on a project's timeline.
public class Milestone
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Label { get; set; } = "";
    public int Month { get; set; }           // 0-11
    public string Date { get; set; } = "";   // display label (e.g. "Aug")
}

// A row in a project's stakeholder communication plan — which stakeholder is
// reached, through which channel, what kind of communication and on what cadence.
public class CommunicationEntry
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Stakeholder { get; set; } = "";
    public string Channel { get; set; } = "";      // Email | Teams | Meeting | Report | Slack | Call
    public string CommType { get; set; } = "";      // Status update | Steering | Escalation | Newsletter …
    public string Schedule { get; set; } = "";      // Weekly | Bi-weekly | Monthly | Quarterly | Ad-hoc
    public string Owner { get; set; } = "";
    public string Notes { get; set; } = "";
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
    public string Status { get; set; } = "Planned";    // Planned|In progress|Deployed|Rolled back|Completed|Cancelled
    public bool Archived { get; set; }
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

// ---- Project tasks (board + table) ----------------------------------------
public class ProjectTask
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Code { get; set; } = default!;        // "T-1042"
    public string Name { get; set; } = default!;
    public string Epic { get; set; } = "";
    public string Assignee { get; set; } = "";
    public string Status { get; set; } = "To Do";        // To Do | In Progress | In Review | Done | Blocked
    public string Sprint { get; set; } = "";
    public string Baseline { get; set; } = "";
    public string Priority { get; set; } = "Medium";     // Critical | High | Medium | Low
    public string StartDate { get; set; } = "";           // ISO date
    public string TargetDate { get; set; } = "";          // ISO date
    public int Points { get; set; }                       // story points
    public string Size { get; set; } = "";                // t-shirt: XS|S|M|L|XL|XXL
    public int EstimateHours { get; set; }                // estimated effort to complete
    public int Ord { get; set; }
    public string JiraKey { get; set; } = "";             // Jira issue key when synced (e.g. "GIT-123"); "" ⇒ local
}

// A comment on a task's thread. Author/initials captured at post time.
public class TaskComment
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string Author { get; set; } = "";
    public string Initials { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTime At { get; set; }
}

// A sprint (iteration) on an agile-with-sprints project. Tasks are matched to a
// sprint by name (ProjectTask.Sprint == Sprint.Name); metrics are derived from
// those tasks at read time, so the entity itself only carries the plan.
public class Sprint
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Name { get; set; } = default!;         // "PI2 · S5"
    public string Goal { get; set; } = "";
    public string StartDate { get; set; } = "";           // ISO date
    public string EndDate { get; set; } = "";             // ISO date
    public string Status { get; set; } = "Planned";       // Planned | Active | Closed
    public int CommittedPoints { get; set; }              // manual commitment; 0 ⇒ derive from tasks
    public int Ord { get; set; }
    public string JiraKey { get; set; } = "";             // Jira sprint id when synced; "" ⇒ local
}

// ---- Financial cost lines (role-owned) ------------------------------------
// Each project carries a standard set of cost lines; a line is editable only by
// the roles that own it (plus PMO/Admin). Amounts are stored in whole euros.
public class CostLine
{
    public int Id { get; set; }
    public string Scope { get; set; } = "project";        // project | program | product
    public string OwnerId { get; set; } = default!;       // the project/program/product id
    public string Kind { get; set; } = "actual";          // actual (spent to date) | forecast (at completion)
    public string Key { get; set; } = "";                 // "laborDev"… for system lines; "" for custom
    public string Label { get; set; } = default!;
    public string Note { get; set; } = "";                 // owner display, e.g. "Eng. Manager / Developers Manager"
    public List<string> OwnerRoles { get; set; } = new();  // UI role values that own this line
    public bool IsSystem { get; set; }                     // standard taxonomy line (can't be deleted)
    public decimal Amount { get; set; }
    public int Ord { get; set; }
}

// ---- Team absences (vacation calendar) ------------------------------------
public class Absence
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Person { get; set; } = default!;
    public string From { get; set; } = default!;          // ISO date "2026-07-14"
    public string To { get; set; } = default!;
    public string Type { get; set; } = "vacation";        // vacation | sick | training
    public int Ord { get; set; }
}

// ---- Project dependencies (cross-project links) ---------------------------
// A row means: project ProjectId depends on project DependsOnId (upstream).
public class ProjectDependency
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string DependsOnId { get; set; } = default!;
    public int Ord { get; set; }
}

// ---- Quality (test plans & defects) ---------------------------------------
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
public class HelpArticle
{
    public int Id { get; set; }
    public string Kind { get; set; } = "guide";          // guide | troubleshooting
    public string Audience { get; set; } = "";            // guide: admin/pmo/pm/team/exec; troubleshooting: ""
    public string Code { get; set; } = "";                // troubleshooting: NET/AUTH/VAL/SRV/INT; guide: ""
    public string Title { get; set; } = default!;
    public string Summary { get; set; } = "";             // troubleshooting: the symptom
    public string Body { get; set; } = "";                // the how-to / resolution steps
    public int Ord { get; set; }
}

// An Architecture Review Board sign-off: one per architecture role, per project.
// Each is an INDEPENDENT approval — the ARB (not the PMO) owns architectural
// correctness, so the overall verdict is the roll-up of every role's decision.
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

public class ChangeRequest
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Code { get; set; } = default!;          // "CR-01"
    public string Title { get; set; } = default!;
    public string ReqCode { get; set; } = "";
    public string Impact { get; set; } = "Medium";        // Low | Medium | High
    public string Sdp { get; set; } = "";
    public string Status { get; set; } = "Pending";       // Pending | Approved | Rejected
    public string RaisedBy { get; set; } = "";
    public string Date { get; set; } = "";
    public int Ord { get; set; }
}

// ---- Artifacts (document register + file versions) ------------------------
public class Artifact
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Type { get; set; } = "Governance";    // Governance | Waterfall | Agile | Design | Test | Other
    public string Owner { get; set; } = "";
    public string Status { get; set; } = "Draft";        // Draft | In review | Approved | Living
    public int Ord { get; set; }
    public List<ArtifactVersion> Versions { get; set; } = new();
}

public class ArtifactVersion
{
    public int Id { get; set; }
    public int ArtifactId { get; set; }
    public int Version { get; set; }                      // 1, 2, 3 …
    public string FileName { get; set; } = default!;
    public string ContentType { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public string UploadedAt { get; set; } = "";          // display date
    public byte[] Bytes { get; set; } = Array.Empty<byte>();
}

// ---- Epics ----------------------------------------------------------------
public class Epic
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Name { get; set; } = default!;
    public int Stories { get; set; }
    public int Done { get; set; }
    public string Status { get; set; } = "Upcoming";     // Complete | In progress | Upcoming | At risk
    public string DependsOn { get; set; } = "";           // legacy free-text note (still shown)
    public List<int> DependsOnIds { get; set; } = new();  // other epics in this project this one depends on
    public int Ord { get; set; }
    public string JiraKey { get; set; } = "";             // Jira epic id when synced; "" ⇒ local
}

// ---- Security, privacy & compliance ---------------------------------------
// One profile per project; controls are a per-project evidence register.
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
