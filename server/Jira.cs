using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Atlas.Api;

// ============================================================================
//  Jira integration — Phase 1: foundation only (pull-only, Jira Cloud).
//
//  This wires configuration, an authenticated client and a connection test so
//  the Integrations screen can verify credentials BEFORE any data sync exists.
//  It moves no project data yet — that's Phase 2.
//
//  Configuration (env / Docker secret), all empty ⇒ integration stays dormant:
//    • Jira:BaseUrl   (env Jira__BaseUrl)   e.g. https://yoursite.atlassian.net
//    • Jira:Email     (env Jira__Email)     the service account's Atlassian email
//    • Jira:ApiToken  (env Jira__ApiToken)  an Atlassian API token (Basic auth)
//
//  Auth is HTTP Basic with "email:api-token" — the standard Jira Cloud scheme.
// ============================================================================
public static class Jira
{
    public static bool JiraConfigured(IConfiguration cfg) =>
        !string.IsNullOrWhiteSpace(cfg["Jira:BaseUrl"]) &&
        !string.IsNullOrWhiteSpace(cfg["Jira:Email"]) &&
        !string.IsNullOrWhiteSpace(cfg["Jira:ApiToken"]);

    // Normalise a configured site URL to a clean https origin: tolerate a missing
    // scheme (default https) and a pasted full path/query (keep only scheme+host).
    // Returns null when the value can't form an absolute http(s) URL.
    public static string? NormalizeBaseUrl(string? raw)
    {
        var s = (raw ?? "").Trim();
        if (s.Length == 0) return null;
        if (!s.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !s.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            s = "https://" + s;
        return Uri.TryCreate(s, UriKind.Absolute, out var u) && (u.Scheme == "http" || u.Scheme == "https")
            ? u.GetLeftPart(UriPartial.Authority)
            : null;
    }

    // An HttpClient pinned to the Jira site with Basic auth. Callers dispose it.
    public static HttpClient Client(IConfiguration cfg)
    {
        var baseUrl = NormalizeBaseUrl(cfg["Jira:BaseUrl"])
            ?? throw new InvalidOperationException("Jira:BaseUrl isn't a valid site URL (expected e.g. https://yoursite.atlassian.net).");
        var http = new HttpClient { BaseAddress = new Uri(baseUrl + "/"), Timeout = TimeSpan.FromSeconds(20) };
        var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{cfg["Jira:Email"]}:{cfg["Jira:ApiToken"]}"));
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", basic);
        http.DefaultRequestHeaders.Accept.Add(new("application/json"));
        return http;
    }

    public static void MapJiraEndpoints(this RouteGroupBuilder api)
    {
        // Config status for the Integrations card — never calls Jira.
        api.MapGet("/integrations/jira/status", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "V") is { } denied) return denied;
            var canManage = await Permissions.Allows(http, db, cfg, "cap-integrations", "E");
            return Results.Ok(new { configured = JiraConfigured(cfg), baseUrl = cfg["Jira:BaseUrl"] ?? "", canManage });
        });

        // Live connection test — calls Jira's /myself and reports back. Managing
        // integrations requires Edit on "Integrations & connectors".
        api.MapPost("/integrations/jira/test", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
            if (!JiraConfigured(cfg))
                return Results.Ok(new { ok = false, error = "Jira isn't configured — set Jira:BaseUrl, Jira:Email and Jira:ApiToken (see docs/jira-setup.md)." });
            try
            {
                using var c = Client(cfg);
                var res = await c.GetAsync("rest/api/3/myself");
                if (!res.IsSuccessStatusCode)
                    return Results.Ok(new { ok = false, error = $"Jira returned {(int)res.StatusCode} {res.ReasonPhrase}. Check the site URL, service-account email and API token." });
                using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
                var name = doc.RootElement.TryGetProperty("displayName", out var d) ? d.GetString() ?? "" : "";
                db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Tested Jira connection", cfg["Jira:BaseUrl"] ?? ""));
                await db.SaveChangesAsync();
                return Results.Ok(new { ok = true, displayName = name, baseUrl = cfg["Jira:BaseUrl"] ?? "" });
            }
            catch (Exception ex)
            {
                return Results.Ok(new { ok = false, error = $"Couldn't reach Jira: {ex.Message}" });
            }
        });
    }
}
