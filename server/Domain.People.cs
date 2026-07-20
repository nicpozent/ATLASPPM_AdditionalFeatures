namespace Atlas.Api;

// ============================================================================
//  People & capacity domain — resources, teams, sub-teams, skills, assignments.
//  (Split out of the former monolithic Domain.cs — same namespace.)
// ============================================================================

public class RoleAssignment
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = default!;
    public string RoleKey { get; set; } = default!;
    public string Person { get; set; } = "";
}

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
