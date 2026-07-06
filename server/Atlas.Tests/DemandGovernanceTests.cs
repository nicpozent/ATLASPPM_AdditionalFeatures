using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// Demand approval is reserved for Platform Admin & PMO (cap-approve); other stage
// moves need demand-scoring edit. Comments are gated by cap-comment-demand
// (Platform Admin, PMO and — via the pmo permission role — Chief Architect).
public class DemandGovernanceTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public DemandGovernanceTests(AtlasApiFactory factory) => _factory = factory;

    async Task<HttpResponseMessage> As(string role, HttpMethod method, string path, object? body = null)
    {
        var client = _factory.CreateClient();
        var req = new HttpRequestMessage(method, path);
        req.Headers.Add("X-Atlas-Role", role);
        if (body is not null) req.Content = JsonContent.Create(body);
        return await client.SendAsync(req);
    }

    async Task<string> CreateDemandAsync()
    {
        var res = await As("admin", HttpMethod.Post, "/api/v1/demands", new { title = "Governance test demand" });
        Assert.True(res.IsSuccessStatusCode, $"create demand returned {(int)res.StatusCode}");
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetString()!;
    }

    [Fact]
    public async Task Only_admin_and_pmo_can_approve_a_demand()
    {
        var id = await CreateDemandAsync();
        // PM can move a demand through the funnel but not to "approved".
        Assert.Equal(HttpStatusCode.OK, (await As("pm", HttpMethod.Patch, $"/api/v1/demands/{id}", new { stage = "backlog" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await As("pm", HttpMethod.Patch, $"/api/v1/demands/{id}", new { stage = "approved" })).StatusCode);
        // PMO and Platform Admin can approve.
        Assert.Equal(HttpStatusCode.OK, (await As("pmo", HttpMethod.Patch, $"/api/v1/demands/{id}", new { stage = "approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await As("admin", HttpMethod.Patch, $"/api/v1/demands/{id}", new { stage = "approved" })).StatusCode);
    }

    [Fact]
    public async Task Chief_architect_can_approve_via_the_pmo_permission_role()
    {
        var id = await CreateDemandAsync();
        // The Chief Architect identity resolves to the pmo permission role.
        Assert.Equal(HttpStatusCode.OK, (await As("architect", HttpMethod.Patch, $"/api/v1/demands/{id}", new { stage = "approved" })).StatusCode);
    }

    [Fact]
    public async Task Commenting_on_a_demand_is_gated()
    {
        var id = await CreateDemandAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await As("pm", HttpMethod.Post, $"/api/v1/demands/{id}/comments", new { body = "nope" })).StatusCode);

        var admin = await As("admin", HttpMethod.Post, $"/api/v1/demands/{id}/comments", new { body = "Looks good to me." });
        Assert.Equal(HttpStatusCode.Created, admin.StatusCode);
        var architect = await As("architect", HttpMethod.Post, $"/api/v1/demands/{id}/comments", new { body = "Architecture is sound." });
        Assert.Equal(HttpStatusCode.Created, architect.StatusCode);

        // Both comments come back, with a can-comment flag for an allowed reader.
        var list = await As("admin", HttpMethod.Get, $"/api/v1/demands/{id}/comments");
        using var doc = JsonDocument.Parse(await list.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.GetProperty("canComment").GetBoolean());
        Assert.Equal(2, doc.RootElement.GetProperty("comments").GetArrayLength());
    }

    [Fact]
    public async Task An_empty_comment_is_rejected()
    {
        var id = await CreateDemandAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await As("admin", HttpMethod.Post, $"/api/v1/demands/{id}/comments", new { body = "   " })).StatusCode);
    }
}
