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
    public string LastJiraSync { get; set; } = "";      // UTC "yyyy-MM-dd HH:mm" of last successful sync; drives delta pulls

    // Azure DevOps mapping (connector scaffold). AdoProject is the ADO project
    // name/id this Atlas project is linked to (org is global config: AzureDevOps:
    // Organization). Empty ⇒ not linked. Work-item sync is a follow-up; the
    // mapping is stored now so the discovery importer can wire it (see ADR-0035).
    public string AdoProject { get; set; } = "";
    public string LastAdoSync { get; set; } = "";       // UTC ISO of last successful ADO sync; drives delta (changed-since) pulls

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

// A freeform-whiteboard node (ADR-0064). Persisted as a typed row rather than a
// JSON blob so each live co-editing op is an independent single-row write (no
// read-modify-write of the whole scene → no lost updates). Scope is the canonical
// "{kind}:{id}" surface key; NodeId is the client-assigned id, unique within a
// scope. PointsJson holds a freehand "draw" polyline ([x0,y0,x1,y1,…]) as JSON.
public class WhiteboardNode
{
    public int Id { get; set; }
    public string Scope { get; set; } = "";
    public string NodeId { get; set; } = "";
    public string Kind { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public double W { get; set; }
    public double H { get; set; }
    public string? Text { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public string? PointsJson { get; set; }
}

// A freeform-whiteboard connector (ADR-0064) between two nodes in the same scope.
public class WhiteboardEdge
{
    public int Id { get; set; }
    public string Scope { get; set; } = "";
    public string EdgeId { get; set; } = "";
    public string FromNode { get; set; } = "";
    public string ToNode { get; set; } = "";
    public string? Color { get; set; }
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

// ---- Ops module (run-the-business) ----------------------------------------
// A distinct work TYPE from project delivery: standing operational services
// (support, maintenance, monitoring, infrastructure) and the run-the-business
// work items within them. Work items carry an allocation % per assignee — which
// rolls up into each person's Ops% on Resources — and may be tagged as impacting
// a specific project's outcome (ops load pulling capacity off delivery).
public class OpsService
{
    public int Id { get; set; }
    public string Ref { get; set; } = default!;        // "OPS-1" business key
    public string Name { get; set; } = default!;
    public string Category { get; set; } = "Support";  // Support | Maintenance | Monitoring | Infrastructure | Incident response | Other
    public string Dept { get; set; } = "Unassigned";
    public string Owner { get; set; } = "";
    public string Status { get; set; } = "Active";      // Active | Paused | Retired
    public string Description { get; set; } = "";
    public bool Archived { get; set; }                   // hidden from the board unless archived filter is on
    public string JiraProjectKey { get; set; } = "";     // set when the service was imported from a Jira project
    public int Ord { get; set; }
}

// Links an existing project task to an Ops service (traceability). The task's
// allocation stays with its project — the link is for visibility, so an Ops
// service can show the delivery tasks that feed it alongside manual items.
public class OpsTaskLink
{
    public int Id { get; set; }
    public int ServiceId { get; set; }      // OpsService.Id
    public int TaskId { get; set; }         // ProjectTask.Id
}

public class OpsItem
{
    public int Id { get; set; }
    public int ServiceId { get; set; }
    public string Title { get; set; } = default!;
    public string Description { get; set; } = "";
    public string Type { get; set; } = "Maintenance";   // Incident | Request | Maintenance | Monitoring | Change | Other
    public string Priority { get; set; } = "Medium";    // Critical | High | Medium | Low
    public string Status { get; set; } = "Open";         // Open | In progress | Blocked | Done
    public string Assignee { get; set; } = "";
    public int Alloc { get; set; }                       // % of assignee's capacity this consumes
    public string? ImpactProjectId { get; set; }         // project whose outcome this ops work affects (null = none)
    public string ImpactNote { get; set; } = "";         // how it affects the project
    public int Ord { get; set; }
    public string CreatedAt { get; set; } = "";          // display date
    public string JiraKey { get; set; } = "";            // source Jira issue key when imported (idempotent re-import)
    public string StartDate { get; set; } = "";          // ISO date — allocation window start ("" = open)
    public string EndDate { get; set; } = "";            // ISO date — allocation window end ("" = open)

    // ---- Rich fields carried across from Jira (empty for locally-created rows) ----
    // Mirrors ProjectTask so an Ops import is as faithful as a project import.
    public string IssueType { get; set; } = "";          // exact Jira issue type (Story | Bug | Task | Epic | …)
    public string Reporter { get; set; } = "";           // Jira reporter display name
    public string StatusName { get; set; } = "";         // exact Jira status name (e.g. "In Review", "Blocked")
    public string Resolution { get; set; } = "";         // e.g. "Done", "Won't Do"
    public List<string> Labels { get; set; } = new();
    public List<string> Components { get; set; } = new();
    public List<string> FixVersions { get; set; } = new();
    public string ParentKey { get; set; } = "";          // parent issue key (sub-tasks / stories under an epic)
    public string EpicKey { get; set; } = "";            // stable Jira epic key (survives epic renames)
    public string EpicName { get; set; } = "";           // epic display name this item belongs to
    public int Points { get; set; }                      // story points
    public int EstimateHours { get; set; }               // Jira original estimate, rounded to hours
    public int TimeSpentHours { get; set; }              // logged work (Jira timespent, rounded to hours)
    public string TargetDate { get; set; } = "";         // Jira due date (ISO)
    public string JiraCreated { get; set; } = "";        // ISO timestamp from Jira
    public string JiraUpdated { get; set; } = "";        // ISO timestamp from Jira
    public string JiraUrl { get; set; } = "";            // deep link, e.g. https://site/browse/OPS-123
    public List<OpsItemComment> Comments { get; set; } = new();
    public List<OpsItemAttachment> Attachments { get; set; } = new();
}

// A comment on an Ops work item's thread. Mirrors TaskComment; comments pulled
// from Jira carry their JiraId so re-syncs upsert rather than duplicate.
public class OpsItemComment
{
    public int Id { get; set; }
    public int OpsItemId { get; set; }
    public string Author { get; set; } = "";
    public string Initials { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTime At { get; set; }
    public string JiraId { get; set; } = "";              // Jira comment id when synced; "" ⇒ posted in Atlas
}

// A file attached to an Ops work item, mirrored from Jira. Bytes stored in the
// DB (bytea), exactly like TaskAttachment.
public class OpsItemAttachment
{
    public int Id { get; set; }
    public int OpsItemId { get; set; }
    public string JiraId { get; set; } = "";              // Jira attachment id (for idempotent re-sync)
    public string FileName { get; set; } = default!;
    public string ContentType { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public string Author { get; set; } = "";              // who attached it in Jira
    public string CreatedAt { get; set; } = "";           // ISO timestamp from Jira
    public byte[] Bytes { get; set; } = Array.Empty<byte>();
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
    public int Alloc { get; set; }                     // % of the person's capacity on this entity (canonical)
    public int AllocHours { get; set; }                // weekly hours entered (0 ⇒ allocation set directly in %); % = hours ÷ 40
    public string StartDate { get; set; } = "";        // ISO date the allocation begins ("" ⇒ open/always-on)
    public string EndDate { get; set; } = "";          // ISO date it ends ("" ⇒ open)
    // Optional extension segment — extra capacity when the work runs long, tracked
    // and rolled up separately so the original plan stays intact.
    public int ExtAlloc { get; set; }                  // % (canonical) of the extension; 0 ⇒ no extension
    public int ExtHours { get; set; }                  // weekly hours entered for the extension
    public string ExtStartDate { get; set; } = "";
    public string ExtEndDate { get; set; } = "";
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
    public int EstimateHours { get; set; }                // estimated effort to complete (Jira original estimate when synced)
    public int Ord { get; set; }
    public string JiraKey { get; set; } = "";             // Jira issue key when synced (e.g. "GIT-123"); "" ⇒ local
    public string AdoId { get; set; } = "";               // Azure DevOps work-item id when synced; "" ⇒ not from ADO

    // ---- Rich fields carried across from Jira (empty for locally-created rows) ----
    public string Description { get; set; } = "";         // plain text lifted from Jira's ADF description
    public string IssueType { get; set; } = "";           // Story | Bug | Task | Sub-task | …
    public string Reporter { get; set; } = "";            // Jira reporter display name
    public string StatusName { get; set; } = "";          // exact Jira status name (e.g. "In Review", "Blocked")
    public string Resolution { get; set; } = "";          // e.g. "Done", "Won't Do"
    public List<string> Labels { get; set; } = new();
    public List<string> Components { get; set; } = new();
    public List<string> FixVersions { get; set; } = new();
    public string ParentKey { get; set; } = "";           // parent issue key (sub-tasks / stories under an epic)
    public string EpicKey { get; set; } = "";             // stable Jira epic key (survives epic renames)
    public int TimeSpentHours { get; set; }               // logged work (Jira timespent, rounded to hours)
    public string JiraCreated { get; set; } = "";         // ISO timestamp from Jira (issue created)
    public string JiraUpdated { get; set; } = "";         // ISO timestamp from Jira (drives "last synced" freshness)
    public string StartedAt { get; set; } = "";           // ISO date work first left the backlog (earliest status change, Jira changelog)
    public string ResolvedAt { get; set; } = "";          // ISO date the issue was resolved/closed (Jira resolutiondate)
    public string JiraUrl { get; set; } = "";             // deep link, e.g. https://site/browse/GIT-123
    public List<TaskComment> Comments { get; set; } = new();
    public List<TaskAttachment> Attachments { get; set; } = new();
}

// A comment on a task's thread. Author/initials captured at post time; comments
// pulled from Jira carry their JiraId so re-syncs upsert rather than duplicate.
public class TaskComment
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string Author { get; set; } = "";
    public string Initials { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTime At { get; set; }
    public string JiraId { get; set; } = "";              // Jira comment id when synced; "" ⇒ posted in Atlas
}

// A file attached to a task, mirrored from Jira. Bytes are stored in the DB
// (bytea) exactly like ArtifactVersion / RequirementAttachment.
public class TaskAttachment
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string JiraId { get; set; } = "";              // Jira attachment id (for idempotent re-sync)
    public string FileName { get; set; } = default!;
    public string ContentType { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public string Author { get; set; } = "";              // who attached it in Jira
    public string CreatedAt { get; set; } = "";           // ISO timestamp from Jira
    public byte[] Bytes { get; set; } = Array.Empty<byte>();
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
    public string CompleteDate { get; set; } = "";        // ISO date the sprint was actually closed (Jira)
    public int BoardId { get; set; }                      // origin board id (Jira); 0 ⇒ unknown/local
    public string AdoId { get; set; } = "";               // Azure DevOps iteration identifier when synced; "" ⇒ not from ADO
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

// ---- Timeline dependencies (generic cross-entity links) -------------------
// A directed dependency drawn as an arrow on the portfolio/timeline views:
// (FromType,FromId) depends on (ToType,ToId) — To is upstream/predecessor, so the
// arrow points To → From. Types are project | program | product | release |
// sprint. Source distinguishes hand-drawn links from ones ingested from Jira
// issue links, so the sync can own its rows without clobbering manual ones.
public class TimelineDependency
{
    public int Id { get; set; }
    public string FromType { get; set; } = "project";
    public string FromId { get; set; } = default!;
    public string ToType { get; set; } = "project";
    public string ToId { get; set; } = default!;
    public string Source { get; set; } = "manual";   // manual | jira
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
    public string Description { get; set; } = "";          // plain text lifted from Jira's ADF description
    public string EpicKey { get; set; } = "";              // stable Jira epic key (e.g. "GIT-1")
    public string JiraUrl { get; set; } = "";              // deep link into Jira
    public string AdoId { get; set; } = "";               // Azure DevOps work-item id when synced; "" ⇒ not from ADO
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
public class ProgramIncrement
{
    public int Id { get; set; }
    public string Key { get; set; } = "";                // "2026-Q3"
    public string Name { get; set; } = "";               // "PI 2026.3 — Autumn"
    public string StartDate { get; set; } = "";          // ISO date
    public string EndDate { get; set; } = "";            // ISO date
    public string State { get; set; } = "Planning";      // Planning | Active | Completed | Cancelled
    public int Ord { get; set; }
    public List<PiIteration> Iterations { get; set; } = new();
    public List<PiObjective> Objectives { get; set; } = new();
    public List<PiDependency> Dependencies { get; set; } = new();
}

// One iteration (sprint-length slice) inside a PI. Capacity/Load are in points
// (or person-days) and drive the capacity-vs-load panel; both are manual inputs.
public class PiIteration
{
    public int Id { get; set; }
    public int IncrementId { get; set; }
    public string Name { get; set; } = "";               // "Iteration 1"
    public string StartDate { get; set; } = "";
    public string EndDate { get; set; } = "";
    public int Capacity { get; set; }                    // available capacity
    public int Load { get; set; }                        // planned load
    public int Ord { get; set; }
}

// A PI objective — a committed (or stretch) outcome for the increment, optionally
// linked to a deliverable. BusinessValue is the planned score (1–10), ActualValue
// the achieved score set at close; Confidence is the team's fist-of-five vote (1–5).
public class PiObjective
{
    public int Id { get; set; }
    public int IncrementId { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string EntityType { get; set; } = "";         // ""|project|program|product|release
    public string EntityId { get; set; } = "";
    public string ObjectiveLink { get; set; } = "";      // linked OKR objective id ("" ⇒ none)
    public int BusinessValue { get; set; }               // planned, 1–10
    public int ActualValue { get; set; }                 // achieved, 1–10 (set at close)
    public bool Committed { get; set; } = true;          // committed vs stretch
    public int Confidence { get; set; }                  // team vote, 1–5 (0 ⇒ not voted)
    public string Status { get; set; } = "Planned";      // Planned | In Progress | Done | Missed
    public int Ord { get; set; }
    public int? IterationId { get; set; }                // Program Board column; null ⇒ Unscheduled
}

// A cross-team dependency for the increment, linking two deliverables (or free
// text) with an owner, due date, and status.
public class PiDependency
{
    public int Id { get; set; }
    public int IncrementId { get; set; }
    public string Title { get; set; } = "";
    public string FromType { get; set; } = "";           // ""|project|program|product|release
    public string FromId { get; set; } = "";
    public string ToType { get; set; } = "";
    public string ToId { get; set; } = "";
    public string Owner { get; set; } = "";
    public string DueDate { get; set; } = "";            // ISO date
    public string Status { get; set; } = "Identified";   // Identified | Committed | Resolved | Blocked
    public int Ord { get; set; }
}

// ---- Skills matrix (customizable competency grid, My Team) ----------------
// Skills are the customizable columns; a rating is one person's level (0–4) on
// one skill. Ratings key on the person's display name (the roster comes from the
// Entra directory), so they survive a re-sync.
public class Skill
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int Ord { get; set; }
    public string Team { get; set; } = "";              // owning manager slot (teammgr/svcmgr/…); "" = shared/legacy, visible to every manager
}
public class SkillRating
{
    public int Id { get; set; }
    public int SkillId { get; set; }
    public string Person { get; set; } = "";
    public int Level { get; set; }                      // 0 none · 1–2 working · 3 proficient · 4 expert
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

// A user's saved Custom-dashboard widget layout (per person, server-side so it
// follows them across devices instead of living in one browser's localStorage).
public class DashboardLayout
{
    public string UserKey { get; set; } = default!;   // Permissions.CallerKey
    public string Widgets { get; set; } = "";          // JSON array of { uid, key }
}

// ---- Roadmap ---------------------------------------------------------------
// A strategic roadmap initiative. Lives in one of three horizon lanes
// (Now/Next/Later) AND carries optional start/end dates so the same items
// render on a time-based timeline. Confidence, effort & value support
// prioritisation; milestones, dependencies and cross-entity links tie the
// initiative to the delivery portfolio (OKRs, projects, programs, products,
// releases). Locally authored — never fabricated seed data.
public class RoadmapItem
{
    public int Id { get; set; }
    public string Ref { get; set; } = default!;         // "RM-1" business key
    public string Title { get; set; } = default!;
    public string Description { get; set; } = "";
    public string Lane { get; set; } = "Now";            // Now | Next | Later
    public int PlannedYear { get; set; }                 // calendar year for the "By year" view; 0 = unscheduled
    public string Status { get; set; } = "Proposed";     // Proposed | Committed | In progress | Done | Cancelled
    public string Theme { get; set; } = "";              // free-text strategic theme / swimlane
    public string Owner { get; set; } = "";
    public string StartDate { get; set; } = "";          // timeline start (ISO date, "" = undated)
    public string EndDate { get; set; } = "";            // timeline end
    public int Confidence { get; set; } = 60;            // 0..100 % delivery confidence
    public int Effort { get; set; } = 3;                 // 1..5 (t-shirt-ish)
    public int Value { get; set; } = 3;                  // 1..5 strategic value
    public int Ord { get; set; }
    public string CreatedAt { get; set; } = "";          // display date
    public List<RoadmapMilestone> Milestones { get; set; } = new();
    public List<RoadmapLink> Links { get; set; } = new();
}

public class RoadmapMilestone
{
    public int Id { get; set; }
    public int ItemId { get; set; }
    public string Title { get; set; } = default!;
    public string Date { get; set; } = "";               // ISO date
    public bool Done { get; set; }
    public int Ord { get; set; }
}

// A directed dependency between two roadmap items (ItemId depends on DependsOnItemId).
public class RoadmapDependency
{
    public int Id { get; set; }
    public int ItemId { get; set; }
    public int DependsOnItemId { get; set; }
}

// A link from a roadmap item to a portfolio entity (OKR, project, program,
// product or release). Label snapshots the entity name for display.
public class RoadmapLink
{
    public int Id { get; set; }
    public int ItemId { get; set; }
    public string EntityType { get; set; } = "";         // okr | project | program | product | release
    public string EntityId { get; set; } = "";
    public string Label { get; set; } = "";
}
