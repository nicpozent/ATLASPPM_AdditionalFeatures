using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// Projects write endpoints — split out of the former single MapAtlasWriteEndpoints god-method (R18 / #104).
// Part of the partial WriteEndpoints class; shared helpers (NextId, Clamp, HealthFor, …) stay in WriteEndpoints.cs.
public static partial class WriteEndpoints
{
    static void MapProjectWrites(RouteGroupBuilder api)
    {
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
                Target = string.IsNullOrWhiteSpace(req.Target) ? "TBD" : req.Target!.Trim(),
                StartDate = string.IsNullOrWhiteSpace(req.StartDate) ? "" : req.StartDate!.Trim(),
                Phase = "Planning", Due = string.IsNullOrWhiteSpace(req.Target) ? "TBD" : req.Target!.Trim(),
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
            await Notifications.EmitPortfolioAsync(db, cfg, Notifications.Created, $"New project: {p.Name}", $"{p.Id} · {p.Name} ({p.Dept}) was created.", "project", p.Id, Permissions.CallerKey(http, cfg));
            return Results.Created($"/api/v1/projects/{p.Id}", new ProjectDto(
                p.Id, p.Name, p.Dept, p.Owner, p.Methodology, p.Status, p.Health, p.Progress, p.Budget, p.Spent, p.Target, 0,
                p.Archived, p.IsSystem, p.StartDate));
        });

        // Edit a project's fields. Only supplied (non-null) fields change; Health
        // is kept consistent with Status. Requires Edit on "Create / edit projects".
        api.MapPatch("/projects/{id}", async (string id, UpdateProjectReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-projects", "E") is { } denied) return denied;
            var p = await db.Projects.Include(x => x.Blockers).FirstOrDefaultAsync(x => x.Id == id);
            if (p is null) return Results.NotFound();
            var (oldStatus, oldTarget, oldJiraKey) = (p.Status, p.Target, p.JiraProjectKey);

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
            if (req.StartDate is not null) p.StartDate = req.StartDate.Trim();
            if (req.Summary is not null) p.Summary = req.Summary.Trim();
            if (req.Budget is decimal b && b >= 0) p.Budget = b;
            if (req.Spent is decimal s && s >= 0) p.Spent = s;
            if (req.Forecast is decimal fc && fc >= 0) p.Forecast = fc;
            // Jira mapping (pull-only sync). Uppercase the key; a blank clears the link.
            if (req.JiraProjectKey is not null) p.JiraProjectKey = req.JiraProjectKey.Trim().ToUpperInvariant();
            if (req.JiraBoardId is int bid) p.JiraBoardId = bid > 0 ? bid : null;

            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Updated project", $"{p.Id} · {p.Name}"));
            await db.SaveChangesAsync();
            // Notify subscribers of the meaningful transitions.
            var actor = Permissions.CallerKey(http, cfg);
            if (p.Status != oldStatus && p.Status is "amber" or "red")
                await Notifications.EmitToEntityAsync(db, cfg, Notifications.Risk, "project", p.Id, $"{p.Name} is now {(p.Status == "red" ? "critical" : "at risk")}", $"{p.Id} · health is now “{p.Health}”.", actor);
            else if (p.Status != oldStatus)
                await Notifications.EmitToEntityAsync(db, cfg, Notifications.Status, "project", p.Id, $"{p.Name} status changed", $"{p.Id} · status is now “{p.Health}”.", actor);
            if (p.Target != oldTarget && !string.IsNullOrWhiteSpace(oldTarget))
                await Notifications.EmitToEntityAsync(db, cfg, Notifications.DateSlip, "project", p.Id, $"{p.Name} target date changed", $"{p.Id} · target moved from {oldTarget} to {p.Target}.", actor);
            // Auto-pull once when the Jira link is newly set/changed — the manual
            // "Sync" button stays as an on-demand force. Best-effort: a failure
            // here never blocks saving the project (surface it via the button).
            if (!string.IsNullOrEmpty(p.JiraProjectKey) && !string.Equals(p.JiraProjectKey, oldJiraKey, StringComparison.OrdinalIgnoreCase) && Jira.JiraConfigured(cfg))
            {
                try { using var jc = Jira.Client(cfg); await Jira.SyncProjectAsync(db, cfg, jc, p); }
                catch (Exception ex) { _log.LogWarning(ex, "Auto-sync after linking Jira key {Key} to project {Project} failed — the manual Sync surfaces connector errors.", p.JiraProjectKey, p.Id); }
            }
            return Results.Ok(new ProjectDto(p.Id, p.Name, p.Dept, p.Owner, p.Methodology, p.Status, p.Health,
                p.Progress, p.Budget, p.Spent, p.Target, p.Blockers.Count, p.Archived, p.IsSystem, p.StartDate));
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

            // With EnableRetryOnFailure the retrying execution strategy owns the
            // transaction boundary, so a user-initiated transaction must run inside
            // strategy.ExecuteAsync (the whole purge retries atomically on a blip).
            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
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
                await db.CommunicationEntries.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
                await db.Phases.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
                await db.Milestones.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
                await db.WowOverrides.Where(x => x.ProjectId == id).ExecuteDeleteAsync();
                db.Projects.Remove(p);
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Projects", "Deleted project", $"{p.Id} · {p.Name}"));
                await db.SaveChangesAsync();
                await tx.CommitAsync();
            });
            return Results.NoContent();
        });

    }
}
