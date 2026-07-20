namespace Atlas.Api;

// ============================================================================
//  Ops domain — run-the-business services and operational items.
//  (Split out of the former monolithic Domain.cs — same namespace.)
// ============================================================================

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
