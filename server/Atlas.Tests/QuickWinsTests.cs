using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// End-to-end tests for the "quick win" endpoints: linking/unlinking a program's
// projects after creation, and changing an artifact's status after creation.
public class QuickWinsTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public QuickWinsTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    static async Task<string> Id(HttpResponseMessage res, string prop = "id")
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty(prop).GetString()!;
    }

    [Fact]
    public async Task Program_projects_can_be_linked_and_unlinked_after_creation()
    {
        var c = Admin();

        var projRes = await c.PostAsJsonAsync("/api/v1/projects", new { name = "Linkable project" });
        Assert.Equal(HttpStatusCode.Created, projRes.StatusCode);
        var projId = await Id(projRes);

        var progRes = await c.PostAsJsonAsync("/api/v1/programs", new { name = "Prog", owner = "O", goal = "G" });
        Assert.Equal(HttpStatusCode.Created, progRes.StatusCode);
        var progId = await Id(progRes);

        // Link the project.
        var patch = await c.PatchAsJsonAsync($"/api/v1/programs/{progId}", new { projects = new[] { projId } });
        Assert.True(patch.IsSuccessStatusCode, $"link PATCH returned {(int)patch.StatusCode}");

        var listed = await c.GetFromJsonAsync<JsonElement>("/api/v1/programs");
        var prog = listed.EnumerateArray().First(p => p.GetProperty("id").GetString() == progId);
        Assert.Contains(prog.GetProperty("projects").EnumerateArray().Select(x => x.GetString()), x => x == projId);

        // Unlink (empty set).
        var patch2 = await c.PatchAsJsonAsync($"/api/v1/programs/{progId}", new { projects = Array.Empty<string>() });
        Assert.True(patch2.IsSuccessStatusCode);
        var listed2 = await c.GetFromJsonAsync<JsonElement>("/api/v1/programs");
        var prog2 = listed2.EnumerateArray().First(p => p.GetProperty("id").GetString() == progId);
        Assert.Empty(prog2.GetProperty("projects").EnumerateArray());
    }

    [Fact]
    public async Task Linking_a_nonexistent_project_is_filtered_out()
    {
        var c = Admin();
        var progId = await Id(await c.PostAsJsonAsync("/api/v1/programs", new { name = "P2", owner = "O", goal = "G" }));
        await c.PatchAsJsonAsync($"/api/v1/programs/{progId}", new { projects = new[] { "PRJ-does-not-exist" } });
        var listed = await c.GetFromJsonAsync<JsonElement>("/api/v1/programs");
        var prog = listed.EnumerateArray().First(p => p.GetProperty("id").GetString() == progId);
        Assert.Empty(prog.GetProperty("projects").EnumerateArray());
    }

    [Fact]
    public async Task Artifact_status_can_be_changed_after_creation()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Artifact project" }));

        var artRes = await c.PostAsJsonAsync($"/api/v1/projects/{projId}/artifacts", new { name = "SAD", status = "Draft" });
        Assert.Equal(HttpStatusCode.Created, artRes.StatusCode);
        using var artDoc = JsonDocument.Parse(await artRes.Content.ReadAsStringAsync());
        var artId = artDoc.RootElement.GetProperty("id").GetInt32();

        var ok = await c.PatchAsJsonAsync($"/api/v1/artifacts/{artId}", new { status = "Approved" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        using var okDoc = JsonDocument.Parse(await ok.Content.ReadAsStringAsync());
        Assert.Equal("Approved", okDoc.RootElement.GetProperty("status").GetString());

        var bad = await c.PatchAsJsonAsync($"/api/v1/artifacts/{artId}", new { status = "Nonsense" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }

    [Fact]
    public async Task Changing_artifact_status_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");   // no cap-artifacts Edit
        var res = await c.PatchAsJsonAsync("/api/v1/artifacts/999", new { status = "Approved" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Posted_comment_is_listed_back()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Comment project" }));

        var post = await c.PostAsJsonAsync($"/api/v1/projects/{projId}/comments", new { body = "First comment" });
        Assert.Equal(HttpStatusCode.Created, post.StatusCode);

        var listed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/comments");
        var arr = listed.GetProperty("comments").EnumerateArray().ToList();
        Assert.Single(arr);
        Assert.Equal("First comment", arr[0].GetProperty("body").GetString());
        Assert.False(string.IsNullOrEmpty(arr[0].GetProperty("author").GetString()));
    }

    [Fact]
    public async Task Empty_comment_is_rejected()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "P" }));
        var res = await c.PostAsJsonAsync($"/api/v1/projects/{projId}/comments", new { body = "  " });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Posting_a_comment_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");   // lacks cap-artifacts Edit
        var res = await c.PostAsJsonAsync("/api/v1/projects/PRJ-x/comments", new { body = "hi" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Project_summary_can_be_edited()
    {
        var c = Admin();
        var projId = await Id(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Summary project" }));
        var patch = await c.PatchAsJsonAsync($"/api/v1/projects/{projId}", new { summary = "Delivers the new billing platform." });
        Assert.True(patch.IsSuccessStatusCode);

        var detail = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}");
        Assert.Equal("Delivers the new billing platform.", detail.GetProperty("summary").GetString());
    }

    [Fact]
    public async Task Stakeholder_can_be_added_listed_and_removed()
    {
        var c = Admin();
        var add = await c.PostAsJsonAsync("/api/v1/stakeholder-matrix/project/PRJ-1", new { name = "Jane", role = "Sponsor", power = "High", interest = "Low" });
        Assert.Equal(HttpStatusCode.Created, add.StatusCode);
        using var addDoc = JsonDocument.Parse(await add.Content.ReadAsStringAsync());
        var sid = addDoc.RootElement.GetProperty("id").GetInt32();

        var listed = await c.GetFromJsonAsync<JsonElement>("/api/v1/stakeholder-matrix/project/PRJ-1");
        var arr = listed.GetProperty("stakeholders").EnumerateArray().ToList();
        Assert.Single(arr);
        Assert.Equal("High", arr[0].GetProperty("power").GetString());

        var del = await c.DeleteAsync($"/api/v1/stakeholder-matrix/{sid}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
        var after = await c.GetFromJsonAsync<JsonElement>("/api/v1/stakeholder-matrix/project/PRJ-1");
        Assert.Empty(after.GetProperty("stakeholders").EnumerateArray());
    }

    [Fact]
    public async Task Stakeholder_scopes_are_isolated_and_validated()
    {
        var c = Admin();
        await c.PostAsJsonAsync("/api/v1/stakeholder-matrix/program/PGM-9", new { name = "Bob" });
        var proj = await c.GetFromJsonAsync<JsonElement>("/api/v1/stakeholder-matrix/project/PGM-9");
        Assert.Empty(proj.GetProperty("stakeholders").EnumerateArray());   // program entry not seen under project scope

        var bad = await c.PostAsJsonAsync("/api/v1/stakeholder-matrix/nonsense/X", new { name = "Z" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }

    [Fact]
    public async Task Adding_a_stakeholder_needs_edit_rights()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "stakeholder");   // no cap-projects Edit
        var res = await c.PostAsJsonAsync("/api/v1/stakeholder-matrix/project/PRJ-1", new { name = "X" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }
}
