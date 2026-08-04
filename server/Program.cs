using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Atlas.Api;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

// Process role — split the request-serving API from the recurring background
// workers so a portfolio-wide sync / retention / capacity pass can't starve user
// requests (ADR-0048). "all" (default) runs everything in one container, exactly
// as before; "web" serves the API only; "worker" runs the timer-driven
// background services only. On-demand sync consumers stay with the web role
// (their queue is in-process) — see ADR-0048 for the durable-queue follow-up.
var role = (cfg["Atlas:Role"] ?? "all").Trim().ToLowerInvariant();
if (role is not ("web" or "worker" or "all"))
    throw new InvalidOperationException($"Atlas:Role must be 'web', 'worker' or 'all' (got '{role}').");
var runWeb = role is "web" or "all";
var runWorker = role is "worker" or "all";

// Layer in file-mounted (Docker/K8s) secrets and, when configured, Azure Key
// Vault — before anything reads a connection string. Inert unless configured.
builder.AddAtlasSecrets();

// Enforce TLS in transit when configured (Database:SslMode, e.g. Require on
// Azure). Non-breaking: unset ⇒ Npgsql's opportunistic default.
var pgConnString = Db.ApplySslMode(
    cfg.GetConnectionString("Postgres") ?? "Host=db;Port=5432;Database=atlas;Username=atlas;Password=atlas",
    cfg["Database:SslMode"]);
builder.Services.AddDbContext<AtlasDbContext>(o =>
    o.UseNpgsql(pgConnString,
        npg =>
        {
            // Survive transient Postgres drops (failover, restarts, brief network
            // blips) instead of failing the request outright.
            npg.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorCodesToAdd: null);
            npg.CommandTimeout(30);
        })
        // Record DB command durations into the atlas.db.command.duration metric.
        .AddInterceptors(new AtlasDbMetricsInterceptor()));

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

// ---- Recurring background workers (worker role) ------------------------------
// These fire unattended on a timer and can be portfolio-wide, so they run in the
// worker container to keep heavy scans off the request-serving path (ADR-0048).

// Daily data-retention pass (anonymises records past the window; default 10y).
// On by default; nothing is touched until records actually age out.
if (runWorker && cfg.GetValue("Retention:Enabled", true))
    builder.Services.AddHostedService<RetentionHostedService>();

// Scheduled Jira sync (on by default; idle until a Jira connector is configured).
if (runWorker && cfg.GetValue("Jira:ScheduledSync", true))
    builder.Services.AddHostedService<JiraSyncService>();

// Periodic over-allocation alerts (on by default; emits only to users who opt
// into the "over_allocation" event, so it's silent until someone subscribes).
if (runWorker && cfg.GetValue("Capacity:Alerts", true))
    builder.Services.AddHostedService<CapacityAlertService>();

// ---- On-demand sync queues + workers (web role) ------------------------------
// Manual syncs enqueue a job and return 202 so a large re-sync can't 504 the
// browser (ADR-0030/0039). The queue is in-process, so the consuming worker
// lives with the endpoints that enqueue into it (the web role). The singletons
// register in every role so the enqueue endpoints and the depth gauge resolve.
builder.Services.AddSingleton<JiraSyncQueue>();
builder.Services.AddSingleton<AdoSyncQueue>();
if (runWeb)
{
    builder.Services.AddHostedService<JiraSyncWorker>();
    builder.Services.AddHostedService<AdoSyncWorker>();
}

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

// ---- Production safety fuses -------------------------------------------------
// The convenient local defaults (anonymous API, baked-in "atlas" DB password)
// are fine for a dev box but must never reach a real deployment. Refuse to boot
// in the Production environment if either slipped through, rather than silently
// serving an unauthenticated API or connecting with the shipped default
// credential. Development/Testing runs (and the test suite) are unaffected.
if (builder.Environment.IsProduction())
{
    if (!authEnabled)
        throw new InvalidOperationException(
            "Auth:Enabled=false in the Production environment. The API would serve " +
            "every request anonymously with full access. Set Auth:Enabled=true and " +
            "configure Auth__TenantId / Auth__Audience, or run outside Production.");

    var pw = new Npgsql.NpgsqlConnectionStringBuilder(pgConnString).Password;
    if (pw == "atlas")
        throw new InvalidOperationException(
            "The database is using the built-in default password 'atlas' in the " +
            "Production environment. Set a real credential via the Postgres " +
            "connection string (env: ConnectionStrings__Postgres) or a mounted secret.");
}

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
            // Browsers can't set an Authorization header on the WebSocket
            // handshake, so the SignalR client passes the bearer token as an
            // access_token query-string value on the hub URL. Accept it only for
            // the hub path — everything else still requires the header (ADR-0061).
            o.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    var accessToken = ctx.Request.Query["access_token"];
                    if (!string.IsNullOrEmpty(accessToken) &&
                        ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                        ctx.Token = accessToken;
                    return Task.CompletedTask;
                },
            };
        });
    builder.Services.AddAuthorization();
}

// Real-time transport for the PI Program Board (presence, cursors, change
// pings). No domain writes ride the hub — see BoardHub / ADR-0061. Force
// camelCase payloads so the hub's Peer record matches the TS client's fields
// regardless of the SignalR default.
builder.Services.AddSignalR().AddJsonProtocol(o =>
    o.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

var app = builder.Build();
var startupLog = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Atlas.Startup");
startupLog.LogInformation("Atlas {Role} starting — auth {AuthMode}",
    role, authEnabled ? "ENABLED (Entra bearer)" : "disabled (anonymous, dev)");
// Give the static notification emit path a real logger for email diagnostics.
Notifications.UseLogger(app.Services.GetRequiredService<ILoggerFactory>());
// Expose background-sync queue depth as an observable gauge (per connector).
AtlasTelemetry.RegisterQueueGauges(
    () => app.Services.GetRequiredService<JiraSyncQueue>().Pending,
    () => app.Services.GetRequiredService<AdoSyncQueue>().Pending);
// Live PI board hub gauges (connections + active boards) — see BoardHub.
AtlasTelemetry.RegisterBoardGauges(() => BoardHub.ActiveConnections, () => BoardHub.ActiveBoards);
Teams.UseLogger(app.Services.GetRequiredService<ILoggerFactory>());
TeamsNotify.UseLogger(app.Services.GetRequiredService<ILoggerFactory>());
// Give the connectors, personnel crypto and the other silent-degradation paths a
// real logger so best-effort failures leave evidence rather than reporting success.
var lf = app.Services.GetRequiredService<ILoggerFactory>();
Jira.UseLogger(lf);
AzureDevOps.UseLogger(lf);
PersonnelCrypto.UseLogger(lf);
Whiteboards.UseLogger(lf);
Gdpr.UseLogger(lf);
WriteEndpoints.UseLogger(lf);
BoardHub.UseLogger(lf);

// Apply migrations on startup. The web/all role owns the schema (a single
// migrator avoids two containers racing Migrate()); the worker role skips this
// and starts after the web container has initialised the database (compose
// depends_on / a k8s migration job). Demo seed is OFF by default — production
// starts empty and fills with real data; set Seed:Enabled=true (env
// Seed__Enabled) to preload the demo portfolio for a walkthrough. Idempotent.
if (runWeb)
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
        // Start the DB-password rotation clock at first deploy (idempotent).
        await SecretRotation.EnsureAnchorAsync(db);
        // Migrate any legacy whiteboard blob scenes to typed rows (idempotent;
        // no-op once done) — see ADR-0064 / Whiteboards.BackfillAsync.
        await Whiteboards.BackfillAsync(db);
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
// The API surface is served only by the web/all role; the worker exposes just
// the liveness/readiness probes above (for orchestrator health checks).
if (runWeb)
{
    app.MapAtlasEndpoints();
    // PI Program Board real-time hub. Same-origin (proxied at /hubs by nginx);
    // requires auth in lock-step with the API when Auth:Enabled.
    var board = app.MapHub<BoardHub>("/hubs/board");
    if (authEnabled) board.RequireAuthorization();
}

startupLog.LogInformation("Atlas {Role} ready.", role);
app.Run();

// Exposed so WebApplicationFactory<Program> can host the app in integration
// tests (the implicit top-level Program class is otherwise inaccessible).
public partial class Program { }
