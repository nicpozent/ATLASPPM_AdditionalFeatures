using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Atlas.Api;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Atlas.Tests;

// End-to-end coverage for the surface added in #1/#2: the secret-redaction on
// GET /settings, the PI board placement roundtrip, and the Teams connector's
// masked status (the raw webhook URL must never come back). Hosts the real API
// on an in-memory DB via AtlasApiFactory; no role header ⇒ the dev full-access
// identity, so cap-schedule / cap-integrations writes are permitted.
public class PiBoardAndSettingsTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public PiBoardAndSettingsTests(AtlasApiFactory factory) => _factory = factory;

    async Task<HttpResponseMessage> Send(HttpMethod method, string path, object? body = null)
    {
        var client = _factory.CreateClient();
        var req = new HttpRequestMessage(method, path);
        if (body is not null) req.Content = JsonContent.Create(body);
        return await client.SendAsync(req);
    }

    // Send as a specific switcher identity (drives the effective role with auth off).
    async Task<HttpResponseMessage> SendAs(string role, HttpMethod method, string path, object? body = null)
    {
        var client = _factory.CreateClient();
        var req = new HttpRequestMessage(method, path);
        req.Headers.Add("X-Atlas-Role", role);
        if (body is not null) req.Content = JsonContent.Create(body);
        return await client.SendAsync(req);
    }

    static async Task<JsonElement> Json(HttpResponseMessage res) =>
        await res.Content.ReadFromJsonAsync<JsonElement>();

    // Flip the compliance gate for the personnel-assessment features (off by default).
    Task EnablePersonnel(bool on) =>
        Send(HttpMethod.Patch, "/api/v1/settings/personnel.assessmentsEnabled", new { value = on ? "true" : "false" });

    // ---- GET /settings must not leak secret-valued keys ---------------------
    [Fact]
    public async Task Settings_redacts_secret_keys_but_returns_toggles()
    {
        // A non-secret toggle and a secret webhook URL, both stored the same way.
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Patch, "/api/v1/settings/integration.email", new { value = "true" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Patch, "/api/v1/settings/teams.webhookUrl", new { value = "https://prod.example.com/hooks/super-secret" })).StatusCode);

        var res = await Send(HttpMethod.Get, "/api/v1/settings");
        res.EnsureSuccessStatusCode();
        var map = await res.Content.ReadFromJsonAsync<Dictionary<string, string>>();

        Assert.NotNull(map);
        Assert.Equal("true", map!["integration.email"]);          // non-secret toggle returned
        Assert.False(map.ContainsKey("teams.webhookUrl"));         // secret redacted
        Assert.DoesNotContain("super-secret", await (await Send(HttpMethod.Get, "/api/v1/settings")).Content.ReadAsStringAsync());
    }

    // ---- Generic settings PATCH validates webhook URLs (SSRF guard) ---------
    [Fact]
    public async Task Settings_patch_rejects_a_non_https_webhook_url()
    {
        // A webhook-url key written through the generic /settings path must clear
        // the same bar as the dedicated integration endpoint (absolute https), so
        // it can't be pointed at a plaintext / internal target.
        Assert.Equal(HttpStatusCode.BadRequest,
            (await Send(HttpMethod.Patch, "/api/v1/settings/slack.webhookUrl", new { value = "http://10.0.0.5/internal" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await Send(HttpMethod.Patch, "/api/v1/settings/slack.webhookUrl", new { value = "not-a-url" })).StatusCode);
        // A valid https webhook is accepted, and clearing it (blank) is allowed.
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Patch, "/api/v1/settings/slack.webhookUrl", new { value = "https://hooks.example.com/abc" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Patch, "/api/v1/settings/slack.webhookUrl", new { value = "" })).StatusCode);
    }

    // ---- PI board placement roundtrip --------------------------------------
    [Fact]
    public async Task Board_placement_roundtrips_and_unschedules()
    {
        var incId = (await Json(await Send(HttpMethod.Post, "/api/v1/increments", new { name = "PI 2026.1" }))).GetProperty("id").GetInt32();
        var objId = (await Json(await Send(HttpMethod.Post, $"/api/v1/increments/{incId}/objectives", new { title = "Ship checkout", entityType = "project", entityId = "PRJ-1" }))).GetProperty("id").GetInt32();
        var iterId = (await Json(await Send(HttpMethod.Post, $"/api/v1/increments/{incId}/iterations", new { name = "Iteration 1" }))).GetProperty("id").GetInt32();

        // Place the objective in the iteration → it appears in the placement map.
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Put, $"/api/v1/increments/{incId}/board/placement", new { objectiveId = objId, iterationId = iterId })).StatusCode);
        var placed = (await Json(await Send(HttpMethod.Get, $"/api/v1/increments/{incId}/board"))).GetProperty("placements");
        Assert.Equal(iterId, placed.GetProperty(objId.ToString()).GetInt32());

        // Clear it (iterationId null) → the objective drops out of the map.
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Put, $"/api/v1/increments/{incId}/board/placement", new { objectiveId = objId, iterationId = (int?)null })).StatusCode);
        var cleared = (await Json(await Send(HttpMethod.Get, $"/api/v1/increments/{incId}/board"))).GetProperty("placements");
        Assert.False(cleared.TryGetProperty(objId.ToString(), out _));
    }

    [Fact]
    public async Task Board_placement_rejects_objective_from_another_increment()
    {
        var incA = (await Json(await Send(HttpMethod.Post, "/api/v1/increments", new { name = "PI A" }))).GetProperty("id").GetInt32();
        var incB = (await Json(await Send(HttpMethod.Post, "/api/v1/increments", new { name = "PI B" }))).GetProperty("id").GetInt32();
        var objA = (await Json(await Send(HttpMethod.Post, $"/api/v1/increments/{incA}/objectives", new { title = "A obj" }))).GetProperty("id").GetInt32();
        var iterB = (await Json(await Send(HttpMethod.Post, $"/api/v1/increments/{incB}/iterations", new { name = "B-1" }))).GetProperty("id").GetInt32();

        // Placing incA's objective onto incB's board is a bad request, not a 500.
        var bad = await Send(HttpMethod.Put, $"/api/v1/increments/{incB}/board/placement", new { objectiveId = objA, iterationId = iterB });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }

    // ---- Teams connector status masks the webhook, never returns it ---------
    [Fact]
    public async Task Teams_status_exposes_masked_host_not_the_secret_url()
    {
        var secret = "https://prod-12.westeurope.logic.azure.com/workflows/abc123/triggers/manual/paths/invoke?sig=TOKEN";
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Post, "/api/v1/integrations/teams/config", new { webhookUrl = secret, enabled = true })).StatusCode);

        var res = await Send(HttpMethod.Get, "/api/v1/integrations/teams/status");
        res.EnsureSuccessStatusCode();
        var raw = await res.Content.ReadAsStringAsync();
        var status = JsonDocument.Parse(raw).RootElement;

        Assert.True(status.GetProperty("configured").GetBoolean());
        Assert.True(status.GetProperty("enabled").GetBoolean());
        Assert.Equal("https://prod-12.westeurope.logic.azure.com", status.GetProperty("host").GetString());
        // The secret path/token must not appear anywhere in the response.
        Assert.DoesNotContain("workflows", raw);
        Assert.DoesNotContain("TOKEN", raw);
    }

    // ---- Backup snapshot now captures every table's structured data ---------
    [Fact]
    public async Task Snapshot_includes_pi_planning_and_previously_missing_tables()
    {
        await Send(HttpMethod.Post, "/api/v1/increments", new { name = "Backup PI", key = "BKP" });

        var res = await Send(HttpMethod.Get, "/api/v1/backups/snapshot.json");
        res.EnsureSuccessStatusCode();
        var json = await res.Content.ReadAsStringAsync();

        // Tables that used to be absent from the snapshot are now present…
        foreach (var key in new[] { "increments", "piObjectives", "piDependencies", "piIterations",
                                    "skills", "skillRatings", "requirements", "roadmapItems", "subTeams", "notifications" })
            Assert.Contains($"\"{key}\"", json);
        // …and the row we just created is actually captured.
        Assert.Contains("Backup PI", json);
    }

    // ---- Team SWOT: scoped write/read, and never leaked via GET /settings ---
    [Fact]
    public async Task Team_swot_roundtrips_and_is_redacted_from_settings()
    {
        const string marker = "STRENGTH_MARKER_XYZ";
        await EnablePersonnel(true);
        // No role header ⇒ dev acts as Platform Admin (all slots in scope).
        Assert.Equal(HttpStatusCode.NoContent,
            (await Send(HttpMethod.Put, "/api/v1/teams/teammgr/swot",
                new { strengths = marker, weaknesses = "W", opportunities = "O", threats = "T" })).StatusCode);

        var swot = (await Json(await Send(HttpMethod.Get, "/api/v1/teams/swot")))
            .GetProperty("items").GetProperty("teammgr");
        Assert.Equal(marker, swot.GetProperty("strengths").GetString());

        // The SWOT must NOT appear in the broadly-readable settings dump.
        var settings = await Send(HttpMethod.Get, "/api/v1/settings");
        var map = await settings.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.NotNull(map);
        Assert.DoesNotContain(map!.Keys, k => k.StartsWith("team.swot."));
        Assert.DoesNotContain(marker, await (await Send(HttpMethod.Get, "/api/v1/settings")).Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Team_swot_rejects_unknown_slot_and_out_of_scope_caller()
    {
        await EnablePersonnel(true);
        // Unknown slot → 404 (even as admin).
        Assert.Equal(HttpStatusCode.NotFound,
            (await Send(HttpMethod.Put, "/api/v1/teams/not-a-slot/swot", new { strengths = "x" })).StatusCode);

        // A stakeholder has no manager scope → 403 on a real slot.
        Assert.Equal(HttpStatusCode.Forbidden,
            (await SendAs("stakeholder", HttpMethod.Put, "/api/v1/teams/teammgr/swot", new { strengths = "x" })).StatusCode);
    }

    // ---- Individual development plans: scoped, and never leaked via settings --
    [Fact]
    public async Task Devplan_write_is_scoped_and_validated()
    {
        await EnablePersonnel(true);
        // Missing person → 400.
        Assert.Equal(HttpStatusCode.BadRequest,
            (await Send(HttpMethod.Put, "/api/v1/devplans", new { strengths = "x" })).StatusCode);
        // No members are mapped in this host, so nobody is in scope — even the
        // admin default can't write a plan for an unknown person → 403.
        Assert.Equal(HttpStatusCode.Forbidden,
            (await Send(HttpMethod.Put, "/api/v1/devplans", new { person = "Nobody At All", strengths = "x" })).StatusCode);
        // A stakeholder (no manager scope) is likewise forbidden.
        Assert.Equal(HttpStatusCode.Forbidden,
            (await SendAs("stakeholder", HttpMethod.Put, "/api/v1/devplans", new { person = "Nobody", strengths = "x" })).StatusCode);
    }

    [Fact]
    public async Task Devplan_setting_is_redacted_from_settings()
    {
        // Seed a plan directly (the write path is scope-gated, tested above).
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
            db.Settings.Add(new Setting { Key = "devplan.Jane Doe", Value = "{\"strengths\":\"DEVPLAN_MARKER\"}" });
            await db.SaveChangesAsync();
        }
        var raw = await (await Send(HttpMethod.Get, "/api/v1/settings")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("devplan.", raw);
        Assert.DoesNotContain("DEVPLAN_MARKER", raw);
    }

    // ---- Compliance gate: personnel features off by default ------------------
    [Fact]
    public async Task Personnel_features_are_gated_off_by_default()
    {
        await EnablePersonnel(false); // explicit: gate closed
        // Writes refused…
        Assert.Equal(HttpStatusCode.Forbidden,
            (await Send(HttpMethod.Put, "/api/v1/teams/teammgr/swot", new { strengths = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await Send(HttpMethod.Put, "/api/v1/devplans", new { person = "X", strengths = "x" })).StatusCode);
        // …and reads report disabled (no data served).
        Assert.False((await Json(await Send(HttpMethod.Get, "/api/v1/teams/swot"))).GetProperty("enabled").GetBoolean());
        Assert.False((await Json(await Send(HttpMethod.Get, "/api/v1/devplans"))).GetProperty("enabled").GetBoolean());
    }

    // ---- Personnel data lifecycle: subject export + erasure ------------------
    [Fact]
    public async Task Gdpr_export_includes_the_development_plan()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
            // PascalCase keys — matches how the app stores it (JsonSerializer.Serialize
            // with default options), which the export then deserialises case-sensitively.
            db.Settings.Add(new Setting { Key = "devplan.Erik Svensson", Value = "{\"Strengths\":\"EXPORT_MARK\",\"GrowthAreas\":\"\",\"Goals\":\"\",\"UpdatedAt\":\"\",\"UpdatedBy\":\"mgr\"}" });
            await db.SaveChangesAsync();
        }
        var raw = await (await Send(HttpMethod.Get, "/api/v1/gdpr/export?subject=Erik%20Svensson")).Content.ReadAsStringAsync();
        Assert.Contains("developmentPlan", raw);
        Assert.Contains("EXPORT_MARK", raw);
    }

    [Fact]
    public async Task Gdpr_erase_deletes_the_development_plan()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
            db.Settings.Add(new Setting { Key = "devplan.Nina Berg", Value = "{\"strengths\":\"ERASE_MARK\"}" });
            await db.SaveChangesAsync();
        }
        (await Send(HttpMethod.Post, "/api/v1/gdpr/erase?subject=Nina%20Berg")).EnsureSuccessStatusCode();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
            Assert.Null(await db.Settings.FindAsync("devplan.Nina Berg"));
        }
    }

    // ---- Demand funnel lifecycle drives the real-time room broadcast --------
    // Create → move (stage) → delete each ping the "demands" room via the shared
    // BoardHub. This asserts the endpoints still behave once IHubContext<BoardHub>
    // is injected — i.e. the hub dependency resolves and the broadcast is a
    // best-effort no-op (no connected clients) rather than failing the write.
    [Fact]
    public async Task Demand_funnel_create_move_delete_succeeds_with_realtime_wired()
    {
        var created = await Send(HttpMethod.Post, "/api/v1/demands", new { title = "Realtime funnel demand" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await Json(created)).GetProperty("id").GetString();
        Assert.False(string.IsNullOrEmpty(id));

        // Move it through the funnel (a stage that doesn't require cap-approve).
        var moved = await Send(HttpMethod.Patch, $"/api/v1/demands/{id}", new { stage = "backlog" });
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        Assert.Equal("backlog", (await Json(moved)).GetProperty("stage").GetString());

        // Delete it (dev identity is the creator / Platform Admin).
        var deleted = await Send(HttpMethod.Delete, $"/api/v1/demands/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
    }

    // ---- Whiteboard: roundtrip, sanitisation, scope guard, redaction --------
    [Fact]
    public async Task Whiteboard_roundtrips_and_sanitises_the_scene()
    {
        const string marker = "WB_NOTE_MARKER";
        var incId = (await Json(await Send(HttpMethod.Post, "/api/v1/increments", new { name = "WB PI" }))).GetProperty("id").GetInt32();

        var body = new
        {
            scene = new
            {
                nodes = new object[]
                {
                    new { id = "n1", kind = "note", x = 10.0, y = 20.0, w = 160.0, h = 150.0, text = marker, color = "#FFE8A3" },
                    new { id = "far", kind = "rect", x = 1_000_000.0, y = 0.0, w = 100.0, h = 100.0, color = "#FFFFFF" },
                    new { id = "bad id!", kind = "note", x = 0.0, y = 0.0, w = 40.0, h = 40.0 },   // bad id → dropped
                    new { id = "n2", kind = "banana", x = 0.0, y = 0.0, w = 40.0, h = 40.0 },       // bad kind → dropped
                },
                edges = new object[]
                {
                    new { id = "e1", from = "n1", to = "n2" },        // n2 dropped → dangling → dropped
                    new { id = "e2", from = "n1", to = "missing" },   // dangling → dropped
                },
            },
        };

        var put = await Send(HttpMethod.Put, $"/api/v1/whiteboards/pi/{incId}", body);
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var get = await Json(await Send(HttpMethod.Get, $"/api/v1/whiteboards/pi/{incId}"));
        Assert.True(get.GetProperty("canEdit").GetBoolean());           // dev identity edits
        var nodes = get.GetProperty("scene").GetProperty("nodes");
        var edges = get.GetProperty("scene").GetProperty("edges");
        Assert.Equal(2, nodes.GetArrayLength());                        // bad id + bad kind dropped
        Assert.Equal(0, edges.GetArrayLength());                        // both connectors dangling → dropped
        // Runaway coordinate clamped to the safety bound.
        var far = nodes.EnumerateArray().First(n => n.GetProperty("id").GetString() == "far");
        Assert.True(far.GetProperty("x").GetDouble() <= 20000);
    }

    [Fact]
    public async Task Whiteboard_content_is_redacted_from_settings()
    {
        const string marker = "WB_SECRET_BRAINSTORM";
        var incId = (await Json(await Send(HttpMethod.Post, "/api/v1/increments", new { name = "WB PI 2" }))).GetProperty("id").GetInt32();
        await Send(HttpMethod.Put, $"/api/v1/whiteboards/pi/{incId}", new
        {
            scene = new { nodes = new object[] { new { id = "n1", kind = "note", x = 0.0, y = 0.0, w = 160.0, h = 150.0, text = marker } }, edges = new object[] { } },
        });

        var map = await (await Send(HttpMethod.Get, "/api/v1/settings")).Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.NotNull(map);
        Assert.DoesNotContain(map!.Keys, k => k.StartsWith("whiteboard."));
        Assert.DoesNotContain(marker, await (await Send(HttpMethod.Get, "/api/v1/settings")).Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Whiteboard_rejects_an_unknown_scope_kind()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, "/api/v1/whiteboards/banana/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await Send(HttpMethod.Put, "/api/v1/whiteboards/banana/1", new { scene = new { nodes = new object[] { }, edges = new object[] { } } })).StatusCode);
    }

    // ---- Whiteboard live co-editing: granular authorized ops ----------------
    [Fact]
    public async Task Whiteboard_granular_node_and_edge_ops_persist_and_validate()
    {
        var incId = (await Json(await Send(HttpMethod.Post, "/api/v1/increments", new { name = "WB PI 3" }))).GetProperty("id").GetInt32();
        var wb = $"/api/v1/whiteboards/pi/{incId}";

        // Upsert two nodes via the granular endpoint.
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"{wb}/node", new { id = "a", kind = "note", x = 0.0, y = 0.0, w = 160.0, h = 150.0 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"{wb}/node", new { id = "b", kind = "rect", x = 300.0, y = 0.0, w = 120.0, h = 120.0 })).StatusCode);
        // A bad kind is rejected.
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Put, $"{wb}/node", new { id = "c", kind = "banana", x = 0.0, y = 0.0, w = 40.0, h = 40.0 })).StatusCode);

        // Link them.
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"{wb}/edge", new { id = "e1", from = "a", to = "b" })).StatusCode);
        // A dangling edge is rejected.
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Put, $"{wb}/edge", new { id = "e2", from = "a", to = "ghost" })).StatusCode);

        var scene = (await Json(await Send(HttpMethod.Get, wb))).GetProperty("scene");
        Assert.Equal(2, scene.GetProperty("nodes").GetArrayLength());
        Assert.Equal(1, scene.GetProperty("edges").GetArrayLength());

        // Deleting node "a" removes it and its connector.
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"{wb}/node/a")).StatusCode);
        var after = (await Json(await Send(HttpMethod.Get, wb))).GetProperty("scene");
        Assert.Equal(1, after.GetProperty("nodes").GetArrayLength());
        Assert.Equal(0, after.GetProperty("edges").GetArrayLength());
    }

    [Fact]
    public async Task Whiteboard_granular_ops_reject_an_unknown_scope()
    {
        Assert.Equal(HttpStatusCode.NotFound,
            (await Send(HttpMethod.Put, "/api/v1/whiteboards/banana/1/node", new { id = "a", kind = "note", x = 0.0, y = 0.0, w = 40.0, h = 40.0 })).StatusCode);
    }

    [Fact]
    public async Task Whiteboard_accepts_new_shapes_and_freehand_strokes()
    {
        var incId = (await Json(await Send(HttpMethod.Post, "/api/v1/increments", new { name = "WB PI shapes" }))).GetProperty("id").GetInt32();
        var wb = $"/api/v1/whiteboards/pi/{incId}";

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"{wb}/node", new { id = "s1", kind = "triangle", x = 0.0, y = 0.0, w = 120.0, h = 100.0 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"{wb}/node", new { id = "s2", kind = "star", x = 200.0, y = 0.0, w = 120.0, h = 120.0 })).StatusCode);
        // A freehand stroke carries a points polyline.
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"{wb}/node", new { id = "d1", kind = "draw", x = 0.0, y = 0.0, w = 60.0, h = 40.0, points = new[] { 10.0, 10.0, 40.0, 30.0, 70.0, 10.0 } })).StatusCode);

        var scene = (await Json(await Send(HttpMethod.Get, wb))).GetProperty("scene");
        Assert.Equal(3, scene.GetProperty("nodes").GetArrayLength());
        var draw = scene.GetProperty("nodes").EnumerateArray().First(n => n.GetProperty("id").GetString() == "d1");
        Assert.Equal(6, draw.GetProperty("points").GetArrayLength());
    }

    // ---- Project task board mutations drive the real-time room --------------
    [Fact]
    public async Task Task_board_create_move_delete_succeeds_with_realtime_wired()
    {
        var projId = (await Json(await Send(HttpMethod.Post, "/api/v1/projects", new { name = "Realtime board project" }))).GetProperty("id").GetString();
        Assert.False(string.IsNullOrEmpty(projId));

        var created = await Send(HttpMethod.Post, $"/api/v1/projects/{projId}/tasks", new { name = "Do the thing" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var taskId = (await Json(created)).GetProperty("id").GetInt32();

        var moved = await Send(HttpMethod.Patch, $"/api/v1/tasks/{taskId}", new { status = "In Progress" });
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        Assert.Equal("In Progress", (await Json(moved)).GetProperty("status").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/v1/tasks/{taskId}")).StatusCode);
    }

    [Fact]
    public async Task Task_status_move_is_scoped_to_planner_roles()
    {
        // Set up a project + task as the dev/admin identity.
        var projId = (await Json(await Send(HttpMethod.Post, "/api/v1/projects", new { name = "Planner-move project" }))).GetProperty("id").GetString();
        var taskId = (await Json(await Send(HttpMethod.Post, $"/api/v1/projects/{projId}/tasks", new { name = "Card" }))).GetProperty("id").GetInt32();

        // A Stakeholder (no schedule right) may NOT move the card (ADR-0065 revised).
        Assert.Equal(HttpStatusCode.Forbidden,
            (await SendAs("stkhldr", HttpMethod.Patch, $"/api/v1/tasks/{taskId}", new { status = "In Progress" })).StatusCode);

        // A Team Member HAS cap-projects Edit but NOT cap-schedule, so they also may
        // not move — this proves the gate is cap-schedule, not the broader cap-projects.
        Assert.Equal(HttpStatusCode.Forbidden,
            (await SendAs("team", HttpMethod.Patch, $"/api/v1/tasks/{taskId}", new { status = "In Progress" })).StatusCode);

        // A Project Manager (cap-schedule Edit) CAN move the card.
        var moved = await SendAs("pm", HttpMethod.Patch, $"/api/v1/tasks/{taskId}", new { status = "In Progress" });
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        Assert.Equal("In Progress", (await Json(moved)).GetProperty("status").GetString());

        // …and a non-status edit (rename) still needs cap-projects Edit — a
        // Stakeholder is refused there too.
        Assert.Equal(HttpStatusCode.Forbidden,
            (await SendAs("stkhldr", HttpMethod.Patch, $"/api/v1/tasks/{taskId}", new { name = "Hacked name" })).StatusCode);
    }

    [Fact]
    public async Task Task_list_reports_canMove_for_planner_but_not_stakeholder()
    {
        var projId = (await Json(await Send(HttpMethod.Post, "/api/v1/projects", new { name = "canMove project" }))).GetProperty("id").GetString();

        var asPm = await Json(await SendAs("pm", HttpMethod.Get, $"/api/v1/projects/{projId}/tasks"));
        Assert.True(asPm.GetProperty("canMove").GetBoolean());

        var asStk = await Json(await SendAs("stkhldr", HttpMethod.Get, $"/api/v1/projects/{projId}/tasks"));
        Assert.False(asStk.GetProperty("canMove").GetBoolean());
    }

    [Fact]
    public async Task Whiteboard_node_patches_merge_per_field_without_clobbering()
    {
        var incId = (await Json(await Send(HttpMethod.Post, "/api/v1/increments", new { name = "WB PI merge" }))).GetProperty("id").GetInt32();
        var wb = $"/api/v1/whiteboards/pi/{incId}";

        // Create a node.
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"{wb}/node",
            new { id = "m1", kind = "note", x = 10.0, y = 10.0, w = 160.0, h = 150.0, color = "#FFE8A3" })).StatusCode);

        // Two independent field-level edits: one recolours, one moves.
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"{wb}/node", new { id = "m1", color = "#BBDEFB" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"{wb}/node", new { id = "m1", x = 300.0, y = 220.0 })).StatusCode);

        // Both survive — the move did not revert the colour, the recolour did not
        // revert the position, and the untouched size is intact.
        var node = (await Json(await Send(HttpMethod.Get, wb))).GetProperty("scene").GetProperty("nodes")
            .EnumerateArray().First(n => n.GetProperty("id").GetString() == "m1");
        Assert.Equal("#BBDEFB", node.GetProperty("color").GetString());
        Assert.Equal(300.0, node.GetProperty("x").GetDouble());
        Assert.Equal(220.0, node.GetProperty("y").GetDouble());
        Assert.Equal(160.0, node.GetProperty("w").GetDouble());
    }

    [Fact]
    public async Task Whiteboard_backfill_migrates_a_legacy_setting_blob_to_rows()
    {
        // A scene left behind as a "whiteboard.{scope}" Setting blob (the old,
        // migration-free home) must be promoted to typed rows and the blob removed.
        const string scope = "pi:987654";
        const string json = """{"Nodes":[{"Id":"leg1","Kind":"note","X":5,"Y":6,"W":160,"H":150,"Text":"legacy","Color":"#FFE8A3","Icon":null,"Points":null}],"Edges":[]}""";
        using var s = _factory.Services.CreateScope();
        var db = s.ServiceProvider.GetRequiredService<AtlasDbContext>();
        db.Settings.Add(new Setting { Key = "whiteboard." + scope, Value = json });
        await db.SaveChangesAsync();

        await Whiteboards.BackfillAsync(db);

        Assert.Single(db.WhiteboardNodes.Where(n => n.Scope == scope && n.NodeId == "leg1").ToList());
        Assert.Empty(db.Settings.Where(x => x.Key == "whiteboard." + scope).ToList());
        // Re-running is a no-op (idempotent) and doesn't duplicate the row.
        await Whiteboards.BackfillAsync(db);
        Assert.Single(db.WhiteboardNodes.Where(n => n.Scope == scope).ToList());
    }

    [Fact]
    public async Task Whiteboard_supports_the_roadmap_scope()
    {
        // Roadmap is a single portfolio-wide whiteboard, gated on cap-roadmap.
        var put = await Send(HttpMethod.Put, "/api/v1/whiteboards/roadmap/portfolio/node",
            new { id = "r1", kind = "note", x = 0.0, y = 0.0, w = 160.0, h = 150.0, text = "Strategy" });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        var scene = (await Json(await Send(HttpMethod.Get, "/api/v1/whiteboards/roadmap/portfolio"))).GetProperty("scene");
        Assert.Equal(1, scene.GetProperty("nodes").GetArrayLength());
    }
}
