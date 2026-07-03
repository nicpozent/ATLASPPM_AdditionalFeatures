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

// Apply migrations and seed on startup (idempotent).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
    db.Database.Migrate();
    await Seed.RunAsync(db);
}

if (authEnabled)
{
    app.UseAuthentication();
    app.UseAuthorization();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapAtlasEndpoints();

app.Run();
