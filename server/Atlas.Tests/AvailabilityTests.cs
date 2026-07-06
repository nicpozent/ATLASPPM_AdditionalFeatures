using System.Net.Http.Json;
using System.Text.Json;
using Atlas.Api;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Atlas.Tests;

// The availability finder: allocation sliced by entity, time-phased on the
// reference day, with booked absences netting a person to unavailable.
public class AvailabilityTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public AvailabilityTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    [Fact]
    public async Task Free_capacity_is_time_phased_and_sliced_by_entity()
    {
        var c = Admin();
        var pRes = await c.PostAsJsonAsync("/api/v1/integrations/jira/import", new { jiraProjectKey = "AVAIL", target = "project", name = "Availability target" });
        using var pDoc = JsonDocument.Parse(await pRes.Content.ReadAsStringAsync());
        var pid = pDoc.RootElement.GetProperty("projectId").GetString();

        await c.PostAsJsonAsync($"/api/v1/teams/assignments/project/{pid}/individual",
            new { name = "Katherine Johnson", alloc = 60, startDate = "2026-06-01", endDate = "2026-06-30" });

        // Inside the window: 60% on the project, 40% free, one project slice.
        var inWin = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources/availability?on=2026-06-15");
        var k1 = inWin.GetProperty("people").EnumerateArray().First(p => p.GetProperty("name").GetString() == "Katherine Johnson");
        Assert.Equal(60, k1.GetProperty("allocated").GetInt32());
        Assert.Equal(40, k1.GetProperty("free").GetInt32());
        Assert.False(k1.GetProperty("onLeave").GetBoolean());
        var slice = k1.GetProperty("slices").EnumerateArray().First();
        Assert.Equal("project", slice.GetProperty("type").GetString());
        Assert.Equal(60, slice.GetProperty("pct").GetInt32());

        // Outside the window: fully free.
        var outWin = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources/availability?on=2026-09-01");
        var k2 = outWin.GetProperty("people").EnumerateArray().First(p => p.GetProperty("name").GetString() == "Katherine Johnson");
        Assert.Equal(100, k2.GetProperty("free").GetInt32());
    }

    [Fact]
    public async Task Booked_absence_marks_the_person_unavailable()
    {
        // Seed an allocation + an overlapping absence directly.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
            if (!db.Absences.Any(a => a.Person == "Margaret Hamilton"))
            {
                db.Projects.Add(new Project { Id = "PRJ-AV2", Name = "Absence fixture", Dept = "Dev", Owner = "PM", Methodology = "Scrum", Status = "green", Health = "On track", Target = "TBD", Due = "TBD", Phase = "Delivery" });
                var ta = new TeamAssignment { EntityType = "project", EntityId = "PRJ-AV2", SubTeamId = 0 };
                ta.Members.Add(new TeamAssignmentMember { Name = "Margaret Hamilton", Alloc = 30, StartDate = "2026-06-01", EndDate = "2026-12-31" });
                db.TeamAssignments.Add(ta);
                db.Absences.Add(new Absence { ProjectId = "PRJ-AV2", Person = "Margaret Hamilton", From = "2026-06-10", To = "2026-06-20", Type = "vacation" });
                db.SaveChanges();
            }
        }
        var c = Admin();
        var res = await c.GetFromJsonAsync<JsonElement>("/api/v1/resources/availability?on=2026-06-15");
        var m = res.GetProperty("people").EnumerateArray().First(p => p.GetProperty("name").GetString() == "Margaret Hamilton");
        Assert.True(m.GetProperty("onLeave").GetBoolean());
        Assert.Equal(0, m.GetProperty("free").GetInt32());          // netted to unavailable
        Assert.Equal("vacation", m.GetProperty("leaveNote").GetString());
    }
}
