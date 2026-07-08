using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Atlas.Api;

// ============================================================================
//  Background Azure DevOps sync (ADR-0039) — the ADO analogue of JiraSyncQueue
//  (ADR-0030). A full work-item pull of a large project can exceed the edge
//  timeout, so the sync endpoints can run in the background: they enqueue a job
//  here, return 202 immediately, and the UI polls job status. The synchronous
//  path stays the default (tests and small syncs behave exactly as before).
// ============================================================================
public class AdoSyncJob
{
    public string Id { get; init; } = default!;
    public string TargetId { get; init; } = "all";   // "all" | a project id
    public string Actor { get; init; } = "system";
    public string Role { get; init; } = "system";
    public bool Delta { get; init; }                  // changed-since pull (vs full)
}

public class AdoJobStatus
{
    public string Id { get; set; } = default!;
    public string TargetId { get; set; } = "all";
    public string State { get; set; } = "queued";     // queued | running | done | failed
    public int Projects { get; set; }
    public int Sprints { get; set; }
    public int Epics { get; set; }
    public int Tasks { get; set; }
    public List<string> Errors { get; set; } = new();
    public string? Error { get; set; }
    public string At { get; set; } = "";              // ISO timestamp of last update
}

public class AdoSyncQueue
{
    readonly Channel<AdoSyncJob> _channel = Channel.CreateUnbounded<AdoSyncJob>();
    readonly ConcurrentDictionary<string, AdoJobStatus> _status = new();
    const int MaxTracked = 200;

    public ChannelReader<AdoSyncJob> Reader => _channel.Reader;

    // Pending (unread) jobs — surfaced as a metric gauge (ADR-0040).
    public int Pending => _channel.Reader.CanCount ? _channel.Reader.Count : 0;

    public AdoJobStatus Enqueue(string targetId, string actor, string role, bool delta = false)
    {
        var id = Guid.NewGuid().ToString("n")[..12];
        var status = new AdoJobStatus { Id = id, TargetId = targetId, State = "queued", At = DateTime.UtcNow.ToString("o") };
        _status[id] = status;
        if (_status.Count > MaxTracked)
            foreach (var stale in _status.Values.OrderBy(s => s.At).Take(_status.Count - MaxTracked).ToList())
                _status.TryRemove(stale.Id, out _);
        _channel.Writer.TryWrite(new AdoSyncJob { Id = id, TargetId = targetId, Actor = actor, Role = role, Delta = delta });
        return status;
    }

    public bool TryGet(string id, out AdoJobStatus? status) => _status.TryGetValue(id, out status);
    public void Update(string id, Action<AdoJobStatus> mutate)
    {
        if (_status.TryGetValue(id, out var s)) { mutate(s); s.At = DateTime.UtcNow.ToString("o"); }
    }
}

// Consumes queued jobs one at a time, each in its own DI scope, recording a
// completion audit event under the enqueuing user's identity.
public class AdoSyncWorker(IServiceProvider sp, IConfiguration cfg, AdoSyncQueue queue, ILogger<AdoSyncWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken))
        {
            queue.Update(job.Id, s => s.State = "running");
            try
            {
                if (!AzureDevOps.AdoConfigured(cfg))
                {
                    queue.Update(job.Id, s => { s.State = "failed"; s.Error = "Azure DevOps isn't configured."; });
                    continue;
                }
                using var scope = sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
                var targets = await AzureDevOps.ResolveSyncTargetsAsync(db, job.TargetId);
                var r = await AzureDevOps.SyncProjectsCoreAsync(db, cfg, targets, job.Delta);
                db.AuditEvents.Add(new AuditEvent
                {
                    At = DateTime.UtcNow, Actor = job.Actor, Role = job.Role, Category = "Integrations",
                    Action = "Synced Azure DevOps (background)",
                    Target = $"{job.TargetId} · {r.Projects} projects, {r.Sprints} sprints, {r.Epics} epics, {r.Tasks} tasks",
                });
                await db.SaveChangesAsync(stoppingToken);
                queue.Update(job.Id, s =>
                {
                    s.State = "done"; s.Projects = r.Projects; s.Sprints = r.Sprints;
                    s.Epics = r.Epics; s.Tasks = r.Tasks; s.Errors = r.Errors;
                });
                log.LogInformation("Background ADO sync {Job} ({Target}) complete: {P} projects, {T} tasks", job.Id, job.TargetId, r.Projects, r.Tasks);
            }
            catch (Exception ex)
            {
                queue.Update(job.Id, s => { s.State = "failed"; s.Error = ex.Message; });
                log.LogWarning(ex, "Background ADO sync {Job} failed", job.Id);
            }
        }
    }
}
