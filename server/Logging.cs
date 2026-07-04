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
                // Log the full exception with context, then return a clean 500 so
                // stack traces / internal details never reach the client.
                ctx.Response.Body = originalBody;
                logger.LogError(ex,
                    "Unhandled exception: {Method} {Path} (role={Role}) — {Message}",
                    ctx.Request.Method, ctx.Request.Path.Value, Role(), ex.Message);
                if (!ctx.Response.HasStarted)
                {
                    ctx.Response.Clear();
                    ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
                    ctx.Response.ContentType = "application/json";
                    await ctx.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred. Please try again; the details have been logged for support." });
                }
                return;
            }

            var status = ctx.Response.StatusCode;
            buffer.Position = 0;
            var body = await new StreamReader(buffer).ReadToEndAsync();
            buffer.Position = 0;

            if (status >= 400)
            {
                var ms = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
                var detail = body.Length > MaxDetail ? body[..MaxDetail] + "…" : body;
                if (string.IsNullOrWhiteSpace(detail)) detail = "(no body)";
                const string template = "{Method} {Path} → {Status} (role={Role}, {Elapsed:0}ms) — {Detail}";
                object[] args = { ctx.Request.Method, ctx.Request.Path.Value ?? "", status, Role(), ms, detail };
                if (status >= 500) logger.LogError(template, args);
                else logger.LogWarning(template, args);
            }

            // Restore the real body stream and flush the buffered response through it.
            ctx.Response.Body = originalBody;
            await buffer.CopyToAsync(originalBody);
        });
    }
}
