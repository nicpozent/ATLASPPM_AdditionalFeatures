using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// Products write endpoints — split out of the former single MapAtlasWriteEndpoints god-method (R18 / #104).
// Part of the partial WriteEndpoints class; shared helpers (NextId, Clamp, HealthFor, …) stay in WriteEndpoints.cs.
public static partial class WriteEndpoints
{
    static void MapProductWrites(RouteGroupBuilder api)
    {
        // ---- Products ------------------------------------------------------
        api.MapPost("/products", async (CreateProductReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-products", "F") is { } denied) return denied;
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { error = "Name is required." });
            var p = new Product
            {
                Id = await NextId(db.Products.Select(x => x.Id), "PRD-", db),
                Name = req.Name.Trim(),
                Owner = string.IsNullOrWhiteSpace(req.Owner) ? "Unassigned" : req.Owner!.Trim(),
                // Manually-created products are tagged "manual", not a tracker.
                Source = req.Source is "ado" or "jira" ? req.Source! : "manual",
                StartDate = req.StartDate?.Trim() ?? "",
                EndDate = req.EndDate?.Trim() ?? "",
                TeamKey = Teams.IsValidSlot(req.TeamKey) ? req.TeamKey! : "",
                Dept = Departments.Normalize(req.Dept),
                Projects = req.Projects ?? new(),
            };
            db.Products.Add(p);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Products", "Created product", $"{p.Id} · {p.Name}"));
            await db.SaveChangesAsync();
            await Notifications.EmitPortfolioAsync(db, cfg, Notifications.Created, $"New product: {p.Name}", $"{p.Id} · {p.Name} was created.", "product", p.Id, Permissions.CallerKey(http, cfg));
            return Results.Created($"/api/v1/products/{p.Id}", new ProductDto(
                p.Id, p.Name, p.Owner, p.Source, p.Projects, new List<TaskDto>(), new List<MemberDto>(), new List<string>(),
                p.Status, p.StartDate, p.EndDate, true, p.TeamKey, Teams.SlotLabel(p.TeamKey), 0, p.Dept));
        });

        // Update a product's linked projects/releases and its start/end dates.
        // Only supplied fields change. Requires Edit on Products.
        api.MapPatch("/products/{id}", async (string id, UpdateProductReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-products", "E") is { } denied) return denied;
            var p = await db.Products.FindAsync(id);
            if (p is null) return Results.NotFound();
            if (req.Projects is not null) p.Projects = req.Projects.Select(x => x.Trim()).Where(x => x.Length > 0).Distinct().ToList();
            if (req.Releases is not null) p.Releases = req.Releases.Select(x => x.Trim()).Where(x => x.Length > 0).Distinct().ToList();
            if (req.StartDate is not null) p.StartDate = req.StartDate.Trim();
            if (req.EndDate is not null) p.EndDate = req.EndDate.Trim();
            if (!string.IsNullOrWhiteSpace(req.Owner)) p.Owner = req.Owner!.Trim();
            if (req.Dept is not null) p.Dept = Departments.Normalize(req.Dept);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Products", "Updated product", $"{p.Id} · {p.Name}"));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

    }
}
