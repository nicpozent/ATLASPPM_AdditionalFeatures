using System.Net.Http.Json;
using System.Text.Json;
using Atlas.Api;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Atlas.Tests;

// People & roles candidate pools come from the mapped Entra teams (Admin → Teams):
//  • the architect roles ← the Chief Architect's team,
//  • the Security Officer ← its own Security Officer team,
//  • the Project Manager  ← the combined PM Lead + PMO pool.
public class AssignmentPoolTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public AssignmentPoolTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    static List<string> Names(JsonElement arr) => arr.EnumerateArray().Select(e => e.GetString()!).ToList();

    [Fact]
    public async Task Role_dropdowns_source_from_the_mapped_entra_teams()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
            void Grp(string id, string key, params string[] members)
            {
                var g = new EntraGroup { Id = id, DisplayName = id, ManagerKey = key, Manual = true };
                foreach (var m in members) g.Members.Add(new TeamMemberRow { GroupId = id, Uid = id + "-" + m, DisplayName = m });
                db.EntraGroups.Add(g);
            }
            Grp("pool-arch", "architect", "Aina Arkitekt", "Bo Byggare");
            Grp("pool-sec", "secofficer", "Sara Säkerhet");
            Grp("pool-pmlead", "pmlead", "Pia Projektledare");
            Grp("pool-pmo", "pmo", "Per PMO");
            Grp("pool-dev", "devmgr", "Dan Developer"); // out of scope for every role pool
            await db.SaveChangesAsync();
        }

        var c = Admin();
        var projId = await JsonId(await c.PostAsJsonAsync("/api/v1/projects", new { name = "Pool sourcing project" }));
        var data = await c.GetFromJsonAsync<JsonElement>($"/api/v1/projects/{projId}/assignments");

        // Lead (Project Manager) ← PM Lead + PMO union.
        var lead = Names(data.GetProperty("leadOptions"));
        Assert.Contains("Pia Projektledare", lead);
        Assert.Contains("Per PMO", lead);
        Assert.DoesNotContain("Aina Arkitekt", lead);
        Assert.DoesNotContain("Dan Developer", lead);

        // Architect roles ← Chief Architect team; Security Officer ← its own team.
        var roles = data.GetProperty("archRoles").EnumerateArray().ToList();
        var solution = roles.First(r => r.GetProperty("key").GetString() == "solutionArchitect");
        var solOpts = Names(solution.GetProperty("options"));
        Assert.Contains("Aina Arkitekt", solOpts);
        Assert.DoesNotContain("Sara Säkerhet", solOpts);     // security officer is a separate team
        Assert.DoesNotContain("Pia Projektledare", solOpts); // PM is a separate team

        var secOfficer = roles.First(r => r.GetProperty("key").GetString() == "securityOfficer");
        var secOpts = Names(secOfficer.GetProperty("options"));
        Assert.Contains("Sara Säkerhet", secOpts);
        Assert.DoesNotContain("Aina Arkitekt", secOpts);
    }

    [Fact]
    public async Task Assignable_pmpo_endpoint_returns_the_pm_and_pmo_pool()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
            var g = new EntraGroup { Id = "own-pmlead", DisplayName = "PMs", ManagerKey = "pmlead", Manual = true };
            g.Members.Add(new TeamMemberRow { GroupId = g.Id, Uid = "own-1", DisplayName = "Owner Olga" });
            db.EntraGroups.Add(g);
            await db.SaveChangesAsync();
        }
        var names = await Admin().GetFromJsonAsync<List<string>>("/api/v1/assignable/pmpo");
        Assert.Contains("Owner Olga", names!);
    }

    static async Task<string> JsonId(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetString()!;
    }
}
