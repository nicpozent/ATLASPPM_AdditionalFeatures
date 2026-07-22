namespace Atlas.Api;

// ============================================================================
//  Platform domain — settings, RBAC, backups, audit, help, whiteboard, layouts.
//  (Split out of the former monolithic Domain.cs — same namespace.)
// ============================================================================

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

// A user's UI theme preference, saved server-side so the chosen theme follows
// them across devices (the client falls back to localStorage when signed out).
// One row per user, keyed by Permissions.CallerKey. See ADR-0076.
public class ThemePref
{
    public string UserKey { get; set; } = default!;   // Permissions.CallerKey
    public string Theme { get; set; } = "light";       // theme id (theme.ts ThemeId)
}

// ---- Roadmap ---------------------------------------------------------------
// A strategic roadmap initiative. Lives in one of three horizon lanes
// (Now/Next/Later) AND carries optional start/end dates so the same items
// render on a time-based timeline. Confidence, effort & value support
// prioritisation; milestones, dependencies and cross-entity links tie the
// initiative to the delivery portfolio (OKRs, projects, programs, products,
// releases). Locally authored — never fabricated seed data.
