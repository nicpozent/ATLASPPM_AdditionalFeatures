using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Atlas.Api.Integrations;

// ============================================================================
//  Shared work-item connector abstraction (ADR-0083). Jira and Azure DevOps
//  are the same pipeline with connector-specific parsing: a configured check, a
//  target resolver, a best-effort bulk sync, plus a background queue + worker
//  and a manual-trigger/202/poll endpoint contract. Those shared parts live
//  here EXACTLY ONCE; the connector-specific bits (JQL/ADF for Jira, WIQL for
//  ADO) stay in Jira.cs / AzureDevOps.cs behind IWorkItemConnector.
//
//  This is the seam the four planned connectors (ServiceNow, ManageEngine SDP,
//  GitHub, Confluence — CLAUDE.md §5) implement instead of copying a file.
// ============================================================================

// Roll-up counts for a multi-project sync pass. Shared by both connectors
// (was Jira.BulkSyncResult + AzureDevOps.AdoBulkResult — identical shapes).
public record BulkSyncResult(int Projects, int Sprints, int Epics, int Tasks, List<string> Errors);

// A tracker Atlas can pull work items from. Implementations own the
// connector-specific transport, auth, paging and field parsing; everything on
// this interface is what the shared queue / worker / endpoints need.
public interface IWorkItemConnector
{
    string Name { get; }         // route + audit slug, e.g. "jira" | "ado"
    string DisplayName { get; }  // human label, e.g. "Jira" | "Azure DevOps"
    bool Configured(IConfiguration cfg);
    // Which mapped, non-archived projects a job should sync. `kind` scopes the
    // pass (all | project | program | product); connectors that don't scope
    // (ADO) may ignore it and key off targetId.
    Task<List<Project>> ResolveTargetsAsync(AtlasDbContext db, string kind, string targetId);
    // Best-effort bulk sync (one project failing doesn't stop the pass); stamps
    // each project's watermark and saves.
    Task<BulkSyncResult> SyncCoreAsync(AtlasDbContext db, IConfiguration cfg, List<Project> targets, bool delta);
}

// Canonical delta watermark. Stored on Project.LastJiraSync / LastAdoSync as
// UTC ISO-8601 so both connectors agree and a future move to a real timestamptz
// column (ADR-0082) is a no-op reformat. Each connector reformats it into its
// own query language at read time (Jira.DeltaClause → JQL; ADO.ChangedSinceClause
// → WIQL, which already accepts ISO).
public static class SyncWatermark
{
    public static string Now() => DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
}

// A queued background sync. `Kind` scopes it (all|project|program|product);
// `TargetId` is the entity id ("" or "all" for a portfolio-wide pass).
public class SyncJob
{
    public string Id { get; init; } = default!;
    public string Kind { get; init; } = "all";
    public string TargetId { get; init; } = "";
    public bool Delta { get; init; }
    public string Actor { get; init; } = "system";
    public string Role { get; init; } = "system";
}

public class SyncJobStatus
{
    public string Id { get; set; } = default!;
    public string Kind { get; set; } = "all";
    public string TargetId { get; set; } = "";
    public string State { get; set; } = "queued";     // queued | running | done | failed
    public int Projects { get; set; }
    public int Sprints { get; set; }
    public int Epics { get; set; }
    public int Tasks { get; set; }
    public List<string> Errors { get; set; } = new();
    public string? Error { get; set; }
    public string At { get; set; } = "";              // ISO timestamp of last update
}

// One background queue, parameterised by connector so DI hands each connector
// its own channel + status map. `TConnector` is a phantom type used only to
// key the DI registration — the body is connector-agnostic. Replaces the
// former JiraSyncQueue + AdoSyncQueue (identical implementations).
public class SyncQueue<TConnector> where TConnector : IWorkItemConnector
{
    readonly Channel<SyncJob> _channel = Channel.CreateUnbounded<SyncJob>();
    // Bounded memory of recent jobs so the UI can poll status; old entries are
    // pruned once we exceed the cap (jobs are ephemeral progress, not records —
    // the audit log is the durable trail).
    readonly ConcurrentDictionary<string, SyncJobStatus> _status = new();
    const int MaxTracked = 200;

    public ChannelReader<SyncJob> Reader => _channel.Reader;

    // Pending (unread) jobs — surfaced as a metric gauge (ADR-0040).
    public int Pending => _channel.Reader.CanCount ? _channel.Reader.Count : 0;

    public SyncJobStatus Enqueue(string kind, string targetId, bool delta, string actor, string role)
    {
        var id = Guid.NewGuid().ToString("n")[..12];
        var status = new SyncJobStatus { Id = id, Kind = kind, TargetId = targetId, State = "queued", At = DateTime.UtcNow.ToString("o") };
        _status[id] = status;
        if (_status.Count > MaxTracked)
            foreach (var stale in _status.Values.OrderBy(s => s.At).Take(_status.Count - MaxTracked).ToList())
                _status.TryRemove(stale.Id, out _);
        _channel.Writer.TryWrite(new SyncJob { Id = id, Kind = kind, TargetId = targetId, Delta = delta, Actor = actor, Role = role });
        return status;
    }

    public bool TryGet(string id, out SyncJobStatus? status) => _status.TryGetValue(id, out status);
    public void Update(string id, Action<SyncJobStatus> mutate)
    {
        if (_status.TryGetValue(id, out var s)) { mutate(s); s.At = DateTime.UtcNow.ToString("o"); }
    }
}

// Consumes queued jobs one at a time, each in its own DI scope, recording a
// completion audit event under the enqueuing user's identity. Replaces the
// former JiraSyncWorker + AdoSyncWorker (identical loops, different connector).
public class SyncWorker<TConnector>(
    IServiceProvider sp, IConfiguration cfg, SyncQueue<TConnector> queue, TConnector connector, ILogger<SyncWorker<TConnector>> log)
    : BackgroundService where TConnector : IWorkItemConnector
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken))
        {
            queue.Update(job.Id, s => s.State = "running");
            try
            {
                if (!connector.Configured(cfg))
                {
                    queue.Update(job.Id, s => { s.State = "failed"; s.Error = $"{connector.DisplayName} isn't configured."; });
                    continue;
                }
                using var scope = sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
                var targets = await connector.ResolveTargetsAsync(db, job.Kind, job.TargetId);
                var r = await connector.SyncCoreAsync(db, cfg, targets, job.Delta);
                db.AuditEvents.Add(new AuditEvent
                {
                    At = DateTime.UtcNow, Actor = job.Actor, Role = job.Role, Category = "Integrations",
                    Action = $"{(job.Delta ? "Delta-synced" : "Synced")} {connector.DisplayName} (background)",
                    Target = $"{job.Kind} · {r.Projects} projects, {r.Sprints} sprints, {r.Epics} epics, {r.Tasks} tasks",
                });
                await db.SaveChangesAsync(stoppingToken);
                queue.Update(job.Id, s =>
                {
                    s.State = "done"; s.Projects = r.Projects; s.Sprints = r.Sprints;
                    s.Epics = r.Epics; s.Tasks = r.Tasks; s.Errors = r.Errors;
                });
                log.LogInformation("Background {Connector} sync {Job} ({Kind}) complete: {P} projects, {T} tasks",
                    connector.DisplayName, job.Id, job.Kind, r.Projects, r.Tasks);
            }
            catch (Exception ex)
            {
                queue.Update(job.Id, s => { s.State = "failed"; s.Error = ex.Message; });
                log.LogWarning(ex, "Background {Connector} sync {Job} failed", connector.DisplayName, job.Id);
            }
        }
    }
}

// The manual-trigger contract that must exist EXACTLY ONCE (a copied-not-shared
// version is what produced the R2 gate bug). Each connector's endpoint bodies
// keep their connector-specific pre-checks (mapped-key, not-configured message)
// and delegate the enqueue + 202 + poll to these helpers.
public static class SyncEndpoints
{
    // Enqueue a background sync under the caller's identity; 202 + pollable id.
    public static IResult Queue<TConnector>(
        SyncQueue<TConnector> queue, string connectorName, string displayName,
        HttpContext http, IConfiguration cfg, string kind, string targetId, bool delta)
        where TConnector : IWorkItemConnector
    {
        // Borrow Audit() only to resolve the caller's actor/role for the eventual
        // completion audit event (the worker has no HttpContext).
        var who = Permissions.Audit(http, cfg, "Integrations", $"Queued {displayName} sync", delta ? "delta" : "full");
        var status = queue.Enqueue(kind, targetId, delta, who.Actor, who.Role);
        return Results.Accepted($"/api/v1/integrations/{connectorName}/sync/status/{status.Id}",
            new { ok = true, queued = true, jobId = status.Id, state = status.State });
    }

    // The status/poll endpoint, registered once per connector.
    public static void MapSyncStatus<TConnector>(this RouteGroupBuilder api, string connectorName)
        where TConnector : IWorkItemConnector =>
        api.MapGet($"/integrations/{connectorName}/sync/status/{{jobId}}", (string jobId, SyncQueue<TConnector> queue) =>
            queue.TryGet(jobId, out var s) && s is not null ? Results.Ok(s) : Results.NotFound());
}
