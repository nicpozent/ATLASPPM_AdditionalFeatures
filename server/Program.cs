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
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(o =>
        {
            o.Authority = $"https://login.microsoftonline.com/{cfg["Auth:TenantId"]}/v2.0";
            o.Audience = cfg["Auth:Audience"];
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
