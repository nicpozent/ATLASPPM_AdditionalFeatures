namespace Atlas.Api;

// ============================================================================
//  Planning domain — Program Increment planning and ways-of-working overrides.
//  (Split out of the former monolithic Domain.cs — same namespace.)
// ============================================================================

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
