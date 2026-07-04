using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record CommEntryReq(string? Stakeholder, string? Channel, string? CommType, string? Schedule, string? Owner, string? Notes);

// ============================================================================
//  Per-project extras surfaced on the Overview tab:
//   • Communication plan — stakeholder × channel × cadence rows (full CRUD).
//   • Ways of working — the methodology's ceremonies, artifacts and roles.
//     This is definitional (like the methodology library), not project data, so
//     it's computed from the project's methodology and needs no persistence.
//  Communication-plan writes require Edit on "Projects & tasks"; reads are open.
// ============================================================================
public static class ProjectExtras
{
    static CommEntryDto ToDto(CommunicationEntry e) =>
        new(e.Id, e.Stakeholder, e.Channel, e.CommType, e.Schedule, e.Owner, e.Notes);

    public static void MapProjectExtraEndpoints(this RouteGroupBuilder api)
    {
        // ---- Communication plan -------------------------------------------
        api.MapGet("/projects/{id}/comms", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-projects", "E");
            var entries = await db.CommunicationEntries.Where(e => e.ProjectId == id)
                .OrderBy(e => e.Id).Select(e => ToDto(e)).ToListAsync();
            return Results.Ok(new CommPlanDto(canEdit, entries));
        });

        api.MapPost("/projects/{id}/comms", async (string id, CommEntryReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (await db.Projects.FindAsync(id) is null) return Results.NotFound();
            var e = new CommunicationEntry
            {
                ProjectId = id,
                Stakeholder = req.Stakeholder?.Trim() ?? "",
                Channel = req.Channel?.Trim() ?? "Email",
                CommType = req.CommType?.Trim() ?? "Status update",
                Schedule = req.Schedule?.Trim() ?? "Weekly",
                Owner = req.Owner?.Trim() ?? "",
                Notes = req.Notes?.Trim() ?? "",
            };
            db.CommunicationEntries.Add(e);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Added communication entry", id));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/comms/{e.Id}", ToDto(e));
        });

        api.MapPatch("/comms/{id:int}", async (int id, CommEntryReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var e = await db.CommunicationEntries.FindAsync(id);
            if (e is null) return Results.NotFound();
            if (req.Stakeholder is not null) e.Stakeholder = req.Stakeholder.Trim();
            if (req.Channel is not null) e.Channel = req.Channel.Trim();
            if (req.CommType is not null) e.CommType = req.CommType.Trim();
            if (req.Schedule is not null) e.Schedule = req.Schedule.Trim();
            if (req.Owner is not null) e.Owner = req.Owner.Trim();
            if (req.Notes is not null) e.Notes = req.Notes.Trim();
            await db.SaveChangesAsync();
            return Results.Ok(ToDto(e));
        });

        api.MapDelete("/comms/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var e = await db.CommunicationEntries.FindAsync(id);
            if (e is null) return Results.NotFound();
            db.CommunicationEntries.Remove(e);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Removed communication entry", e.ProjectId));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- Ways of working (methodology-specific) -----------------------
        api.MapGet("/projects/{id}/ways-of-working", async (string id, AtlasDbContext db) =>
        {
            var p = await db.Projects.FindAsync(id);
            if (p is null) return Results.NotFound();
            return Results.Ok(WaysOfWorking.For(p.Methodology));
        });
    }
}

// The ceremonies / artifacts / roles that characterise each methodology. Kept in
// sync with the methodology library and the create-project scaffold so a project
// detail shows work that's coherent with how it actually runs.
public static class WaysOfWorking
{
    public static WaysOfWorkingDto For(string methodology)
    {
        return methodology switch
        {
            "Scrum" => new(methodology, "Sprints (2 weeks)",
                "Time-boxed sprints with a groomed backlog, daily coordination and an inspect-and-adapt loop.",
                new() {
                    new("Sprint planning", "Commit the sprint backlog from prioritised stories"),
                    new("Daily scrum", "15-min stand-up — yesterday / today / blockers"),
                    new("Backlog refinement", "Estimate and split upcoming stories"),
                    new("Sprint review", "Demo the increment to stakeholders"),
                    new("Retrospective", "Improve the team's way of working"),
                },
                new() { "Product backlog", "Sprint backlog", "Definition of Done", "Burndown chart", "Increment" },
                new() { "Product Owner", "Scrum Master", "Development Team" }),

            "Kanban" => new(methodology, "Continuous flow",
                "Visualise the workflow, limit work in progress and optimise for lead time.",
                new() {
                    new("Replenishment", "Pull the next-highest items into the ready queue"),
                    new("Daily flow sync", "Walk the board right-to-left, unblock work"),
                    new("Delivery cadence", "Release completed items as they finish"),
                    new("Flow review", "Inspect lead/cycle time and WIP breaches"),
                },
                new() { "Kanban board", "WIP limits", "Classes of service", "Cumulative flow diagram" },
                new() { "Service Delivery Manager", "Service Request Manager", "Team" }),

            "Scrumban" => new(methodology, "Sprint cadence + pull",
                "Scrum's cadence with Kanban's flow control — plan on an order-point trigger, limit WIP.",
                new() {
                    new("Order-point planning", "Refill the backlog when the ready queue runs low"),
                    new("Daily stand-up", "Coordinate flow and surface blockers"),
                    new("Review & retro", "Demo and improve on the sprint boundary"),
                },
                new() { "Board with WIP limits", "Ready queue", "Sprint goal", "Flow metrics" },
                new() { "Product Owner", "Team Lead", "Team" }),

            "SAFe" => new(methodology, "Program Increments (8–12 wks)",
                "Scaled Agile — Agile Release Trains deliver on a synchronised PI cadence with portfolio flow.",
                new() {
                    new("PI planning", "Whole ART plans the increment together"),
                    new("Scrum of Scrums", "Cross-team coordination and dependencies"),
                    new("System demo", "Integrated demo across all teams"),
                    new("Inspect & Adapt", "PI-level retrospective and problem-solving"),
                },
                new() { "Portfolio epics", "PI objectives", "Program board", "Architectural runway", "ART backlog" },
                new() { "Release Train Engineer", "Product Management", "System Architect", "Business Owners" }),

            "Extreme Programming" => new(methodology, "Short iterations",
                "Engineering-first agile: test-driven development, pairing and continuous integration.",
                new() {
                    new("Iteration planning", "Select stories for the iteration"),
                    new("Pair programming", "Two developers, one workstation"),
                    new("Continuous integration", "Integrate and test on every commit"),
                    new("Small releases", "Ship frequently to real users"),
                },
                new() { "User stories", "Acceptance tests", "CI pipeline", "Release plan" },
                new() { "Customer", "Developers (pairs)", "Coach", "Tracker" }),

            "Waterfall" => new(methodology, "Sequential phases",
                "Predictive delivery — each phase is completed and signed off before the next begins.",
                new() {
                    new("Phase gate reviews", "Formal sign-off between phases"),
                    new("Requirements review", "Baseline and approve the BRD"),
                    new("Design review", "Approve SDD / SAD before build"),
                    new("UAT sign-off", "Business acceptance before go-live"),
                },
                new() { "BRD", "SDD / SAD", "Test plan", "Traceability matrix", "Cutover plan" },
                new() { "Project Manager", "Business Analyst", "Solution Architect", "QA Lead" }),

            "V-Model" => new(methodology, "Verification & validation",
                "Each design stage is paired with its verification level, from unit to acceptance.",
                new() {
                    new("Test plan reviews", "Define the test level alongside each design stage"),
                    new("Verification gates", "Confirm each level before integrating up"),
                    new("Validation", "Acceptance against the original requirements"),
                },
                new() { "Requirements spec", "Test plans per level", "Design specs", "Validation report" },
                new() { "Project Manager", "Systems Engineer", "V&V Lead", "QA" }),

            "Stage-Gate" => new(methodology, "Gated phases (G0–G5)",
                "A phase-gate funnel with explicit go / kill decisions at each gate.",
                new() {
                    new("Gate reviews", "Go / hold / kill decision at each gate"),
                    new("Business case review", "Validate value before development"),
                    new("Launch review", "Readiness and post-launch plan"),
                },
                new() { "Gate deliverables", "Business case", "Scorecards", "Launch plan" },
                new() { "Gatekeepers", "Project Leader", "Cross-functional team" }),

            "Disciplined Agile" => new(methodology, "Goal-driven lifecycle",
                "A context-sensitive hybrid toolkit — choose your Way of Working against goals.",
                new() {
                    new("WoW selection", "Tailor practices to the team's context"),
                    new("Coordination meeting", "Daily team coordination"),
                    new("Increment review", "Demo and gather feedback"),
                },
                new() { "Way of Working", "Goal diagrams", "Work item list", "Solution increment" },
                new() { "Team Lead", "Product Owner", "Architecture Owner", "Team" }),

            "Iterative & Incremental" => new(methodology, "Repeating iterations",
                "Build in repeated cycles, growing scope and refining with each increment.",
                new() {
                    new("Iteration planning", "Scope the next increment"),
                    new("Increment evaluation", "Review with stakeholders and adjust"),
                },
                new() { "High-level requirements", "Iteration plan", "Increment", "Evaluation notes" },
                new() { "Project Manager", "Architect", "Team" }),

            "Spiral" => new(methodology, "Risk-driven cycles",
                "Each cycle determines objectives, evaluates and resolves risk, then builds and plans the next.",
                new() {
                    new("Objective setting", "Define objectives, alternatives, constraints"),
                    new("Risk analysis", "Identify and resolve risks, often via prototypes"),
                    new("Cycle review", "Plan the next spiral"),
                },
                new() { "Risk register", "Prototypes", "Cycle plan", "Deliverable" },
                new() { "Project Manager", "Risk Owner", "Team" }),

            "RAD" => new(methodology, "Rapid prototyping",
                "Fast prototyping and tight user feedback loops in time-boxed construction.",
                new() {
                    new("Requirements workshop", "Joint requirements planning with users"),
                    new("Prototype review", "Users react to interactive prototypes"),
                    new("Cutover", "Testing, training and go-live"),
                },
                new() { "Prototypes", "User feedback log", "Cutover checklist" },
                new() { "Users", "Developers", "Facilitator" }),

            "DevOps" => new(methodology, "Continuous delivery",
                "Continuous integration, delivery and operations with tight feedback and automation.",
                new() {
                    new("CI on commit", "Build and test on every change"),
                    new("Continuous deployment", "Automated release pipeline"),
                    new("Incident response", "On-call, postmortems and feedback"),
                },
                new() { "CI/CD pipeline", "Infrastructure as Code", "Runbooks", "Dashboards & alerts" },
                new() { "Dev", "Ops / SRE", "Release Manager" }),

            _ => new(methodology, "Iterative",
                "This project's methodology defines its own ceremonies, artifacts and cadence.",
                new() { new("Planning", "Plan the next block of work"), new("Review", "Inspect and adapt") },
                new() { "Backlog", "Plan", "Increment" },
                new() { "Project Manager", "Team" }),
        };
    }
}
