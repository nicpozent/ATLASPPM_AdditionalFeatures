using System.Diagnostics;

namespace Atlas.Api;

// ============================================================================
//  Centralised request logging & error handling. One middleware guarantees that
//  every failed request produces a clear, structured log entry for troubleshooting:
//    • unhandled exceptions  → Error, with the exception + request context, and a
//      clean 500 JSON body (internals never leak to the client);
//    • 5xx responses         → Error, with method, path, status, role & the
//      response's own error message;
//    • 4xx responses         → Warning, same context (bad input, denied access,
//      not found — each carries the endpoint's own "clear message").
//  Successful requests are not logged here (keeps the signal-to-noise high);
//  the ASP.NET hosting logger still records them at Information if enabled.
// ============================================================================
public static class RequestLogging
{
    // Cap how much of an error body we echo into the log line.
    const int MaxDetail = 500;

    // A short, human-quotable correlation code (e.g. "SRV-3F9K2A"). Written to the
    // log line AND returned to the user so support can find the exact entry.
    internal static string NewCode(string prefix) => $"{prefix}-{Guid.NewGuid():N}"[..(prefix.Length + 7)].ToUpperInvariant();

    // Category prefix for a status: server bug vs an upstream/integration failure.
    internal static string CategoryFor(int status) => status is 502 or 503 or 504 ? "INT" : "SRV";

    // Merge the correlation code into a 5xx body, preserving the endpoint's own
    // error message when it had one (else a friendly default).
    static object WithCode(string body, string code, string category)
    {
        var message = "Something went wrong on our end. We've logged the details so support can look into it.";
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var e) && e.ValueKind == System.Text.Json.JsonValueKind.String)
                message = e.GetString() ?? message;
        }
        catch { /* non-JSON body — use the friendly default */ }
        return new { error = message, errorId = code, category };
    }

    public static void UseAtlasRequestLogging(this WebApplication app)
    {
        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Atlas.Request");

        app.Use(async (ctx, next) =>
        {
            var started = Stopwatch.GetTimestamp();
            var originalBody = ctx.Response.Body;
            using var buffer = new MemoryStream();
            ctx.Response.Body = buffer;

            string Role()
            {
                var r = ctx.Request.Headers["X-Atlas-Role"].ToString();
                var user = ctx.User?.Identity?.IsAuthenticated == true
                    ? (ctx.User.FindFirst("name")?.Value ?? ctx.User.FindFirst("preferred_username")?.Value)
                    : null;
                return user ?? (string.IsNullOrEmpty(r) ? "anonymous" : r);
            }

            try
            {
                await next();
            }
            catch (Exception ex)
            {
                // Log the full exception with a correlation code, then return a clean
                // 500 carrying that code so stack traces never reach the client but the
                // user has something to quote to support.
                ctx.Response.Body = originalBody;
                var code = NewCode("SRV");
                logger.LogError(ex,
                    "Unhandled exception [{ErrorId}]: {Method} {Path} (role={Role}) — {Message}",
                    code, ctx.Request.Method, ctx.Request.Path.Value, Role(), ex.Message);
                if (!ctx.Response.HasStarted)
                {
                    ctx.Response.Clear();
                    ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
                    ctx.Response.ContentType = "application/json";
                    await ctx.Response.WriteAsJsonAsync(new
                    {
                        error = "Something went wrong on our end. We've logged the details so support can look into it.",
                        errorId = code, category = "SRV",
                    });
                }
                return;
            }

            var status = ctx.Response.StatusCode;
            buffer.Position = 0;
            var body = await new StreamReader(buffer).ReadToEndAsync();
            buffer.Position = 0;
            var ms = Stopwatch.GetElapsedTime(started).TotalMilliseconds;

            if (status >= 500)
            {
                // Unexpected server/upstream failure that came back as a response (not an
                // exception). Stamp a correlation code, log it, and merge it into the body.
                var code = NewCode(CategoryFor(status));
                var detail = body.Length > MaxDetail ? body[..MaxDetail] + "…" : (string.IsNullOrWhiteSpace(body) ? "(no body)" : body);
                logger.LogError("{Method} {Path} → {Status} [{ErrorId}] (role={Role}, {Elapsed:0}ms) — {Detail}",
                    ctx.Request.Method, ctx.Request.Path.Value ?? "", status, code, Role(), ms, detail);
                ctx.Response.Body = originalBody;
                await ctx.Response.WriteAsJsonAsync(WithCode(body, code, CategoryFor(status)));
                return;
            }

            if (status >= 400)
            {
                // Expected, user-actionable (validation / permission / not-found). Log at
                // Warning with the endpoint's own clear message; no scary code needed.
                var detail = body.Length > MaxDetail ? body[..MaxDetail] + "…" : (string.IsNullOrWhiteSpace(body) ? "(no body)" : body);
                logger.LogWarning("{Method} {Path} → {Status} (role={Role}, {Elapsed:0}ms) — {Detail}",
                    ctx.Request.Method, ctx.Request.Path.Value ?? "", status, Role(), ms, detail);
            }

            // Restore the real body stream and flush the buffered response through it.
            ctx.Response.Body = originalBody;
            await buffer.CopyToAsync(originalBody);
        });
    }
}
