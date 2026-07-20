namespace Atlas.Api;

// ============================================================================
//  Delivery domain — projects, tasks, sprints, epics, phases, milestones, artifacts.
//  (Split out of the former monolithic Domain.cs — same namespace.)
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

public class ProjectComment
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string Author { get; set; } = "";
    public string Initials { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTime At { get; set; }
}

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

public class MyTask
{
    public int Id { get; set; }
    public int Ord { get; set; }
    public string Name { get; set; } = default!;
    public string Sprint { get; set; } = default!;
    public string Status { get; set; } = default!;
}

// Single-row budget snapshot for the dashboard budget-burn chart.

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
