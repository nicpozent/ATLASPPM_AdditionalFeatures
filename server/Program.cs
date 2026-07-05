using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Atlas.Api;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

builder.Services.AddDbContext<AtlasDbContext>(o =>
    o.UseNpgsql(cfg.GetConnectionString("Postgres")
        ?? "Host=db;Port=5432;Database=atlas;Username=atlas;Password=atlas"));

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
        db.Database.Migrate();
        startupLog.LogInformation("Database migrations applied.");
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

if (authEnabled)
{
    app.UseAuthentication();
    app.UseAuthorization();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapAtlasEndpoints();

startupLog.LogInformation("Atlas API ready.");
app.Run();
