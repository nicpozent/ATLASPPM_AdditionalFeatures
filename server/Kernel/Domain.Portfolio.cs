namespace Atlas.Api;

// ============================================================================
//  Portfolio domain — programs, products, OKRs, releases, demands, blockers, roadmap.
//  (Split out of the former monolithic Domain.cs — same namespace.)
// ============================================================================

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
