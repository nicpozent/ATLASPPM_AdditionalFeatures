using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Methodology templates — the per-methodology scaffold a new project starts
//  from, mirrored verbatim from the approved prototype's templateScaffold.
//  Creating a project "from a template" MATERIALISES these into real records so
//  each methodology genuinely differs: predictive methodologies get phase/gate
//  stages, agile ones get an epic + starter tasks, hybrids a mix.
//    gate  → Gate (G0, G1 … under Governance)
//    epic  → Epic (Epics tab)
//    phase → Epic (a phase is a delivery stage / grouping)
//    task | story | spike | iter → ProjectTask (Tasks board)
// ============================================================================
public static class Templates
{
    static readonly Dictionary<string, (string Type, string Title)[]> Scaffolds = new()
    {
        // ----- Traditional / Predictive -----
        ["Waterfall"] = new[]
        {
            ("phase", "Requirements — gather & sign off (BRD)"),
            ("phase", "System & software design (SDD/SAD)"),
            ("phase", "Implementation / build"),
            ("phase", "Verification — system & UAT testing"),
            ("phase", "Deployment & cutover"),
            ("phase", "Maintenance & support"),
        },
        ["V-Model"] = new[]
        {
            ("phase", "Requirements analysis ↔ Acceptance test plan"),
            ("phase", "System design ↔ System test plan"),
            ("phase", "Architectural design ↔ Integration test plan"),
            ("phase", "Module design ↔ Unit test plan"),
            ("phase", "Coding / implementation"),
            ("phase", "Validation — unit → integration → system → acceptance"),
        },
        ["Stage-Gate"] = new[]
        {
            ("gate", "Gate 0 — Discovery / idea screen"),
            ("gate", "Gate 1 — Scoping"),
            ("gate", "Gate 2 — Business case & build plan"),
            ("gate", "Gate 3 — Development"),
            ("gate", "Gate 4 — Testing & validation"),
            ("gate", "Gate 5 — Launch & post-launch review"),
        },
        // ----- Agile -----
        ["Scrum"] = new[]
        {
            ("epic", "Product backlog & vision"),
            ("task", "Sprint 0 — environment & board setup"),
            ("task", "Define Definition of Done & working agreement"),
            ("story", "Sprint 1 planning & backlog refinement"),
            ("task", "Ceremonies — daily scrum, review, retrospective"),
            ("task", "Set sprint length & velocity baseline"),
        },
        ["Kanban"] = new[]
        {
            ("task", "Design the board & map the workflow"),
            ("task", "Set WIP limits per column"),
            ("task", "Define classes of service & pull policies"),
            ("epic", "Backlog intake & prioritisation"),
            ("task", "Establish cadences (replenishment, delivery)"),
            ("task", "Track flow metrics — lead & cycle time"),
        },
        ["Extreme Programming"] = new[]
        {
            ("epic", "User stories & release plan"),
            ("task", "Set up pair programming & shared ownership"),
            ("task", "Test-Driven Development (write tests first)"),
            ("task", "Continuous integration pipeline"),
            ("task", "Small, frequent releases"),
            ("task", "Continuous refactoring & simple design"),
        },
        // ----- Scaled & Hybrid -----
        ["SAFe"] = new[]
        {
            ("epic", "Portfolio epics & lean business case"),
            ("task", "Form Agile Release Train & assign teams"),
            ("epic", "PI 1 objectives"),
            ("task", "PI planning event"),
            ("spike", "Architectural runway spike"),
            ("task", "System demo & Inspect & Adapt workshop"),
        },
        ["Scrumban"] = new[]
        {
            ("epic", "Backlog & board setup"),
            ("task", "Set WIP limits on the board"),
            ("task", "Order-point trigger for planning"),
            ("story", "Sprint cadence planning"),
            ("task", "Pull policy & ready queue"),
            ("task", "Reviews & flow metrics"),
        },
        ["Disciplined Agile"] = new[]
        {
            ("phase", "Inception — align scope, stakeholders, funding"),
            ("task", "Choose Way of Working (lifecycle & practices)"),
            ("phase", "Construction — build the solution incrementally"),
            ("task", "Goal-driven process decisions"),
            ("phase", "Transition — release into production"),
            ("task", "Ongoing — guided continuous improvement"),
        },
        // ----- SDLC Models -----
        ["Iterative & Incremental"] = new[]
        {
            ("phase", "Initial planning & high-level requirements"),
            ("iter", "Iteration 1 — core increment"),
            ("iter", "Iteration 2 — extend & refine"),
            ("task", "Evaluate increment with stakeholders"),
            ("iter", "Iteration N — remaining scope"),
            ("task", "Final integration & release"),
        },
        ["Spiral"] = new[]
        {
            ("task", "Cycle 1 — determine objectives & constraints"),
            ("spike", "Identify & resolve risks (prototype)"),
            ("task", "Develop & verify the deliverable"),
            ("task", "Plan the next cycle"),
            ("task", "Cycle 2 — refine with reduced risk"),
            ("task", "Release readiness review"),
        },
        ["RAD"] = new[]
        {
            ("phase", "Requirements planning workshop"),
            ("task", "User design — interactive prototyping"),
            ("task", "Rapid construction (timeboxed)"),
            ("task", "User feedback & refine prototype"),
            ("phase", "Cutover — testing, training, go-live"),
        },
        ["DevOps"] = new[]
        {
            ("task", "Continuous integration pipeline"),
            ("task", "Continuous delivery / deployment pipeline"),
            ("task", "Infrastructure as Code"),
            ("task", "Automated testing & quality gates"),
            ("task", "Monitoring & observability"),
            ("task", "Feedback loop & incident response"),
        },
    };

    public static IReadOnlyList<(string Type, string Title)> For(string methodology) =>
        Scaffolds.TryGetValue(methodology, out var s) ? s : Scaffolds["Scrum"];

    // Materialise the methodology's scaffold into a freshly-created project. Adds
    // entities to the context; the caller SaveChanges once so it commits with the
    // project in a single transaction. Assumes the project has no children yet.
    public static async Task ApplyAsync(AtlasDbContext db, string projectId, string methodology)
    {
        var items = For(methodology);
        var existingCodes = await db.ProjectTasks.Select(t => t.Code).ToListAsync();
        var taskNum = existingCodes.Select(c => int.TryParse(c.Split('-').Last(), out var n) ? n : 0)
            .DefaultIfEmpty(1041).Max();
        int epicOrd = 0, taskOrd = 0;

        foreach (var (type, title) in items)
        {
            // Delivery stages — phases, epics and Stage-Gate's own gate stages —
            // become Epics. (The universal G0–G5 governance rail is separate and
            // seeded for every project, so we never touch it here.)
            if (type is "phase" or "epic" or "gate")
                db.Epics.Add(new Epic { ProjectId = projectId, Name = title, Status = "Upcoming", Ord = epicOrd++ });
            else // task | story | spike | iter
                db.ProjectTasks.Add(new ProjectTask
                {
                    ProjectId = projectId, Code = $"T-{++taskNum}", Name = title,
                    Status = "To Do", Priority = "Medium", Assignee = "Unassigned", Ord = taskOrd++,
                });
        }

        // Lay the delivery stages out on the timeline as sequential phases across
        // the 12-month planning year, so the Gantt is coherent with the chosen
        // methodology from day one. Progress starts at 0 (all planned) — no
        // fabricated completion.
        // Prefer genuine delivery stages; but agile scaffolds are mostly tasks with
        // one epic, so if there are too few stages, lay every scaffold item out as a
        // sequential phase — a coherent starting timeline rather than one giant bar.
        var stages = items.Where(i => i.Type is "phase" or "epic" or "gate" or "iter").Select(i => i.Title).ToList();
        if (stages.Count < 2) stages = items.Select(i => i.Title).ToList();
        for (int i = 0; i < stages.Count; i++)
        {
            int start = i * 12 / stages.Count;
            int end = Math.Max(start, (i + 1) * 12 / stages.Count - 1);
            db.Phases.Add(new Phase
            {
                ProjectId = projectId, Name = stages[i],
                StartMonth = Math.Clamp(start, 0, 11), EndMonth = Math.Clamp(end, 0, 11),
                Progress = 0, Ord = i,
            });
        }
    }

    // Exposes a scaffold to the frontend so the wizard preview and what actually
    // gets created come from one source of truth.
    public static void MapTemplateEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/methodologies/{name}/scaffold", (string name) =>
            Results.Ok(For(name).Select(i => new ScaffoldItemDto(i.Type, i.Title)).ToList()));
    }
}
