using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Atlas.Api;

// ============================================================================
//  Notifications. Users subscribe to projects/programs/products and choose, per
//  event type, whether to hear about it in-app and/or by email. Entity events
//  (risk, date slip, status change, approval) reach a user only if they're
//  subscribed to that entity; portfolio events (created) reach users who opted
//  into them via preferences. Email goes out via Microsoft Graph Mail.Send when
//  configured — otherwise delivery is in-app only, so nothing breaks before the
//  Mail.Send permission and a sender mailbox are set up.
// ============================================================================
public static class Notifications
{
    // Operational logger — set once at startup so the static emit path can report
    // email failures / degradation. Defaults to a no-op until wired in Program.cs.
    static ILogger _log = NullLogger.Instance;
    public static void UseLogger(ILoggerFactory factory) => _log = factory.CreateLogger("Atlas.Notifications");

    // Event types and their human labels (used by the prefs UI and inbox).
    public const string Risk = "risk", DateSlip = "date_slip", Status = "status_change",
        Approval = "approval", Created = "created";

    public static readonly (string Key, string Label, string Detail, bool EntityScoped)[] EventTypes =
    {
        (Risk,     "At risk",        "A subscribed item's health turns amber or red",         true),
        (DateSlip, "Date slip",      "A target date is moved out or passes uncompleted",       true),
        (Status,   "Status change",  "A subscribed item changes status or advances a stage",   true),
        (Approval, "Approvals",      "An approval is requested, granted or rejected",          true),
        (Created,  "New items",      "A project, program, product or demand is created",       false),
    };

    // Default channels when a user hasn't set a preference for an event type.
    // Entity events default to in-app (for people who subscribed); "created" is
    // opt-in (off) so it isn't a firehose.
    internal static (bool InApp, bool Email) DefaultPref(string ev) =>
        ev == Created ? (false, false) : (true, false);

    static bool MailConfigured(IConfiguration cfg) =>
        !string.IsNullOrWhiteSpace(cfg["Graph:TenantId"]) &&
        !string.IsNullOrWhiteSpace(cfg["Graph:ClientId"]) &&
        !string.IsNullOrWhiteSpace(cfg["Graph:ClientSecret"]) &&
        !string.IsNullOrWhiteSpace(cfg["Notifications:SenderUpn"]);

    // Deliver an entity event to everyone subscribed to (targetType,targetId),
    // except the actor who caused it. Adds in-app rows and, when asked for and
    // configured, sends email. Self-contained: persists its own rows.
    public static async Task EmitToEntityAsync(AtlasDbContext db, IConfiguration cfg,
        string ev, string targetType, string targetId, string title, string body, string actorKey)
    {
        var subs = await db.Subscriptions
            .Where(s => s.TargetType == targetType && s.TargetId == targetId && s.UserKey != actorKey)
            .ToListAsync();
        if (subs.Count == 0) return;

        var prefs = await LoadPrefs(db, subs.Select(s => s.UserKey), ev);
        var emails = new List<string>();
        foreach (var s in subs)
        {
            var (inApp, email) = prefs.TryGetValue(s.UserKey, out var p) ? p : DefaultPref(ev);
            if (inApp) db.Notifications.Add(NewRow(s.UserKey, ev, title, body, targetType, targetId));
            if (email && !string.IsNullOrWhiteSpace(s.Email)) emails.Add(s.Email);
        }
        await db.SaveChangesAsync();
        await SendEmailsAsync(cfg, emails, title, body);
    }

    // Deliver a portfolio event (e.g. created) to users who opted into it.
    public static async Task EmitPortfolioAsync(AtlasDbContext db, IConfiguration cfg,
        string ev, string title, string body, string targetType, string targetId, string actorKey)
    {
        var prefs = await db.NotificationPrefs
            .Where(p => p.EventType == ev && (p.InApp || p.Email) && p.UserKey != actorKey)
            .ToListAsync();
        if (prefs.Count == 0) return;

        var emails = new List<string>();
        foreach (var p in prefs)
        {
            if (p.InApp) db.Notifications.Add(NewRow(p.UserKey, ev, title, body, targetType, targetId));
            if (p.Email && !string.IsNullOrWhiteSpace(p.EmailAddr)) emails.Add(p.EmailAddr);
        }
        await db.SaveChangesAsync();
        await SendEmailsAsync(cfg, emails, title, body);
    }

    static async Task<Dictionary<string, (bool, bool)>> LoadPrefs(AtlasDbContext db, IEnumerable<string> users, string ev)
    {
        var set = users.ToHashSet();
        return (await db.NotificationPrefs.Where(p => p.EventType == ev && set.Contains(p.UserKey)).ToListAsync())
            .ToDictionary(p => p.UserKey, p => (p.InApp, p.Email));
    }

    static Notification NewRow(string user, string ev, string title, string body, string tType, string tId) => new()
    {
        UserKey = user, EventType = ev, Title = title, Body = body,
        TargetType = tType, TargetId = tId, At = DateTime.UtcNow,
    };

    // ---- Email via Graph Mail.Send (best-effort) --------------------------
    static async Task SendEmailsAsync(IConfiguration cfg, List<string> recipients, string subject, string body)
    {
        if (recipients.Count == 0) return;
        if (!MailConfigured(cfg))
        {
            // Expected before Mail.Send is set up — Debug, not a warning, since the
            // in-app copy is already delivered. Surfaces "why no email?" when tracing.
            _log.LogDebug("Email skipped for {Count} recipient(s) on “{Subject}”: Graph Mail.Send not configured (set Graph:* and Notifications:SenderUpn).", recipients.Count, subject);
            return;
        }
        var count = recipients.Distinct().Count();
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            var token = await Teams.GraphTokenAsync(http, cfg);
            http.DefaultRequestHeaders.Authorization = new("Bearer", token);
            var sender = cfg["Notifications:SenderUpn"];
            var payload = new
            {
                message = new
                {
                    subject = $"[Atlas] {subject}",
                    body = new { contentType = "Text", content = body },
                    toRecipients = recipients.Distinct().Select(e => new { emailAddress = new { address = e } }).ToArray(),
                },
                saveToSentItems = false,
            };
            var res = await http.PostAsJsonAsync($"https://graph.microsoft.com/v1.0/users/{sender}/sendMail", payload);
            if (res.IsSuccessStatusCode)
                _log.LogInformation("Notification email sent to {Count} recipient(s) for “{Subject}”.", count, subject);
            else
            {
                // Graph returned an error (bad consent, unknown sender, throttling…).
                // Log the status + body so the misconfiguration is diagnosable; the
                // in-app copy is already persisted, so we degrade rather than fail.
                var detail = await res.Content.ReadAsStringAsync();
                _log.LogWarning("Notification email to {Count} recipient(s) for “{Subject}” failed: Graph returned {Status}. {Detail}", count, subject, (int)res.StatusCode, Trim(detail));
            }
        }
        catch (Exception ex)
        {
            // Network/token failure. In-app delivery already succeeded; log for support.
            _log.LogWarning(ex, "Notification email to {Count} recipient(s) for “{Subject}” failed: {Message}", count, subject, ex.Message);
        }
    }

    static string Trim(string s) => string.IsNullOrEmpty(s) ? "" : (s.Length > 400 ? s[..400] + "…" : s);

    // Resolve a user's effective preference (stored or default) for the UI.
    public static (bool InApp, bool Email) Effective(NotificationPref? stored, string ev) =>
        stored is null ? DefaultPref(ev) : (stored.InApp, stored.Email);

    static readonly string[] SubTargets = { "project", "program", "product" };

    public static void MapNotificationEndpoints(this RouteGroupBuilder api)
    {
        // ---- Inbox --------------------------------------------------------
        api.MapGet("/notifications", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var me = Permissions.CallerKey(http, cfg);
            var items = await db.Notifications.Where(n => n.UserKey == me)
                .OrderByDescending(n => n.At).Take(50)
                .Select(n => new NotificationDto(n.Id, n.EventType, n.Title, n.Body, n.TargetType, n.TargetId, n.Read, n.At.ToString("o")))
                .ToListAsync();
            var unread = await db.Notifications.CountAsync(n => n.UserKey == me && !n.Read);
            return Results.Ok(new InboxDto(unread, items));
        });

        api.MapPost("/notifications/read", async (MarkReadReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var me = Permissions.CallerKey(http, cfg);
            var q = db.Notifications.Where(n => n.UserKey == me && !n.Read);
            if (!req.All && req.Ids is { Count: > 0 }) q = q.Where(n => req.Ids.Contains(n.Id));
            await q.ExecuteUpdateAsync(s => s.SetProperty(n => n.Read, true));
            return Results.NoContent();
        });

        // ---- Subscriptions ------------------------------------------------
        api.MapGet("/subscriptions", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var me = Permissions.CallerKey(http, cfg);
            return Results.Ok(await db.Subscriptions.Where(s => s.UserKey == me)
                .OrderBy(s => s.Id).Select(s => new SubscriptionDto(s.Id, s.TargetType, s.TargetId)).ToListAsync());
        });

        api.MapPost("/subscriptions", async (SubscribeReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!SubTargets.Contains(req.TargetType) || string.IsNullOrWhiteSpace(req.TargetId))
                return Results.BadRequest(new { error = "Subscribe to a project, program or product." });
            var me = Permissions.CallerKey(http, cfg);
            var existing = await db.Subscriptions.FirstOrDefaultAsync(s => s.UserKey == me && s.TargetType == req.TargetType && s.TargetId == req.TargetId);
            if (existing is null)
            {
                db.Subscriptions.Add(new Subscription { UserKey = me, Email = Permissions.CallerEmail(http, cfg), TargetType = req.TargetType, TargetId = req.TargetId, CreatedAt = DateTime.UtcNow });
                await db.SaveChangesAsync();
            }
            return Results.NoContent();
        });

        api.MapDelete("/subscriptions/{targetType}/{targetId}", async (string targetType, string targetId, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var me = Permissions.CallerKey(http, cfg);
            await db.Subscriptions.Where(s => s.UserKey == me && s.TargetType == targetType && s.TargetId == targetId).ExecuteDeleteAsync();
            return Results.NoContent();
        });

        // ---- Preferences --------------------------------------------------
        api.MapGet("/notifications/prefs", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var me = Permissions.CallerKey(http, cfg);
            var stored = await db.NotificationPrefs.Where(p => p.UserKey == me).ToListAsync();
            var list = EventTypes.Select(e =>
            {
                var (inApp, email) = Effective(stored.FirstOrDefault(p => p.EventType == e.Key), e.Key);
                return new NotifPrefDto(e.Key, e.Label, e.Detail, e.EntityScoped, inApp, email);
            }).ToList();
            return Results.Ok(list);
        });

        api.MapPatch("/notifications/prefs/{eventType}", async (string eventType, SetPrefReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!EventTypes.Any(e => e.Key == eventType)) return Results.NotFound();
            var me = Permissions.CallerKey(http, cfg);
            var p = await db.NotificationPrefs.FirstOrDefaultAsync(x => x.UserKey == me && x.EventType == eventType);
            if (p is null) { p = new NotificationPref { UserKey = me, EventType = eventType }; db.NotificationPrefs.Add(p); }
            p.InApp = req.InApp; p.Email = req.Email; p.EmailAddr = Permissions.CallerEmail(http, cfg);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
