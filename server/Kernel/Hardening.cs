using System.Threading.RateLimiting;

namespace Atlas.Api;

// ============================================================================
//  HTTP hardening — response security headers, a generous per-client rate limit,
//  and upload validation. The Content-Security-Policy lives on the edge (nginx,
//  deploy/nginx.conf) where the HTML app shell is served — that's the surface a
//  CSP protects. It is intentionally NOT set here: these API responses are JSON
//  and file downloads (the latter forced to attachment + nosniff, so they never
//  render in-origin), and the optional Swagger UI at /swagger is inline-scripted,
//  which a strict app CSP would break. See docs/security-hardening.md.
// ============================================================================
public static class Hardening
{
    // ---- Security headers (defence-in-depth; nginx sets these too) --------
    public static void UseSecurityHeaders(this WebApplication app)
    {
        app.Use(async (ctx, next) =>
        {
            var h = ctx.Response.Headers;
            h["X-Content-Type-Options"] = "nosniff";           // no MIME sniffing
            h["X-Frame-Options"] = "DENY";                      // no framing (clickjacking)
            h["Referrer-Policy"] = "strict-origin-when-cross-origin";
            h["X-Permitted-Cross-Domain-Policies"] = "none";
            // HSTS is only meaningful over TLS; browsers ignore it on plain HTTP,
            // so it's safe to always emit (nginx terminates TLS in front of us).
            h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
            await next();
        });
    }

    // ---- CORS -------------------------------------------------------------
    // Same-origin in production (nginx proxies /api), so cross-origin is denied by
    // default. Set Cors:Origins (comma-separated) only if a separate web origin
    // ever needs access. Empty ⇒ no cross-origin allowed.
    public const string CorsPolicy = "atlas";
    public static string[] CorsOrigins(IConfiguration cfg) =>
        (cfg["Cors:Origins"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    // ---- Rate limiting ----------------------------------------------------
    // A generous per-client fixed window: ample for a dashboard's burst of reads,
    // but caps abuse/DoS. Keyed by authenticated user, else client IP.
    public static void AddAtlasRateLimiter(this IServiceCollection services)
    {
        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
            {
                var key = ctx.User?.Identity?.IsAuthenticated == true
                    ? (ctx.User.FindFirst("oid")?.Value ?? ctx.User.Identity!.Name ?? "user")
                    : (ctx.Connection.RemoteIpAddress?.ToString() ?? "anon");
                return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 600,                 // 600 requests…
                    Window = TimeSpan.FromMinutes(1),  // …per minute per client (10/s sustained)
                    QueueLimit = 0,
                });
            });
            o.OnRejected = async (ctx, token) =>
            {
                ctx.HttpContext.Response.ContentType = "application/json";
                await ctx.HttpContext.Response.WriteAsync(
                    "{\"error\":\"You're doing that a bit too fast — please wait a moment and try again.\"}", token);
            };
        });
    }

    // ---- Upload validation (size + type allowlist) ------------------------
    public const long MaxUploadBytes = 25 * 1024 * 1024;  // 25 MB

    // Document, image, data and archive types a PPM tool legitimately handles.
    static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".md", ".rtf",
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp",
        ".zip", ".json", ".xml", ".yaml", ".yml", ".vsdx", ".drawio", ".mpp", ".log",
    };

    // Returns null when the upload is acceptable, else a friendly reason.
    public static string? ValidateUpload(string? fileName, long size)
    {
        if (size <= 0) return "No file provided.";
        if (size > MaxUploadBytes) return $"That file is larger than the {MaxUploadBytes / (1024 * 1024)} MB limit.";
        var ext = Path.GetExtension(fileName ?? "");
        if (string.IsNullOrEmpty(ext)) return "That file has no extension, so it can't be accepted.";
        if (!AllowedExtensions.Contains(ext)) return $"Files of type “{ext}” aren't allowed.";
        return null;
    }
}
