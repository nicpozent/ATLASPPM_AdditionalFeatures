using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// Idempotent seed mirroring the approved prototype's demo data, so a fresh
// deployment shows the same populated portfolio the design walkthrough did.
public static class Seed
{
    public static async Task RunAsync(AtlasDbContext db)
    {
        if (await db.Projects.AnyAsync()) return; // already seeded

        db.Projects.AddRange(
            new Project { Id = "PRJ-204", Name = "E-commerce Replatform", Dept = "Digital Commerce", Owner = "Astrid Holmqvist", Methodology = "SAFe", Status = "green", Health = "On track", Progress = 68, Budget = 4200, Spent = 2700, Target = "12 Sep 2026", Phase = "Build", Due = "12 Sep 2026", Capex = 2800, Forecast = 4300, Roi = 22, LaborDev = 1600, LaborArch = 400, LaborInfra = 300, StakeholderVisible = true },
            new Project { Id = "PRJ-198", Name = "Warehouse Automation – Nässjö", Dept = "Supply Chain", Owner = "Lars Bergström", Methodology = "Waterfall", Status = "amber", Health = "At risk", Progress = 41, Budget = 9800, Spent = 5100, Target = "28 Feb 2027", Phase = "Execution", Due = "28 Feb 2027", Capex = 7200, Forecast = 10200, Roi = 15, LaborDev = 900, LaborArch = 300, LaborInfra = 1200, AttentionReason = "Conveyor hardware slipped 3 weeks · Q1 milestone at risk", AttentionSeverity = "amber" },
            new Project { Id = "PRJ-211", Name = "POS System Upgrade", Dept = "Retail Ops", Owner = "Mette Sørensen", Methodology = "Scrum", Status = "green", Health = "On track", Progress = 82, Budget = 2600, Spent = 2000, Target = "20 Jun 2026", Phase = "Rollout", Due = "20 Jun 2026", Capex = 1400, Forecast = 2550, Roi = 28, LaborDev = 1100, LaborArch = 200, LaborInfra = 250, StakeholderVisible = true },
            new Project { Id = "PRJ-176", Name = "Customer Mobile App 3.0", Dept = "Digital Commerce", Owner = "Johan Virtanen", Methodology = "Scrum", Status = "red", Health = "Critical", Progress = 34, Budget = 3100, Spent = 2900, Target = "30 Sep 2026", Phase = "Build", Due = "30 Sep 2026", Capex = 1800, Forecast = 3600, Roi = 8, LaborDev = 1500, LaborArch = 250, LaborInfra = 200, AttentionReason = "Budget 93% spent at 34% complete · crash rate up", AttentionSeverity = "red" },
            new Project { Id = "PRJ-220", Name = "Supplier Portal", Dept = "Procurement", Owner = "Ingrid Aalto", Methodology = "Kanban", Status = "green", Health = "On track", Progress = 55, Budget = 1800, Spent = 800, Target = "15 Nov 2026", Phase = "Build", Due = "15 Nov 2026", Capex = 900, Forecast = 1750, Roi = 19, LaborDev = 700, LaborArch = 150, LaborInfra = 120, StakeholderVisible = true },
            new Project { Id = "PRJ-165", Name = "Data Platform Migration", Dept = "IT & Data", Owner = "Erik Lindqvist", Methodology = "V-Model", Status = "amber", Health = "At risk", Progress = 60, Budget = 5400, Spent = 4000, Target = "10 Dec 2026", Phase = "Execution", Due = "10 Dec 2026", Capex = 3600, Forecast = 5600, Roi = 17, LaborDev = 800, LaborArch = 500, LaborInfra = 1400, AttentionReason = "Integration test coverage below target", AttentionSeverity = "amber" },
            new Project { Id = "PRJ-231", Name = "Store Network Expansion – Baltics", Dept = "Expansion", Owner = "Kaisa Nieminen", Methodology = "Stage-Gate", Status = "green", Health = "On track", Progress = 22, Budget = 12500, Spent = 1400, Target = "30 Apr 2027", Phase = "Planning", Due = "30 Apr 2027", Capex = 9800, Forecast = 12400, Roi = 24, LaborDev = 300, LaborArch = 250, LaborInfra = 400 },
            new Project { Id = "PRJ-189", Name = "Loyalty Program Revamp", Dept = "Marketing", Owner = "Petter Haugen", Methodology = "Scrumban", Status = "hold", Health = "On hold", Progress = 48, Budget = 2200, Spent = 1200, Target = "On hold", Phase = "On hold", Due = "On hold", Capex = 1000, Forecast = 2200, Roi = 12, LaborDev = 600, LaborArch = 150, LaborInfra = 150 }
        );

        db.Blockers.AddRange(
            new Blocker { Id = "BLK-051", Title = "Payment gateway certification delayed", ProjectId = "PRJ-204", Owner = "Astrid Holmqvist", Status = "Active" },
            new Blocker { Id = "BLK-052", Title = "Conveyor vendor lead time extended", ProjectId = "PRJ-198", Owner = "Lars Bergström", Status = "In progress" },
            new Blocker { Id = "BLK-053", Title = "App store review rejection – privacy manifest", ProjectId = "PRJ-176", Owner = "Johan Virtanen", Status = "Active" },
            new Blocker { Id = "BLK-054", Title = "SSO integration blocked on AD group mapping", ProjectId = "PRJ-220", Owner = "Ingrid Aalto", Status = "Active" },
            new Blocker { Id = "BLK-055", Title = "Data quality issues in legacy extract", ProjectId = "PRJ-165", Owner = "Erik Lindqvist", Status = "In progress" }
        );

        db.Demands.AddRange(
            new Demand { Id = "DM-322", Title = "Self-checkout pilot — 5 stores", Stage = "draft", Priority = "High", Value = 4, Effort = 5, Requester = "L. Bergström", Dept = "Retail Ops", Date = "Jun 23" },
            new Demand { Id = "DM-318", Title = "AI product recommendations", Stage = "draft", Priority = "Medium", Value = 5, Effort = 4, Requester = "M. Sørensen", Dept = "Digital", Date = "Jun 21" },
            new Demand { Id = "DM-326", Title = "Click & collect lockers — pilot", Stage = "draft", Priority = "Medium", Value = 3, Effort = 4, Requester = "Sofia Berg", Dept = "Retail Ops", Date = "Jun 20", Mine = true },
            new Demand { Id = "DM-309", Title = "GDPR consent overhaul", Stage = "backlog", Priority = "High", Value = 3, Effort = 4, Requester = "Legal", Dept = "Legal", Date = "Jun 14", PendingApproval = true },
            new Demand { Id = "DM-305", Title = "Supplier scorecard dashboard", Stage = "backlog", Priority = "Medium", Value = 3, Effort = 3, Requester = "E. Lindqvist", Dept = "Procurement", Date = "Jun 11" },
            new Demand { Id = "DM-330", Title = "Store dashboard for regional managers", Stage = "backlog", Priority = "Medium", Value = 4, Effort = 3, Requester = "Sofia Berg", Dept = "Retail Ops", Date = "Jun 25", Mine = true },
            new Demand { Id = "DM-292", Title = "Loyalty app push notifications", Stage = "approved", Priority = "High", Value = 4, Effort = 2, Requester = "P. Haugen", Dept = "Marketing", Date = "Jun 02", PendingApproval = true },
            new Demand { Id = "DM-288", Title = "Warehouse robotics — phase 2", Stage = "approved", Priority = "Critical", Value = 5, Effort = 5, Requester = "L. Bergström", Dept = "Supply Chain", Date = "May 30", PendingApproval = true },
            new Demand { Id = "DM-271", Title = "Data platform migration", Stage = "progress", Priority = "High", Value = 5, Effort = 4, Requester = "E. Lindqvist", Dept = "IT & Data", Date = "May 05" },
            new Demand { Id = "DM-260", Title = "POS upgrade rollout", Stage = "progress", Priority = "High", Value = 4, Effort = 4, Requester = "M. Sørensen", Dept = "Retail Ops", Date = "Apr 18" }
        );

        db.Programs.AddRange(
            new Program { Id = "PGM-01", Name = "Digital Customer Experience", Owner = "Astrid Holmqvist", Goal = "Unify the omnichannel customer journey across web, app and store.", Status = "On track", Projects = new() { "PRJ-204", "PRJ-176", "PRJ-189" }, Budget = 9500, Spent = 6800, Progress = 55, Health = "amber" },
            new Program { Id = "PGM-02", Name = "Supply Chain Modernisation", Owner = "Lars Bergström", Goal = "Automate fulfilment and improve supplier collaboration.", Status = "At risk", Projects = new() { "PRJ-198", "PRJ-220" }, Budget = 11600, Spent = 5900, Progress = 46, Health = "amber" },
            new Program { Id = "PGM-03", Name = "Data & Platform Foundation", Owner = "Erik Lindqvist", Goal = "Establish a governed data platform for analytics and AI.", Status = "On track", Projects = new() { "PRJ-165", "PRJ-211" }, Budget = 8000, Spent = 6000, Progress = 71, Health = "green" }
        );

        db.Products.AddRange(
            new Product { Id = "PRD-01", Name = "Storefront Web", Owner = "Astrid Holmqvist", Source = "jira", Projects = new() { "PRJ-204" }, Releases = new() { "REL-24.3", "REL-24.4" },
                Tasks = new() {
                    new ProductTask { TaskId = "JIRA-1204", Title = "Checkout redesign", Status = "In progress", Points = 8, DateIso = "2026-06-20", MappedRelease = "REL-24.3" },
                    new ProductTask { TaskId = "JIRA-1211", Title = "Payment gateway integration", Status = "To do", Points = 13, DateIso = "2026-07-04", MappedRelease = "REL-24.4" },
                    new ProductTask { TaskId = "JIRA-1187", Title = "Search relevance tuning", Status = "Done", Points = 5, DateIso = "2026-06-02", MappedRelease = "REL-24.3" }
                },
                Members = new() { new ProductMember { Name = "A. Holmqvist", Alloc = 40 }, new ProductMember { Name = "J. Virtanen", Alloc = 60 } } },
            new Product { Id = "PRD-02", Name = "Mobile App", Owner = "Johan Virtanen", Source = "ado", Projects = new() { "PRJ-176" }, Releases = new() { "REL-3.0" },
                Tasks = new() {
                    new ProductTask { TaskId = "ADO-882", Title = "Crash rate remediation", Status = "In progress", Points = 8, DateIso = "2026-06-18", MappedRelease = "REL-3.0" },
                    new ProductTask { TaskId = "ADO-889", Title = "Privacy manifest for App Store", Status = "To do", Points = 3, DateIso = "2026-06-28", MappedRelease = "REL-3.0" }
                },
                Members = new() { new ProductMember { Name = "J. Virtanen", Alloc = 80 } } }
        );

        db.Objectives.AddRange(
            new Objective { Id = "OKR-01", Title = "Grow digital revenue share to 35%", Owner = "Astrid Holmqvist", Horizon = "FY26",
                Krs = new() {
                    new KeyResult { Id = "KR-1", Title = "Increase online conversion to 3.2%", Link = "PRJ-204", Progress = 62 },
                    new KeyResult { Id = "KR-2", Title = "Launch app 3.0 with < 0.5% crash rate", Link = "PRJ-176", Progress = 34 }
                } },
            new Objective { Id = "OKR-02", Title = "Cut fulfilment cost per order by 12%", Owner = "Lars Bergström", Horizon = "FY26",
                Krs = new() {
                    new KeyResult { Id = "KR-3", Title = "Automate 60% of Nässjö picking", Link = "PRJ-198", Progress = 41 },
                    new KeyResult { Id = "KR-4", Title = "Onboard 200 suppliers to the portal", Link = "PRJ-220", Progress = 55 }
                } },
            new Objective { Id = "OKR-03", Title = "Establish a governed data platform", Owner = "Erik Lindqvist", Horizon = "FY26",
                Krs = new() { new KeyResult { Id = "KR-5", Title = "Migrate 100% of core datasets", Link = "PRJ-165", Progress = 60 } } }
        );

        db.Resources.AddRange(
            new Resource { Name = "Astrid Holmqvist", Role = "Head of PMO", Dept = "PMO", Initials = "AH", Color = "#0F6CBD", OpsPct = 20, ProjectPct = 60, ProductPct = 20, Over = false },
            new Resource { Name = "Johan Virtanen", Role = "Lead Developer", Dept = "Digital", Initials = "JV", Color = "#7A3FB0", OpsPct = 10, ProjectPct = 70, ProductPct = 30, Over = true },
            new Resource { Name = "Mette Sørensen", Role = "Engineering Manager", Dept = "Retail Ops", Initials = "MS", Color = "#15A34A", OpsPct = 30, ProjectPct = 50, ProductPct = 10, Over = false },
            new Resource { Name = "Erik Lindqvist", Role = "Infrastructure Manager", Dept = "IT & Data", Initials = "EL", Color = "#C98A00", OpsPct = 40, ProjectPct = 50, ProductPct = 0, Over = false },
            new Resource { Name = "Ingrid Aalto", Role = "Chief Architect", Dept = "Architecture", Initials = "IA", Color = "#0C5798", OpsPct = 25, ProjectPct = 45, ProductPct = 20, Over = false },
            new Resource { Name = "Lars Bergström", Role = "Supply Chain Lead", Dept = "Supply Chain", Initials = "LB", Color = "#D13438", OpsPct = 20, ProjectPct = 75, ProductPct = 15, Over = true }
        );

        db.Releases.AddRange(
            new Release { Id = "REL-24.3", Name = "Storefront 24.3", Reqs = 12, Crs = 3, Owner = "Astrid Holmqvist", Link = "PRD-01", Scope = "Product", Date = "2026-07-10", Env = "Production", Progress = 80, Risk = "Low", Status = "In progress" },
            new Release { Id = "REL-24.4", Name = "Storefront 24.4", Reqs = 9, Crs = 1, Owner = "Astrid Holmqvist", Link = "PRD-01", Scope = "Product", Date = "2026-08-21", Env = "Staging", Progress = 25, Risk = "Medium", Status = "Planned" },
            new Release { Id = "REL-3.0", Name = "Mobile App 3.0", Reqs = 18, Crs = 5, Owner = "Johan Virtanen", Link = "PRD-02", Scope = "Product", Date = "2026-09-30", Env = "Staging", Progress = 34, Risk = "High", Status = "In progress" },
            new Release { Id = "REL-POS-2", Name = "POS 2.0 rollout", Reqs = 7, Crs = 2, Owner = "Mette Sørensen", Link = "PRJ-211", Scope = "Project", Date = "2026-06-20", Env = "Production", Progress = 100, Risk = "Low", Status = "Deployed" },
            new Release { Id = "REL-DP-1", Name = "Data platform GA", Reqs = 14, Crs = 4, Owner = "Erik Lindqvist", Link = "PRJ-165", Scope = "Project", Date = "2026-12-10", Env = "Staging", Progress = 60, Risk = "Medium", Status = "Planned" }
        );

        db.DeliveryReports.AddRange(
            new DeliveryReport { Period = "weekly", Completed = 12, InProgress = 8, Planned = 15, Velocity = 34, VelTrend = "+3", OnTime = 88, BlockersCleared = 4, BlockersOpen = 5, Milestones = 2, BudgetBurn = "€1.2M", SpendPct = 63, Satisfaction = "Positive", CostPerDeliverable = "€24k", ValuePerEuro = "€1.8" },
            new DeliveryReport { Period = "monthly", Completed = 47, InProgress = 21, Planned = 60, Velocity = 32, VelTrend = "+2", OnTime = 84, BlockersCleared = 18, BlockersOpen = 5, Milestones = 7, BudgetBurn = "€5.1M", SpendPct = 63, Satisfaction = "Positive", CostPerDeliverable = "€26k", ValuePerEuro = "€1.7" },
            new DeliveryReport { Period = "quarterly", Completed = 134, InProgress = 40, Planned = 180, Velocity = 31, VelTrend = "+1", OnTime = 81, BlockersCleared = 52, BlockersOpen = 9, Milestones = 19, BudgetBurn = "€14.8M", SpendPct = 61, Satisfaction = "Neutral", CostPerDeliverable = "€27k", ValuePerEuro = "€1.6" },
            new DeliveryReport { Period = "half", Completed = 268, InProgress = 44, Planned = 340, Velocity = 30, VelTrend = "0", OnTime = 79, BlockersCleared = 101, BlockersOpen = 12, Milestones = 34, BudgetBurn = "€27.9M", SpendPct = 60, Satisfaction = "Neutral", CostPerDeliverable = "€28k", ValuePerEuro = "€1.6" },
            new DeliveryReport { Period = "yearly", Completed = 512, InProgress = 48, Planned = 640, Velocity = 29, VelTrend = "-1", OnTime = 82, BlockersCleared = 196, BlockersOpen = 14, Milestones = 63, BudgetBurn = "€48.2M", SpendPct = 63, Satisfaction = "Positive", CostPerDeliverable = "€29k", ValuePerEuro = "€1.7" }
        );

        db.DashboardKpis.AddRange(
            new DashboardKpi { Key = "active", Ord = 0, Value = "24", Delta = "+3", Good = true, Spark = new() { 18, 19, 20, 21, 22, 24 } },
            new DashboardKpi { Key = "ontrack", Ord = 1, Value = "71%", Delta = "+4 pts", Good = true, Spark = new() { 60, 63, 65, 67, 68, 71 } },
            new DashboardKpi { Key = "risk", Ord = 2, Value = "5", Delta = "+1", Good = false, Spark = new() { 3, 4, 4, 5, 4, 5 } },
            new DashboardKpi { Key = "demands", Ord = 3, Value = "18", Delta = "-2", Good = true, Spark = new() { 22, 21, 20, 19, 20, 18 } },
            new DashboardKpi { Key = "budget", Ord = 4, Value = "63%", Delta = "on plan", Good = true, Spark = new() { 40, 46, 51, 56, 60, 63 } }
        );

        db.ActivityEvents.AddRange(
            new ActivityEvent { Ord = 0, Who = "Astrid Holmqvist", Action = "approved demand DM-292 (Loyalty push)", Time = "2h ago", Initials = "AH", Color = "#0F6CBD" },
            new ActivityEvent { Ord = 1, Who = "Johan Virtanen", Action = "raised blocker on Mobile App 3.0", Time = "4h ago", Initials = "JV", Color = "#7A3FB0" },
            new ActivityEvent { Ord = 2, Who = "Mette Sørensen", Action = "closed sprint 24 on POS Upgrade", Time = "Yesterday", Initials = "MS", Color = "#15A34A" },
            new ActivityEvent { Ord = 3, Who = "Erik Lindqvist", Action = "updated forecast on Data Platform", Time = "Yesterday", Initials = "EL", Color = "#C98A00" }
        );

        db.MyTasks.AddRange(
            new MyTask { Ord = 0, Name = "Review checkout redesign PR", Sprint = "Sprint 25", Status = "In progress" },
            new MyTask { Ord = 1, Name = "Sign off payment gateway cert", Sprint = "Sprint 25", Status = "To do" },
            new MyTask { Ord = 2, Name = "Prepare Q3 steering deck", Sprint = "Sprint 25", Status = "To do" },
            new MyTask { Ord = 3, Name = "Triage new demands", Sprint = "Sprint 25", Status = "In progress" },
            new MyTask { Ord = 4, Name = "Close out sprint 24 retro actions", Sprint = "Sprint 24", Status = "Done" }
        );

        db.BudgetSnapshots.Add(new BudgetSnapshot
        {
            Allocated = "€48.2M", Spent = "€30.4M", SpentPct = 63,
            Months = new() { "Jan", "Feb", "Mar", "Apr", "May", "Jun" },
            Planned = new() { 6, 12, 18, 24, 30, 36 },
            Actual = new() { 5, 11, 17, 22, 27, 30 },
            Max = 48
        });

        await db.SaveChangesAsync();
    }
}
