using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end tests for the Requirements overhaul: full edit, delete, the new
// lifecycle statuses, description, and file attachments.
public class RequirementTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public RequirementTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    static async Task<string> ProjId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetString()!;
    }

    static async Task<int> IntId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Requirement_edits_description_and_lifecycle_status()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Req edit project" }));
        var reqId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/requirements", new { title = "Login", description = "User can sign in" }));

        var patch = await c.PatchAsJsonAsync($"/api/v1/requirements/{reqId}", new
        {
            title = "Single sign-on", description = "SAML/OIDC", priority = "High", status = "Retired (PM)",
        });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        var r = doc.RootElement;
        Assert.Equal("Single sign-on", r.GetProperty("title").GetString());
        Assert.Equal("SAML/OIDC", r.GetProperty("description").GetString());
        Assert.Equal("High", r.GetProperty("priority").GetString());
        Assert.Equal("Retired (PM)", r.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Unknown_status_is_rejected()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Req status project" }));
        var reqId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/requirements", new { title = "R" }));
        var res = await c.PatchAsJsonAsync($"/api/v1/requirements/{reqId}", new { status = "Cancelled" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Test_status_patch_still_sets_verified()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Req verify project" }));
        var reqId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/requirements", new { title = "R" }));
        var patch = await c.PatchAsJsonAsync($"/api/v1/requirements/{reqId}", new { testStatus = "Passed" });
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using var doc = JsonDocument.Parse(await patch.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.GetProperty("verified").GetBoolean());
    }

    [Fact]
    public async Task Requirement_can_be_deleted()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Req delete project" }));
        var reqId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/requirements", new { title = "Temp" }));
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/requirements/{reqId}")).StatusCode);
        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/requirements");
        Assert.Empty(listed.GetProperty("requirements").EnumerateArray());
    }

    [Fact]
    public async Task Attachment_can_be_uploaded_listed_and_removed()
    {
        var c = Admin();
        var projId = await ProjId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Req attach project" }));
        var reqId = await IntId(await c.PostAsJsonAsync($"/api/v1/projects/{projId}/requirements", new { title = "With file" }));

        using var form = new MultipartFormDataContent();
        var bytes = Encoding.UTF8.GetBytes("spec contents");
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        form.Add(file, "file", "spec.txt");
        var up = await c.PostAsync($"/api/v1/requirements/{reqId}/attachments", form);
        Assert.Equal(HttpStatusCode.OK, up.StatusCode);
        var attId = await IntId(up);

        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/requirements");
        var r = listed.GetProperty("requirements").EnumerateArray().First(x => x.GetProperty("id").GetInt32() == reqId);
        var atts = r.GetProperty("attachments").EnumerateArray().ToList();
        Assert.Single(atts);
        Assert.Equal("spec.txt", atts[0].GetProperty("fileName").GetString());

        var dl = await c.GetAsync($"/api/v1/requirement-attachments/{attId}");
        Assert.Equal(HttpStatusCode.OK, dl.StatusCode);
        Assert.Equal("spec contents", await dl.Content.ReadAsStringAsync());

        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/requirement-attachments/{attId}")).StatusCode);
    }

    [Fact]
    public async Task Editing_and_deleting_a_requirement_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PatchAsJsonAsync("/api/v1/requirements/999", new { title = "X" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.DeleteAsync("/api/v1/requirements/999")).StatusCode);
    }
}
