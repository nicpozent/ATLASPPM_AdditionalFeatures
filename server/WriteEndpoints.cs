using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ---- Request bodies --------------------------------------------------------
public record CreateDemandReq(
    string Title, string? Dept, string? Priority, int? Value, int? Effort,
    // IT Request & Innovation intake form
    string? Description, string? Source, List<string>? GeoImpact, bool? HasDeadline, string? Deadline,
    string? BusinessProblem, bool? ImprovementExisting, int? Criticality, int? Risk,
    string? ExpectedBenefits, int? BenefitValue, List<string>? Stakeholders, bool? AllStakeholders);
public record UpdateDemandStageReq(string Stage);
public record CreateBlockerReq(string Title, string ProjectId, string? Owner, string? Status);
public record UpdateBlockerStatusReq(string Status);
public record CreateProjectReq(string Name, string? Dept, string? Owner, string? Methodology, bool? ApplyTemplate);
public record UpdateProjectReq(string? Name, string? Dept, string? Owner, string? Methodology,
    string? Status, int? Progress, string? Phase, string? Target, decimal? Budget, decimal? Spent, decimal? Forecast);
public record CreateProgramReq(string Name, string? Owner, string? Goal, string? Status, List<string>? Projects);
public record CreateProductReq(string Name, string? Owner, string? Source, List<string>? Projects);
public record CreateReleaseReq(string Name, string? Owner, string? Link, string? Scope, string? Date, string? Env, string? Risk);
public record CreateObjectiveReq(string Title, string? Owner, string? Horizon);
public record CreateKrReq(string Title, string? Link, int? Progress);
public record UpdateKrProgressReq(int Progress);

public static class WriteEndpoints
{
    static readonly string[] Stages = { "draft", "backlog", "approved", "progress", "hold" };
    static readonly string[] BlockerStatuses = { "Active", "In progress", "Resolved" };
    static readonly string[] Statuses = { "green", "amber", "red", "hold" };

    // Keep the display Health string consistent with the traffic-light Status.
    static string HealthFor(string status) => status switch
    {
        "green" => "On track", "amber" => "At risk", "red" => "Critical", "hold" => "On hold", _ => "On track",
    };

    // Who may delete a demand: anyone when auth is off (single-user dev), else the
    // creator or a Platform Administrator. Identity/role helpers live in Rbac.
    static bool CanDelete(Demand d, ClaimsPrincipal u, bool authEnabled) =>
        !authEnabled || Rbac.IsPlatformAdmin(u) || (!string.IsNullOrEmpty(d.CreatedBy) && d.CreatedBy == Rbac.CallerId(u));

    public static void MapAtlasWriteEndpoints(this RouteGroupBuilder api)
    {
        // ---- Demands -------------------------------------------------------
        api.MapPost("/demands", async (CreateDemandReq req, AtlasDbContext db, ClaimsPrincipal user, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-submit-demand", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var authEnabled = cfg.GetValue("Auth:Enabled", false);
            var criticality = req.Criticality is >= 1 and <= 5 ? req.Criticality.Value : 0;
            // Priority follows criticality when the intake form supplied it, else the explicit priority.
            var priority = criticality > 0
                ? new[] { "Low", "Low", "Medium", "High", "Critical" }[criticality - 1]
                : Clamp(req.Priority, new[] { "High", "Medium", "Critical", "Low" }, "Medium");
            var benefit = req.BenefitValue is >= 1 and <= 5 ? req.BenefitValue.Value : (req.Value ?? 3);
            var d = new Demand
            {
                Id = await NextId(db.Demands.Select(x => x.Id), "DM-", db),
                Title = req.Title.Trim(),
                Dept = string.IsNullOrWhiteSpace(req.Dept) ? "Unassigned" : req.Dept!.Trim(),
                Priority = priority,
                Value = Math.Clamp(benefit, 1, 5),                    // funnel "value" = benefit rank
                Effort = Math.Clamp(req.Effort ?? 3, 1, 5),
                Stage = "draft",
                Requester = "You",
                Mine = true,
                Date = DateTime.UtcNow.ToString("MMM dd"),
                Description = req.Description?.Trim() ?? "",
                Source = req.Source ?? "",
                GeoImpact = req.GeoImpact ?? new(),
                HasDeadline = req.HasDeadline ?? false,
                Deadline = req.Deadline,
                BusinessProblem = req.BusinessProblem?.Trim() ?? "",
                ImprovementExisting = req.ImprovementExisting ?? false,
                Criticality = criticality,
                Risk = req.Risk is >= 1 and <= 5 ? req.Risk.Value : 0,
                ExpectedBenefits = req.ExpectedBenefits?.Trim() ?? "",
                BenefitValue = req.BenefitValue is >= 1 and <= 5 ? req.BenefitValue.Value : 0,
                Stakeholders = req.Stakeholders ?? new(),
                AllStakeholders = req.AllStakeholders ?? false,
                CreatedBy = authEnabled ? Rbac.CallerId(user) : "",
            };
            db.Demands.Add(d);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Demands", "Created demand", d.Id));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/demands/{d.Id}",
                new DemandDto(d.Id, d.Title, d.Stage, d.Priority, d.Value, d.Effort, d.Requester, d.Dept, d.Date));
        });

        // Full demand incl. intake fields + attachment metadata.
        api.MapGet("/demands/{id}", async (string id, AtlasDbContext db, ClaimsPrincipal user, IConfiguration cfg) =>
        {
            var d = await db.Demands.Include(x => x.Attachments).FirstOrDefaultAsync(x => x.Id == id);
            if (d is null) return Results.NotFound();
            var authEnabled = cfg.GetValue("Auth:Enabled", false);
            return Results.Ok(new DemandDetailDto(
                d.Id, d.Title, d.Stage, d.Priority, d.Value, d.Effort, d.Requester, d.Dept, d.Date,
                d.Description, d.Source, d.GeoImpact, d.HasDeadline, d.Deadline, d.BusinessProblem,
                d.ImprovementExisting, d.Criticality, d.Risk, d.ExpectedBenefits, d.BenefitValue,
                d.Stakeholders, d.AllStakeholders,
                d.Attachments.Select(a => new AttachmentDto(a.Id, a.FileName, a.ContentType, a.Size)).ToList(),
                CanDelete(d, user, authEnabled)));
        });

        // Upload one or more attachments (multipart) to a demand.
        api.MapPost("/demands/{id}/attachments", async (string id, HttpContext http, AtlasDbContext db, IConfiguration cfg) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-submit-demand", "E") is { } denied) return denied;
            if (!http.Request.HasFormContentType) return Results.BadRequest(new { error = "Expected multipart/form-data." });
            var d = await db.Demands.FindAsync(id);
            if (d is null) return Results.NotFound();
            var form = await http.Request.ReadFormAsync();
            var saved = new List<AttachmentDto>();
            foreach (var file in form.Files)
            {
                if (file.Length <= 0) continue;
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms);
                var att = new DemandAttachment
                {
                    DemandId = id,
                    FileName = Path.GetFileName(file.FileName),
                    ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                    Size = file.Length,
                    Bytes = ms.ToArray(),
                };
                db.DemandAttachments.Add(att);
                saved.Add(new AttachmentDto(0, att.FileName, att.ContentType, att.Size));
            }
            await db.SaveChangesAsync();
            return Results.Ok(saved);
        });

        // Download an attachment's bytes.
        api.MapGet("/attachments/{attId:int}", async (int attId, AtlasDbContext db) =>
        {
            var a = await db.DemandAttachments.FindAsync(attId);
            return a is null ? Results.NotFound() : Results.File(a.Bytes, a.ContentType, a.FileName);
        });

        api.MapPatch("/demands/{id}", async (string id, UpdateDemandStageReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-demand-scoring", "E") is { } denied) return denied;
            if (!Stages.Contains(req.Stage)) return Results.BadRequest(new { error = "Unknown stage." });
            var d = await db.Demands.FindAsync(id);
            if (d is null) return Results.NotFound();
            d.Stage = req.Stage;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Demands", $"Advanced demand to {req.Stage}", d.Id));
            await db.SaveChangesAsync();
            return Results.Ok(new DemandDto(d.Id, d.Title, d.Stage, d.Priority, d.Value, d.Effort, d.Requester, d.Dept, d.Date));
        });

        api.MapDelete("/demands/{id}", async (string id, AtlasDbContext db, ClaimsPrincipal user, IConfiguration cfg, HttpContext http) =>
        {
            var d = await db.Demands.FindAsync(id);
            if (d is null) return Results.NotFound();
            // You can delete your own initiatives; Platform Admins can delete any.
            if (!CanDelete(d, user, cfg.GetValue("Auth:Enabled", false))) return Results.Forbid();
            db.Demands.Remove(d);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Demands", "Deleted demand", id));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- Blockers ------------------------------------------------------
        api.MapPost("/blockers", async (CreateBlockerReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var project = await db.Projects.FindAsync(req.ProjectId);
            if (project is null) return Results.BadRequest(new { error = "Unknown projectId." });
            var b = new Blocker
            {
                Id = await NextId(db.Blockers.Select(x => x.Id), "BLK-", db),
                Title = req.Title.Trim(),
                ProjectId = req.ProjectId,
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? project.Owner : req.Owner!.Trim(),
                Status = Clamp(req.Status, BlockerStatuses, "Active"),
            };
            db.Blockers.Add(b);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Blockers", "Raised blocker", $"{b.Id} ({project.Name})"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/blockers/{b.Id}",
                new BlockerDto(b.Id, b.Title, b.ProjectId, project.Name, b.Owner, b.Status));
        });

        api.MapPatch("/blockers/{id}", async (string id, UpdateBlockerStatusReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (!BlockerStatuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });
            var b = await db.Blockers.Include(x => x.Project).FirstOrDefaultAsync(x => x.Id == id);
            if (b is null) return Results.NotFound();
            b.Status = req.Status;
            await db.SaveChangesAsync();
            return Results.Ok(new BlockerDto(b.Id, b.Title, b.ProjectId, b.Project!.Name, b.Owner, b.Status));
        });

        // ---- Projects ------------------------------------------------------
        api.MapPost("/projects", async (CreateProjectReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var p = new Project
            {
                Id = await NextId(db.Projects.Select(x => x.Id), "PRJ-", db),
                Name = req.Name.Trim(),
                Dept = string.IsNullOrWhiteSpace(req.Dept) ? "Unassigned" : req.Dept!.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                Methodology = string.IsNullOrWhiteSpace(req.Methodology) ? "Scrum" : req.Methodology!.Trim(),
                Status = "green", Health = "On track", Progress = 0,
                Target = "TBD", Phase = "Planning", Due = "TBD",
            };
            db.Projects.Add(p);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Created project", $"{p.Id} · {p.Name}"));
            // From the methodology wizard: seed the project with its methodology's
            // scaffold (phases/gates/epics/tasks) so each methodology differs.
            if (req.ApplyTemplate == true)
            {
                await Templates.ApplyAsync(db, p.Id, p.Methodology);
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Applied methodology template", $"{p.Id} · {p.Methodology}"));
            }
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/projects/{p.Id}", new ProjectDto(
                p.Id, p.Name, p.Dept, p.Owner, p.Methodology, p.Status, p.Health, p.Progress, p.Budget, p.Spent, p.Target, 0,
                p.Archived, p.IsSystem));
        });

        // Edit a project's fields. Only supplied (non-null) fields change; Health
        // is kept consistent with Status. Requires Edit on "Create / edit projects".
        api.MapPatch("/projects/{id}", async (string id, UpdateProjectReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var p = await db.Projects.Include(x => x.Blockers).FirstOrDefaultAsync(x => x.Id == id);
            if (p is null) return Results.NotFound();

            if (!string.IsNullOrWhiteSpace(req.Name)) p.Name = req.Name!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Dept)) p.Dept = req.Dept!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Owner)) p.Owner = req.Owner!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Methodology)) p.Methodology = req.Methodology!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Status) && Statuses.Contains(req.Status))
            {
                p.Status = req.Status!;
                p.Health = HealthFor(p.Status);
            }
            if (req.Progress is int pr) p.Progress = Math.Clamp(pr, 0, 100);
            if (!string.IsNullOrWhiteSpace(req.Phase)) p.Phase = req.Phase!.Trim();
            if (!string.IsNullOrWhiteSpace(req.Target)) { p.Target = req.Target!.Trim(); p.Due = p.Target; }
            if (req.Budget is decimal b && b >= 0) p.Budget = b;
            if (req.Spent is decimal s && s >= 0) p.Spent = s;
            if (req.Forecast is decimal fc && fc >= 0) p.Forecast = fc;

            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Updated project", $"{p.Id} · {p.Name}"));
            await db.SaveChangesAsync();
            return Results.Ok(new ProjectDto(p.Id, p.Name, p.Dept, p.Owner, p.Methodology, p.Status, p.Health,
                p.Progress, p.Budget, p.Spent, p.Target, p.Blockers.Count, p.Archived, p.IsSystem));
        });

        // Archive / restore a project (soft delete). Archived projects drop out of
        // the active portfolio, dashboards and financials but are fully retained.
        api.MapPost("/projects/{id}/archive", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var p = await db.Projects.FindAsync(id);
            if (p is null) return Results.NotFound();
            p.Archived = true;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Archived project", $"{p.Id} · {p.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        api.MapPost("/projects/{id}/unarchive", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var p = await db.Projects.FindAsync(id);
            if (p is null) return Results.NotFound();
            p.Archived = false;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Restored project", $"{p.Id} · {p.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Hard delete — Platform Administrator only, and never for seeded/demo
        // (system) projects. Purges all child rows in one transaction, since only
        // Blockers cascade via FK. Intended for cleaning up test projects.
        api.MapDelete("/projects/{id}", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            if (!Permissions.IsPlatformAdmin(http, cfg))
                return Results.Json(new { error = "Only a Platform Administrator can permanently delete a project." },
                    statusCode: StatusCodes.Status403Forbidden);
            var p = await db.Projects.FindAsync(id);
            if (p is null) return Results.NotFound();
            if (p.IsSystem)
                return Results.Json(new { error = "Seeded projects cannot be deleted — archive them instead." },
                    statusCode: StatusCodes.Status400BadRequest);

            await using var tx = await db.Database.BeginTransactionAsync();
            var artifactIds = await db.Artifacts.Where(a => a.ProjectId == id).Select(a => a.Id).ToListAsync();
            var gateIds = await db.Gates.Where(g => g.ProjectId == id).Select(g => g.Id).ToListAsync();
            await db.ArtifactVersions.Where(v => artifactIds.Contains(v.ArtifactId)).ExecuteDeleteAsync();
            await db.GateCriteria.Where(c => gateIds.Contains(c.GateId)).ExecuteDeleteAsync();
            await db.Blockers.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.ProjectTasks.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.Epics.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.Artifacts.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.Requirements.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.ChangeRequests.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.Gates.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.Decisions.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.RaidItems.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.SecurityControls.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.SecurityProfiles.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.ArchProfiles.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.AdmPhases.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.TestPlans.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.Defects.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.ProjectDependencies.Where(x => x.ProjectId == id || x.DependsOnId == id).ExecuteDeleteAsync();
            await db.Absences.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.CostLines.Where(x => x.Scope == "project" && x.OwnerId == id).ExecuteDeleteAsync();
            await db.OperationalItems.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.RoleAssignments.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            await db.DeletionRequests.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
            db.Projects.Remove(p);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Deleted project", $"{p.Id} · {p.Name}"));
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.NoContent();
        });

        // ---- Programs ------------------------------------------------------
        api.MapPost("/programs", async (CreateProgramReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var pg = new Program
            {
                Id = await NextId(db.Programs.Select(x => x.Id), "PGM-", db),
                Name = req.Name.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                Goal = req.Goal?.Trim() ?? "",
                Status = string.IsNullOrWhiteSpace(req.Status) ? "On track" : req.Status!.Trim(),
                Projects = req.Projects ?? new(),
                Health = "green",
            };
            db.Programs.Add(pg);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Programs", "Created program", $"{pg.Id} · {pg.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/programs/{pg.Id}", new ProgramDto(
                pg.Id, pg.Name, pg.Owner, pg.Goal, pg.Status, pg.Projects, pg.Budget, pg.Spent, pg.Progress, pg.Health));
        });

        // ---- Products ------------------------------------------------------
        api.MapPost("/products", async (CreateProductReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "F") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var p = new Product
            {
                Id = await NextId(db.Products.Select(x => x.Id), "PRD-", db),
                Name = req.Name.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                Source = req.Source == "ado" ? "ado" : "jira",
                Projects = req.Projects ?? new(),
            };
            db.Products.Add(p);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Products", "Created product", $"{p.Id} · {p.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/products/{p.Id}", new ProductDto(
                p.Id, p.Name, p.Owner, p.Source, p.Projects, new List<TaskDto>(), new List<MemberDto>(), new List<string>()));
        });

        // ---- Releases ------------------------------------------------------
        api.MapPost("/releases", async (CreateReleaseReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var scope = new[] { "Product", "Project", "Program" }.Contains(req.Scope) ? req.Scope! : "Product";
            var r = new Release
            {
                Id = await NextId(db.Releases.Select(x => x.Id), "REL-", db),
                Name = req.Name.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                Link = req.Link?.Trim() ?? "",
                Scope = scope,
                Date = req.Date?.Trim() ?? "",
                Env = string.IsNullOrWhiteSpace(req.Env) ? "Staging" : req.Env!.Trim(),
                Risk = string.IsNullOrWhiteSpace(req.Risk) ? "Low" : req.Risk!.Trim(),
                Status = "Planned",
            };
            db.Releases.Add(r);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Releases", "Created release", $"{r.Id} · {r.Name}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/releases/{r.Id}", new ReleaseDto(
                r.Id, r.Name, r.Reqs, r.Crs, r.Owner, r.Link, r.Scope, r.Date, r.Env, r.Progress, r.Risk, r.Status));
        });

        // ---- OKRs ----------------------------------------------------------
        api.MapPost("/okrs", async (CreateObjectiveReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var o = new Objective
            {
                Id = await NextId(db.Objectives.Select(x => x.Id), "OKR-", db),
                Title = req.Title.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                Horizon = string.IsNullOrWhiteSpace(req.Horizon) ? "FY26" : req.Horizon!.Trim(),
            };
            db.Objectives.Add(o);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "OKRs", "Created objective", $"{o.Id} · {o.Title}"));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/okrs/{o.Id}",
                new ObjectiveDto(o.Id, o.Title, o.Owner, o.Horizon, new List<KrDto>()));
        });

        api.MapPost("/okrs/{id}/krs", async (string id, CreateKrReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "Title is required." });
            var obj = await db.Objectives.FindAsync(id);
            if (obj is null) return Results.NotFound();
            var kr = new KeyResult
            {
                Id = await NextId(db.KeyResults.Select(x => x.Id), "KR-", db),
                Title = req.Title.Trim(),
                Link = req.Link?.Trim() ?? "",
                Progress = Math.Clamp(req.Progress ?? 0, 0, 100),
                ObjectiveId = id,
            };
            db.KeyResults.Add(kr);
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/okrs/{id}/krs/{kr.Id}",
                new KrDto(kr.Id, kr.Title, kr.Link, kr.Progress));
        });

        api.MapPatch("/krs/{id}", async (string id, UpdateKrProgressReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var kr = await db.KeyResults.FindAsync(id);
            if (kr is null) return Results.NotFound();
            kr.Progress = Math.Clamp(req.Progress, 0, 100);
            await db.SaveChangesAsync();
            return Results.Ok(new KrDto(kr.Id, kr.Title, kr.Link, kr.Progress));
        });
    }

    // Next sequential id for a prefix (e.g. "DM-" -> "DM-331"), based on the
    // max numeric suffix currently stored. Small tables, so a materialize is fine.
    static async Task<string> NextId(IQueryable<string> ids, string prefix, AtlasDbContext _)
    {
        var existing = await ids.ToListAsync();
        var max = existing
            .Select(x => int.TryParse(x.Split('-').Last(), out var n) ? n : 0)
            .DefaultIfEmpty(0).Max();
        return $"{prefix}{max + 1}";
    }

    static string Clamp(string? value, string[] allowed, string fallback)
        => value is not null && allowed.Contains(value) ? value : fallback;
}
