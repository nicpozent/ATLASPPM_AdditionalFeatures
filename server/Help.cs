using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Help centre — data-driven. Role-based guides and error-category
//  troubleshooting entries are served from the database, seeded with a curated
//  baseline (reference content, like the RBAC matrix) and editable by a Platform
//  Admin. Troubleshooting entries are keyed by the error-code prefix the request
//  logger stamps on failures (SRV/INT/…), so the error UI can deep-link to them.
// ============================================================================
public static class Help
{
    // The five error categories the app surfaces, with real remediation steps.
    static readonly (string Code, string Title, string Symptom, string Body)[] Troubleshooting =
    {
        ("NET", "Connection problem",
            "The app can’t reach the server — actions hang or fail with a network error.",
            "1. Check your internet connection and retry.\n2. If you’re on VPN, confirm it’s connected.\n3. Reload the page.\n4. If it persists across the whole app, the API may be down — quote the time to your administrator, who can check the service and gateway logs."),
        ("AUTH", "Sign-in or permission issue",
            "You’re signed out unexpectedly, or an action is refused because your role lacks access.",
            "1. If asked to sign in, complete the Entra sign-in and try again.\n2. If an action says your role can’t do it, that’s by design — ask a Platform Admin to grant the capability in Administration → Roles & permissions.\n3. Admins: verify the user’s Entra app role and the roles & permissions matrix."),
        ("VAL", "Something you entered wasn’t accepted",
            "A form was rejected with a message explaining what needs fixing.",
            "1. Read the message — it names the field or rule (e.g. a required name, a valid date, an item already on the list).\n2. Correct the input and submit again.\n3. This is not a bug; no error code is issued for these."),
        ("SRV", "Unexpected error on our end",
            "An action failed with a friendly message and an error code (SRV-…).",
            "1. Try the action again — many transient errors clear on retry.\n2. If it repeats, copy the error code (SRV-…) and give it to your administrator.\n3. Admins: search the application logs for that exact code to find the full exception, request path and role."),
        ("INT", "An integration didn’t respond",
            "A connected system (Jira, Azure DevOps, Microsoft Graph, email) failed or timed out; you’ll see an INT-… code.",
            "1. The integration, not Atlas, is likely unavailable — retry shortly.\n2. Copy the error code (INT-…) for your administrator.\n3. Admins: check the connector’s credentials/consent and status in Integrations, then search the logs for the code to see the upstream response."),
    };

    // Role-based guide catalogue (title + one-line summary). Curated baseline —
    // admins expand the body and add their own from Help & Support.
    static readonly (string Audience, string Title, string Summary)[] Guides =
    {
        ("admin", "Install the application tier", "Step-by-step deployment of the API and web front end."),
        ("admin", "Configure Entra ID SSO and enforce MFA", "Wire single sign-on and require multi-factor authentication."),
        ("admin", "Schedule and test platform backups", "Set up snapshots and verify a restore."),
        ("admin", "Map AD groups to Atlas roles", "Sync directory groups and assign the manager slots."),
        ("admin", "Connect Jira & Azure DevOps", "Two-way sync and write-back configuration."),
        ("admin", "Assign people as project stakeholders", "Give stakeholders their scoped view."),
        ("admin", "Enable notification email", "Grant Mail.Send and set the sender mailbox."),
        ("pmo", "How traffic-light health is calculated", "Status roll-up including dependency risk."),
        ("pmo", "Build a custom dashboard", "Drag-and-drop widgets into your own layout."),
        ("pmo", "Run a portfolio review export", "Branded PPTX/PDF/Excel/HTML packs."),
        ("pmo", "Configure demand scoring & edit fields", "Tune the value-vs-effort intake model."),
        ("pmo", "Map a risk to a control", "Framework → control → sub-control mapping."),
        ("pmo", "Build the Weekly Updates news wall", "Themes, widgets and image uploads."),
        ("pm", "Create a project from a template", "Auto-scaffold phases, gates, epics and tasks."),
        ("pm", "Push a task to Jira or Azure DevOps", "Send a scaffolded task to your tracker."),
        ("pm", "Read velocity, capacity & backlog", "By source (Jira/ADO/SDP/API)."),
        ("pm", "Use the Resource & Sprint Gantt", "Views and filters for planning."),
        ("pm", "Track dependencies & rolled-up risk", "How dependency risk affects status."),
        ("pm", "Raise and resolve a blocker", "Log it and map it to a control."),
        ("team", "Update task status and log progress", "Move work across the board."),
        ("team", "@mention a teammate in a comment", "Collaborate and notify."),
        ("team", "Raise a blocker on your task", "Flag an impediment for help."),
        ("team", "Subscribe to notifications", "Follow the items you care about."),
        ("exec", "Read the executive dashboard", "High-level portfolio health and spend."),
        ("exec", "Approve a demand or stage gate", "Record your governance decision."),
        ("exec", "Read delivery status by period", "Weekly to yearly stakeholder reporting."),
        ("exec", "Export a board-ready status deck", "Branded organisation report."),
    };

    public static async Task SeedAsync(AtlasDbContext db)
    {
        if (await db.HelpArticles.AnyAsync()) { await ReconcileAsync(db); return; }
        var ord = 0;
        foreach (var g in Guides)
            db.HelpArticles.Add(new HelpArticle { Kind = "guide", Audience = g.Audience, Title = g.Title, Summary = g.Summary, Body = g.Summary, Ord = ord++ });
        ord = 0;
        foreach (var t in Troubleshooting)
            db.HelpArticles.Add(new HelpArticle { Kind = "troubleshooting", Code = t.Code, Title = t.Title, Summary = t.Symptom, Body = t.Body, Ord = ord++ });
        await db.SaveChangesAsync();
    }

    // Add any troubleshooting categories missing from an already-seeded DB so the
    // error-code deep links always resolve after an upgrade.
    public static async Task ReconcileAsync(AtlasDbContext db)
    {
        var have = (await db.HelpArticles.Where(a => a.Kind == "troubleshooting").Select(a => a.Code).ToListAsync()).ToHashSet();
        var ord = 100;
        var added = false;
        foreach (var t in Troubleshooting)
            if (!have.Contains(t.Code))
            {
                db.HelpArticles.Add(new HelpArticle { Kind = "troubleshooting", Code = t.Code, Title = t.Title, Summary = t.Symptom, Body = t.Body, Ord = ord++ });
                added = true;
            }
        if (added) await db.SaveChangesAsync();
    }

    static readonly string[] Kinds = { "guide", "troubleshooting" };

    static HelpArticleDto Dto(HelpArticle a) => new(a.Id, a.Kind, a.Audience, a.Code, a.Title, a.Summary, a.Body, a.Ord);

    public static void MapHelpEndpoints(this RouteGroupBuilder api)
    {
        // The whole catalogue, split by kind. Readable by anyone signed in.
        api.MapGet("/help", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var all = await db.HelpArticles.OrderBy(a => a.Ord).ThenBy(a => a.Id).ToListAsync();
            return Results.Ok(new HelpDto(
                Permissions.IsPlatformAdmin(http, cfg),
                all.Where(a => a.Kind == "guide").Select(Dto).ToList(),
                all.Where(a => a.Kind == "troubleshooting").Select(Dto).ToList()));
        });

        // The troubleshooting entry for an error code (accepts the full code or the
        // prefix — the error UI passes e.g. "SRV-3F9K2A").
        api.MapGet("/help/troubleshooting/{code}", async (string code, AtlasDbContext db) =>
        {
            var prefix = (code.Split('-')[0]).ToUpperInvariant();
            var a = await db.HelpArticles.FirstOrDefaultAsync(x => x.Kind == "troubleshooting" && x.Code == prefix);
            return a is null ? Results.NotFound() : Results.Ok(Dto(a));
        });

        // ---- Admin authoring (Platform Admin) -----------------------------
        api.MapPost("/help/articles", async (UpsertHelpReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!Permissions.IsPlatformAdmin(http, cfg)) return Results.Json(new { error = "Only a Platform Administrator can edit the help centre." }, statusCode: StatusCodes.Status403Forbidden);
            if (!Kinds.Contains(req.Kind)) return Results.BadRequest(new { error = "Kind must be ‘guide’ or ‘troubleshooting’." });
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "A title is required." });
            var a = new HelpArticle
            {
                Kind = req.Kind, Audience = req.Audience?.Trim() ?? "", Code = req.Code?.Trim().ToUpperInvariant() ?? "",
                Title = req.Title.Trim(), Summary = req.Summary?.Trim() ?? "", Body = req.Body?.Trim() ?? "",
                Ord = req.Ord ?? 999,
            };
            db.HelpArticles.Add(a);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Help", "Added article", a.Title));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/help/articles/{a.Id}", Dto(a));
        });

        api.MapPatch("/help/articles/{id:int}", async (int id, UpsertHelpReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!Permissions.IsPlatformAdmin(http, cfg)) return Results.Json(new { error = "Only a Platform Administrator can edit the help centre." }, statusCode: StatusCodes.Status403Forbidden);
            var a = await db.HelpArticles.FindAsync(id);
            if (a is null) return Results.NotFound();
            if (!string.IsNullOrWhiteSpace(req.Title)) a.Title = req.Title.Trim();
            if (req.Summary is not null) a.Summary = req.Summary.Trim();
            if (req.Body is not null) a.Body = req.Body.Trim();
            if (req.Audience is not null) a.Audience = req.Audience.Trim();
            if (req.Ord is int o) a.Ord = o;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Help", "Edited article", a.Title));
            await db.SaveChangesAsync();
            return Results.Ok(Dto(a));
        });

        api.MapDelete("/help/articles/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!Permissions.IsPlatformAdmin(http, cfg)) return Results.Json(new { error = "Only a Platform Administrator can edit the help centre." }, statusCode: StatusCodes.Status403Forbidden);
            var a = await db.HelpArticles.FindAsync(id);
            if (a is null) return Results.NotFound();
            // Keep the troubleshooting categories intact — they back the error links.
            if (a.Kind == "troubleshooting") return Results.BadRequest(new { error = "Troubleshooting categories can be edited but not deleted." });
            db.HelpArticles.Remove(a);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Help", "Deleted article", a.Title));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
