using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Atlas.Api;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

builder.Services.AddDbContext<AtlasDbContext>(o =>
    o.UseNpgsql(cfg.GetConnectionString("Postgres")
        ?? "Host=db;Port=5432;Database=atlas;Username=atlas;Password=atlas",
        npg =>
        {
            // Survive transient Postgres drops (failover, restarts, brief network
            // blips) instead of failing the request outright.
            npg.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorCodesToAdd: null);
            npg.CommandTimeout(30);
        }));

// OpenAPI / Swagger — a machine-readable API surface + interactive docs at
// /swagger. On by default; set OpenApi:Enabled=false to disable in production.
var openApiEnabled = cfg.GetValue("OpenApi:Enabled", true);
if (openApiEnabled)
{
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(o =>
    {
        o.SwaggerDoc("v1", new() { Title = "Atlas PPM API", Version = "v1", Description = "Portfolio & Project Management REST API (/api/v1)." });
    });
}

// OpenTelemetry — traces/metrics/logs over OTLP, off unless an endpoint is
// configured (see Observability.cs and docs/observability.md).
builder.AddAtlasObservability();

// A generous per-client rate limit + a CORS policy (empty ⇒ same-origin only).
builder.Services.AddAtlasRateLimiter();
var corsOrigins = Hardening.CorsOrigins(cfg);
builder.Services.AddCors(o => o.AddPolicy(Hardening.CorsPolicy, p =>
{
    if (corsOrigins.Length > 0) p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
}));

// Entra ID bearer validation — enabled only when Auth:Enabled=true (parity with
// the frontend's VITE_AUTH_ENABLED). When off, the API is anonymous for local runs.
var authEnabled = cfg.GetValue("Auth:Enabled", false);
if (authEnabled)
{
    var tenantId = cfg["Auth:TenantId"];
    var audience = cfg["Auth:Audience"];
    // Fail fast on misconfiguration rather than starting an unprotected API.
    if (string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(audience))
        throw new InvalidOperationException(
            "Auth:Enabled=true but Auth:TenantId and/or Auth:Audience are not set. " +
            "Configure them (env: Auth__TenantId, Auth__Audience) or set Auth:Enabled=false.");

    // Accept the audience in both forms — the GUID and the api://GUID URI —
    // since the token's `aud` differs depending on how the scope was requested
    // (and single-app setups must request the GUID form; see AADSTS90009).
    var bare = audience.StartsWith("api://") ? audience["api://".Length..] : audience;
    var validAudiences = new[] { audience, bare, $"api://{bare}" }.Distinct().ToArray();

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(o =>
        {
            o.Authority = $"https://login.microsoftonline.com/{tenantId}/v2.0";
            o.TokenValidationParameters.ValidAudiences = validAudiences;
        });
    builder.Services.AddAuthorization();
}

var app = builder.Build();
var startupLog = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Atlas.Startup");
startupLog.LogInformation("Atlas API starting — auth {AuthMode}", authEnabled ? "ENABLED (Entra bearer)" : "disabled (anonymous, dev)");
// Give the static notification emit path a real logger for email diagnostics.
Notifications.UseLogger(app.Services.GetRequiredService<ILoggerFactory>());

// Apply migrations on startup. Demo seed is OFF by default — production starts
// empty and fills with real data; set Seed:Enabled=true (env Seed__Enabled) to
// preload the demo portfolio for a walkthrough. Seeding is idempotent.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
    try
    {
        // Relational providers run the real migrations; a non-relational
        // provider (the in-memory DB used by integration tests) has no
        // migration history, so create the schema directly instead.
        if (db.Database.IsRelational())
        {
            db.Database.Migrate();
            startupLog.LogInformation("Database migrations applied.");
        }
        else
        {
            db.Database.EnsureCreated();
            startupLog.LogInformation("Non-relational database created (test/in-memory).");
        }
        // Roles & capabilities are structural reference data (the permission matrix
        // chrome) — always seeded, idempotent, independent of the demo portfolio.
        await Rbac.SeedAsync(db);
        // Add capabilities introduced after the initial seed (idempotent).
        await Rbac.ReconcileAsync(db);
        // Help centre content is reference data — seed the curated baseline and
        // ensure the troubleshooting categories exist (idempotent).
        await Help.SeedAsync(db);
        if (cfg.GetValue("Seed:Enabled", false))
        {
            await Seed.RunAsync(db);
            startupLog.LogInformation("Demo portfolio seed applied (Seed:Enabled=true).");
        }
    }
    catch (Exception ex)
    {
        // A failed migration/seed leaves the API unusable — log clearly and stop.
        startupLog.LogCritical(ex, "Startup database initialisation failed: {Message}. " +
            "Check the Postgres connection string (ConnectionStrings__Postgres) and that the database is reachable.", ex.Message);
        throw;
    }
}

// Log & handle every failing request centrally before routing to endpoints.
app.UseAtlasRequestLogging();
if (openApiEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI(o => { o.SwaggerEndpoint("/swagger/v1/swagger.json", "Atlas PPM API v1"); o.DocumentTitle = "Atlas PPM API"; });
    startupLog.LogInformation("OpenAPI enabled — Swagger UI at /swagger.");
}
app.UseSecurityHeaders();
app.UseCors(Hardening.CorsPolicy);
app.UseRateLimiter();

if (authEnabled)
{
    app.UseAuthentication();
    app.UseAuthorization();
}

// Liveness — the process is up. Readiness — the database is actually reachable
// (returns 503 when not, so orchestrators don't route traffic to a broken pod).
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/readyz", async (AtlasDbContext db) =>
    await db.Database.CanConnectAsync()
        ? Results.Ok(new { status = "ready" })
        : Results.Json(new { status = "unavailable", error = "Database is not reachable." }, statusCode: StatusCodes.Status503ServiceUnavailable));
app.MapAtlasEndpoints();

startupLog.LogInformation("Atlas API ready.");
app.Run();

// Exposed so WebApplicationFactory<Program> can host the app in integration
// tests (the implicit top-level Program class is otherwise inaccessible).
public partial class Program { }
