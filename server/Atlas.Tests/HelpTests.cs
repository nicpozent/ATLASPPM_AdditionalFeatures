using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// The help centre is seeded at boot (like the RBAC matrix). These assert the
// curated baseline the front end relies on: role guides carry a full body
// (not just the one-line summary), a Getting-started set exists for everyone,
// and every error-code category is present for the deep links.
public class HelpTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public HelpTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Client()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "pm");
        return c;
    }

    [Fact]
    public async Task Guides_carry_a_full_body_and_a_getting_started_set()
    {
        var help = await Client().GetFromJsonAsync<JsonElement>("/api/v1/help");
        var guides = help.GetProperty("guides").EnumerateArray().ToList();
        Assert.NotEmpty(guides);

        // A Getting-started audience ("all") orients everyone.
        var audiences = guides.Select(g => g.GetProperty("audience").GetString()).ToHashSet();
        Assert.Contains("all", audiences);

        // Every guide has a real, multi-line body that goes beyond its summary.
        foreach (var g in guides)
        {
            var summary = g.GetProperty("summary").GetString() ?? "";
            var body = g.GetProperty("body").GetString() ?? "";
            Assert.False(string.IsNullOrWhiteSpace(body));
            Assert.NotEqual(summary, body);
            Assert.True(body.Length >= summary.Length, $"guide '{g.GetProperty("title").GetString()}' body should be at least as detailed as its summary");
        }
    }

    [Fact]
    public async Task Install_and_ops_guides_cover_docker_and_postgres()
    {
        var help = await Client().GetFromJsonAsync<JsonElement>("/api/v1/help");
        var install = help.GetProperty("guides").EnumerateArray()
            .Where(g => g.GetProperty("audience").GetString() == "install").ToList();
        Assert.NotEmpty(install);
        var titles = install.Select(g => g.GetProperty("title").GetString() ?? "").ToList();
        Assert.Contains(titles, t => t.Contains("Windows Server"));
        Assert.Contains(titles, t => t.Contains("Linux VM"));
        Assert.Contains(titles, t => t.Contains("PostgreSQL"));
        // These are genuine step-by-step guides — bodies are substantial.
        Assert.All(install, g => Assert.True((g.GetProperty("body").GetString() ?? "").Length > 200));
    }

    [Fact]
    public async Task All_error_code_categories_are_present()
    {
        var help = await Client().GetFromJsonAsync<JsonElement>("/api/v1/help");
        var codes = help.GetProperty("troubleshooting").EnumerateArray()
            .Select(t => t.GetProperty("code").GetString()).ToHashSet();
        foreach (var expected in new[] { "NET", "AUTH", "VAL", "SRV", "INT" })
            Assert.Contains(expected, codes);
    }

    [Fact]
    public async Task Troubleshooting_deep_link_resolves_by_code_prefix()
    {
        // The error UI passes the full code (e.g. "SRV-3F9K2A"); the entry resolves on the prefix.
        var entry = await Client().GetFromJsonAsync<JsonElement>("/api/v1/help/troubleshooting/SRV-3F9K2A");
        Assert.Equal("SRV", entry.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(entry.GetProperty("body").GetString()));
    }
}
