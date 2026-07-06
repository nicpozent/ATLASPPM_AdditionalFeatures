using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace Atlas.Tests;

// The portfolio timeline places every dated project/program/product/release on
// the 12-month grid; undated items are omitted.
public class PortfolioGanttTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public PortfolioGanttTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin() { var c = _factory.CreateClient(); c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin"); return c; }

    [Fact]
    public async Task A_dated_project_appears_on_the_portfolio_timeline()
    {
        var c = Admin();
        var create = await c.PostAsJsonAsync("/api/v1/projects", new { name = "Roadmap project", startDate = "1 Mar 2026", target = "1 Aug 2026" });
        Assert.True(create.IsSuccessStatusCode);
        using var cd = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
        var id = cd.RootElement.GetProperty("id").GetString();

        var res = await c.GetAsync("/api/v1/portfolio/gantt");
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var items = doc.RootElement.GetProperty("items").EnumerateArray().ToList();
        var mine = items.FirstOrDefault(x => x.GetProperty("id").GetString() == id);
        Assert.Equal(JsonValueKind.Object, mine.ValueKind);
        Assert.Equal("project", mine.GetProperty("type").GetString());
        Assert.Equal(2, mine.GetProperty("startMonth").GetInt32());   // March = index 2
        Assert.Equal(7, mine.GetProperty("endMonth").GetInt32());     // August = index 7
    }
}
