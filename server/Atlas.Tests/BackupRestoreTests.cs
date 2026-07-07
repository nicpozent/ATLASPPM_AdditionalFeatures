using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// The JSON backup can be restored as a MERGE (upsert by id): it re-applies the
// snapshot's values to existing rows and re-creates missing ones, never deleting.
public class BackupRestoreTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public BackupRestoreTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient As(string role)
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", role);
        return c;
    }

    [Fact]
    public async Task Restore_merges_snapshot_values_back_onto_changed_rows()
    {
        var c = As("admin");
        var pRes = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "BAK", target = "project", name = "Original name" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var pid = pDoc.RootElement.GetProperty("projectId").GetString();

        // Snapshot now (captures "Original name").
        var snapshot = await c.GetByteArrayAsync("/api/v1/backups/snapshot.json");

        // Change the project.
        Assert.Equal(HttpStatusCode.OK, (await c.PatchAsJsonAsync($"/api/v1/projects/{pid}", new { name = "Changed name" })).StatusCode);
        var changed = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{pid}");
        Assert.Equal("Changed name", changed.GetProperty("name").GetString());

        // Restore the earlier snapshot → the name is merged back.
        var content = new ByteArrayContent(snapshot);
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
        var restoreRes = await c.PostAsync("/api/v1/backups/restore", content);
        Assert.Equal(HttpStatusCode.OK, restoreRes.StatusCode);
        using var rDoc = JsonDocument.Parse(await restoreRes.Content.ReadAsStringAsync());
        Assert.True(rDoc.RootElement.GetProperty("ok").GetBoolean());

        var after = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{pid}");
        Assert.Equal("Original name", after.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Restore_rejects_junk_and_is_gated()
    {
        // Not a backup → 400.
        var admin = As("admin");
        var junk = new StringContent("{\"nope\":true}", Encoding.UTF8, "application/json");
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsync("/api/v1/backups/restore", junk)).StatusCode);

        // Stakeholder can't restore (needs Backups Full).
        var stk = As("stakeholder");
        var body = new StringContent("{\"data\":{}}", Encoding.UTF8, "application/json");
        Assert.Equal(HttpStatusCode.Forbidden, (await stk.PostAsync("/api/v1/backups/restore", body)).StatusCode);
    }
}
