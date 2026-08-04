namespace Atlas.Api;

// ============================================================================
//  Financials domain — cost lines, budget snapshots, delivery reports, KPIs.
//  (Split out of the former monolithic Domain.cs — same namespace.)
// ============================================================================

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
