using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Atlas.Api;

public record TeamsConfigReq(string? WebhookUrl, bool? Enabled);

// ============================================================================
//  Microsoft Teams — a third notification channel alongside in-app and email
//  (ADR-0060). Every notification Atlas already emits (entity, portfolio and
//  role-addressed governance events) is ALSO posted to a Teams channel as an
//  Adaptive Card when a channel webhook is configured and the channel is
//  enabled. Best-effort and self-contained: the in-app copy is always written
//  first (see Notifications), so a Teams outage or an unconfigured connector
//  degrades silently rather than failing the originating action.
//
//  Delivery is via an *Incoming Webhook* URL — created in Teams with the
//  "Workflows → Post to a channel when a webhook request is received" template
//  (the forward-looking replacement for the retired O365 connectors). The URL
//  is a channel secret, so it is stored in the Setting table and NEVER returned
//  to the client: the status endpoint exposes only a masked host + a boolean.
//  See docs/teams-setup.md.
// ============================================================================
public static class TeamsNotify
{
    // Operational logger — set once at startup so the static post path can report
    // delivery failures / degradation. No-op until wired in Program.cs.
    static ILogger _log = NullLogger.Instance;
    public static void UseLogger(ILoggerFactory factory) => _log = factory.CreateLogger("Atlas.TeamsNotify");

    // Setting keys. WebhookUrl is the channel secret; Enabled gates delivery so a
    // channel can be muted without discarding its URL.
    public const string WebhookKey = "teams.webhookUrl";
    public const string EnabledKey = "teams.enabled";

    static async Task<string> GetSettingAsync(AtlasDbContext db, string key) =>
        (await db.Settings.FindAsync(key))?.Value ?? "";

    // Post an event to the configured Teams channel. Reads the webhook + enabled
    // toggle from settings each call (notifications are low-frequency, so the two
    // reads are cheap and always current). Silent no-op when unconfigured/disabled.
    public static async Task EmitAsync(AtlasDbContext db, string title, string body)
    {
        var enabled = (await GetSettingAsync(db, EnabledKey)) == "true";
        var url = await GetSettingAsync(db, WebhookKey);
        if (!enabled || string.IsNullOrWhiteSpace(url)) return;
        await PostAsync(url, title, body);
    }

    // Post a single Adaptive Card to a Teams incoming-webhook URL. Best-effort:
    // logs and swallows failures (the caller has already persisted the in-app
    // copy). Mirrors the degrade-don't-fail contract of the email path.
    public static async Task<(bool Ok, string? Error)> PostAsync(string webhookUrl, string title, string body)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            // Built inline (not via a helper returning `object`) so the anonymous
            // type — not a bare `object` root — is what gets serialised.
            var payload = new
            {
                type = "message",
                attachments = new[]
                {
                    new
                    {
                        contentType = "application/vnd.microsoft.card.adaptive",
                        content = new
                        {
                            type = "AdaptiveCard",
                            version = "1.4",
                            body = new object[]
                            {
                                new { type = "TextBlock", size = "Small", weight = "Bolder", color = "Accent", text = "Atlas PPM", wrap = true },
                                new { type = "TextBlock", size = "Medium", weight = "Bolder", text = title, wrap = true, spacing = "None" },
                                new { type = "TextBlock", text = body, wrap = true },
                            },
                        },
                    },
                },
            };
            var res = await http.PostAsJsonAsync(webhookUrl, payload);
            if (res.IsSuccessStatusCode)
            {
                AtlasTelemetry.RecordTeamsDelivery(ok: true);
                _log.LogInformation("Teams notification posted for “{Title}”.", title);
                return (true, null);
            }
            AtlasTelemetry.RecordTeamsDelivery(ok: false);
            var detail = await res.Content.ReadAsStringAsync();
            _log.LogWarning("Teams notification for “{Title}” failed: webhook returned {Status}. {Detail}",
                title, (int)res.StatusCode, Trim(detail));
            return (false, $"Teams webhook returned {(int)res.StatusCode}. {Trim(detail)}");
        }
        catch (Exception ex)
        {
            AtlasTelemetry.RecordTeamsDelivery(ok: false);
            _log.LogWarning(ex, "Teams notification for “{Title}” failed: {Message}", title, ex.Message);
            return (false, ex.Message);
        }
    }

    static string Trim(string s) => string.IsNullOrEmpty(s) ? "" : (s.Length > 400 ? s[..400] + "…" : s);

    // Scheme+host of the configured webhook, for a "points at …" hint in the UI
    // without ever leaking the secret path/token. Empty when unset/unparseable.
    static string MaskedHost(string url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var u) ? $"{u.Scheme}://{u.Host}" : "";

    public static void MapTeamsConnectorEndpoints(this RouteGroupBuilder api)
    {
        // Connector status — whether a webhook is set, whether delivery is on, and
        // a masked host. Viewing integrations needs View on "Integrations &
        // connectors"; the raw webhook URL is never returned.
        api.MapGet("/integrations/teams/status", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "V") is { } denied) return denied;
            var canManage = await Permissions.Allows(http, db, cfg, "cap-integrations", "E");
            var url = await GetSettingAsync(db, WebhookKey);
            var enabled = (await GetSettingAsync(db, EnabledKey)) == "true";
            return Results.Ok(new
            {
                configured = !string.IsNullOrWhiteSpace(url),
                enabled,
                host = MaskedHost(url),
                canManage,
            });
        });

        // Save the webhook URL and/or the enabled toggle. Managing integrations
        // needs Edit. A blank WebhookUrl clears it (disconnect); a non-blank one
        // must be an absolute https URL (webhooks are always TLS).
        api.MapPost("/integrations/teams/config", async (TeamsConfigReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;

            if (req.WebhookUrl is not null)
            {
                var url = req.WebhookUrl.Trim();
                if (url.Length > 0 && !(Uri.TryCreate(url, UriKind.Absolute, out var u) && u.Scheme == Uri.UriSchemeHttps))
                    return Results.BadRequest(new { error = "Enter a valid https webhook URL (create one in Teams → Workflows → “Post to a channel when a webhook request is received”)." });
                await SetAsync(db, WebhookKey, url);
                // Clearing the URL also mutes delivery so a later re-enable is explicit.
                if (url.Length == 0) await SetAsync(db, EnabledKey, "false");
            }
            if (req.Enabled is { } en) await SetAsync(db, EnabledKey, en ? "true" : "false");

            // Audit without the secret — record only that it was set/cleared.
            var what = req.WebhookUrl is null ? "toggle" : (req.WebhookUrl.Trim().Length > 0 ? "set webhook" : "cleared webhook");
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Configured Teams channel", what));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Live test — post a card to the configured channel and report back. Needs
        // Edit (same bar as configuring it).
        api.MapPost("/integrations/teams/test", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-integrations", "E") is { } denied) return denied;
            var url = await GetSettingAsync(db, WebhookKey);
            if (string.IsNullOrWhiteSpace(url))
                return Results.Ok(new { ok = false, error = "No webhook configured. Add the channel webhook URL first." });
            var (ok, error) = await PostAsync(url,
                "Test notification",
                $"Atlas is connected to this channel. Sent by {Permissions.ActorName(http, cfg)}.");
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Integrations", "Tested Teams channel", ok ? "ok" : "failed"));
            await db.SaveChangesAsync();
            return Results.Ok(new { ok, error });
        });
    }

    static async Task SetAsync(AtlasDbContext db, string key, string value)
    {
        var s = await db.Settings.FindAsync(key);
        if (s is null) db.Settings.Add(new Setting { Key = key, Value = value });
        else s.Value = value;
    }
}
