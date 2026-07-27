using System.Net;
using System.Net.Http.Json;
using Atlas.Api;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Atlas.Tests;

// Hosts the real API (all middleware + endpoints) against an in-memory database
// so we can assert the authorization boundary end-to-end. Auth is off (the
// default), which is exactly the mode where the X-Atlas-Role header drives the
// caller's effective role — letting us exercise every role against the seeded
// permission matrix without a real Entra token.
public class AtlasApiFactory : WebApplicationFactory<Program>
{
    // A distinct in-memory database per factory instance so test classes that
    // seed rows can't leak state into one another.
    readonly string _dbName = "atlas-tests-" + Guid.NewGuid().ToString("N");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Auth:Enabled", "false");
        builder.UseSetting("Seed:Enabled", "false");
        builder.UseSetting("OpenApi:Enabled", "false");
        builder.UseSetting("Retention:Enabled", "false");

        builder.ConfigureTestServices(services =>
        {
            // Drop the Npgsql DbContext registration and everything EF Core
            // attaches to it, then re-register the context on the in-memory
            // provider. Matching IDbContextOptionsConfiguration by name avoids
            // depending on an EF-internal generic type.
            var drop = services.Where(d =>
                d.ServiceType == typeof(DbContextOptions<AtlasDbContext>) ||
                d.ServiceType == typeof(DbContextOptions) ||
                d.ServiceType == typeof(AtlasDbContext) ||
                d.ServiceType.Name.StartsWith("IDbContextOptionsConfiguration")).ToList();
            foreach (var d in drop) services.Remove(d);

            services.AddDbContext<AtlasDbContext>(o => o.UseInMemoryDatabase(_dbName));
        });
    }
}

public class AuthorizationTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public AuthorizationTests(AtlasApiFactory factory) => _factory = factory;

    // Sends a request as a given switcher identity (null = no header, i.e. the
    // single-user dev default that has full access).
    async Task<HttpResponseMessage> As(string? role, HttpMethod method, string path, object? body = null)
    {
        var client = _factory.CreateClient();
        var req = new HttpRequestMessage(method, path);
        if (role is not null) req.Headers.Add("X-Atlas-Role", role);
        if (body is not null) req.Content = JsonContent.Create(body);
        return await client.SendAsync(req);
    }

    const int Forbidden = (int)HttpStatusCode.Forbidden;

    // ---- POST /okrs → requires Edit on cap-okrs (only admin + pmo hold it) ----

    [Theory]
    [InlineData("teammgr")]
    [InlineData("stakeholder")]
    [InlineData("pm")]
    [InlineData("Executive")]
    [InlineData("devmgr")]
    public async Task Creating_okr_is_forbidden_without_the_capability(string role)
    {
        var res = await As(role, HttpMethod.Post, "/api/v1/okrs", new { title = "Grow revenue" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("pmo")]
    public async Task Creating_okr_is_allowed_with_the_capability(string role)
    {
        var res = await As(role, HttpMethod.Post, "/api/v1/okrs", new { title = "Grow revenue" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    [Fact]
    public async Task Creating_okr_with_no_role_header_is_full_access_dev_default()
    {
        var res = await As(null, HttpMethod.Post, "/api/v1/okrs", new { title = "Dev objective" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    // ---- POST /projects → requires Full on cap-projects (admin, pmo, pm) ------

    [Theory]
    [InlineData("teammgr")]      // has Edit, not Full
    [InlineData("Executive")]      // None
    [InlineData("stakeholder")]
    public async Task Creating_project_is_forbidden_below_full(string role)
    {
        var res = await As(role, HttpMethod.Post, "/api/v1/projects", new { name = "Nope" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("pmo")]
    [InlineData("pm")]
    public async Task Creating_project_is_allowed_at_full(string role)
    {
        var res = await As(role, HttpMethod.Post, "/api/v1/projects", new { name = "Atlas rollout" });
        Assert.NotEqual(Forbidden, (int)res.StatusCode);
        Assert.True((int)res.StatusCode < 500, $"unexpected {(int)res.StatusCode}");
    }

    // ---- PATCH /products/{id} → requires Edit on cap-products (admin, pmo) ----

    [Theory]
    [InlineData("pm")]
    [InlineData("teammgr")]
    [InlineData("stakeholder")]
    public async Task Editing_product_is_forbidden_without_the_capability(string role)
    {
        var res = await As(role, HttpMethod.Patch, "/api/v1/products/PRD-1", new { owner = "X" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("pmo")]
    public async Task Editing_unknown_product_passes_authz_then_404s(string role)
    {
        // The gate lets these roles through; the product doesn't exist, so the
        // handler returns 404 — proving authorization did not block it.
        var res = await As(role, HttpMethod.Patch, "/api/v1/products/PRD-does-not-exist", new { owner = "X" });
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---- POST /demands → requires Edit on cap-submit-demand -------------------
    // Everyone can submit EXCEPT Executive (View-only there).

    [Fact]
    public async Task Executive_cannot_submit_a_demand()
    {
        var res = await As("Executive", HttpMethod.Post, "/api/v1/demands", new { title = "Request" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Theory]
    [InlineData("stakeholder")]
    [InlineData("teammgr")]
    [InlineData("pm")]
    public async Task Submitters_are_not_blocked_from_creating_a_demand(string role)
    {
        var res = await As(role, HttpMethod.Post, "/api/v1/demands", new { title = "Request" });
        Assert.NotEqual(Forbidden, (int)res.StatusCode);
        Assert.True((int)res.StatusCode < 500, $"unexpected {(int)res.StatusCode}");
    }

    // ---- Portfolio-wide reads are for internal roles only --------------------
    // The whole-portfolio lists (projects, blockers, demands, programs,
    // financials, resources) expose every entity in the org. They are gated at
    // View on cap-dashboards, which every internal role holds but the external
    // Stakeholder does not — Stakeholders reach only their own work through the
    // "/my" endpoints. (cap-dashboards is the right gate here: it is the only
    // capability where exactly the Stakeholder role is denied; cap-projects
    // would also wrongly lock out the Executive.)

    [Theory]
    [InlineData("teammgr")]
    [InlineData("pm")]
    [InlineData("Executive")]
    public async Task Listing_projects_is_open_to_internal_roles(string role)
    {
        var res = await As(role, HttpMethod.Get, "/api/v1/projects");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Theory]
    [InlineData("/api/v1/projects")]
    [InlineData("/api/v1/blockers")]
    [InlineData("/api/v1/demands")]
    [InlineData("/api/v1/programs")]
    [InlineData("/api/v1/financials")]
    [InlineData("/api/v1/resources")]
    [InlineData("/api/v1/resources/availability")]
    [InlineData("/api/v1/resources/allocation-report.xlsx")]
    [InlineData("/api/v1/dashboard")]
    [InlineData("/api/v1/okrs")]
    [InlineData("/api/v1/portfolio/gantt")]
    [InlineData("/api/v1/capacity/insight")]
    [InlineData("/api/v1/capacity/staffing")]
    [InlineData("/api/v1/assignable/all")]
    [InlineData("/api/v1/artifact-versions/1")]
    public async Task Stakeholder_cannot_read_the_whole_portfolio(string path)
    {
        var res = await As("stakeholder", HttpMethod.Get, path);
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    // The same portfolio-wide reads stay available to internal roles.
    [Theory]
    [InlineData("/api/v1/dashboard")]
    [InlineData("/api/v1/okrs")]
    [InlineData("/api/v1/portfolio/gantt")]
    [InlineData("/api/v1/capacity/insight")]
    public async Task Portfolio_reads_stay_open_to_internal_roles(string path)
    {
        var res = await As("pm", HttpMethod.Get, path);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    // ---- Per-object by-id reads: Stakeholder is scoped to what they own -------
    // The project/demand detail endpoints let a Stakeholder open only their own
    // visible items (a StakeholderVisible project, a demand they raised); an
    // internal role reads any of them, and ops detail is internal-only.
    [Fact]
    public async Task Stakeholder_by_id_reads_are_scoped_to_owned_entities()
    {
        int opsId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
            static Project P(string id, string name, bool vis) => new()
            {
                Id = id, Name = name, StakeholderVisible = vis,
                Dept = "", Due = "", Methodology = "", Owner = "", Phase = "", Target = "",
            };
            db.Projects.Add(P("OWN-VIS", "Visible", true));
            db.Projects.Add(P("OWN-HID", "Hidden", false));
            db.Demands.Add(new Demand { Id = "DM-MINE", Title = "Mine", Mine = true, Date = "", Dept = "", Requester = "" });
            db.Demands.Add(new Demand { Id = "DM-NOT", Title = "Not mine", Mine = false, Date = "", Dept = "", Requester = "" });
            var ops = new OpsItem { Title = "Op", Status = "Open" };
            db.OpsItems.Add(ops);
            await db.SaveChangesAsync();
            opsId = ops.Id;
        }

        // Stakeholder: own items readable, others' are 403 (not 404 — no id oracle).
        Assert.Equal(HttpStatusCode.OK, (await As("stakeholder", HttpMethod.Get, "/api/v1/projects/OWN-VIS")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await As("stakeholder", HttpMethod.Get, "/api/v1/projects/OWN-HID")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await As("stakeholder", HttpMethod.Get, "/api/v1/demands/DM-MINE")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await As("stakeholder", HttpMethod.Get, "/api/v1/demands/DM-NOT")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await As("stakeholder", HttpMethod.Get, $"/api/v1/ops/items/{opsId}")).StatusCode);

        // Internal role reads any of them (even the stakeholder-hidden project).
        Assert.Equal(HttpStatusCode.OK, (await As("pm", HttpMethod.Get, "/api/v1/projects/OWN-HID")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await As("pm", HttpMethod.Get, $"/api/v1/ops/items/{opsId}")).StatusCode);
    }
}
