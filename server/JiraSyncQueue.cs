using System.Collections.Concurrent;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Background Jira sync. A full re-sync of a large project can take longer than
//  the edge/gateway timeout, so the browser sees a 504 even though the sync is
//  fine. The manual sync endpoints can therefore run in the *background*: they
//  enqueue a job here, return 202 immediately, and the UI polls job status. The
//  synchronous path is unchanged (still the default) so tests and small syncs
//  behave exactly as before. See ADR-0030.
// ============================================================================
public class JiraSyncJob
{
    public string Id { get; init; } = default!;
    public string Kind { get; init; } = "all";      // all | project | program | product
    public string TargetId { get; init; } = "";
    public bool Delta { get; init; }
    public string Actor { get; init; } = "system";
    public string Role { get; init; } = "system";
}

public class JiraJobStatus
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

public class JiraSyncQueue
{
    readonly Channel<JiraSyncJob> _channel = Channel.CreateUnbounded<JiraSyncJob>();
    // Bounded memory of recent jobs so the UI can poll status; old entries are
    // pruned once we exceed the cap (jobs are ephemeral progress, not records —
    // the audit log is the durable trail).
    readonly ConcurrentDictionary<string, JiraJobStatus> _status = new();
    const int MaxTracked = 200;

    public ChannelReader<JiraSyncJob> Reader => _channel.Reader;

    public JiraJobStatus Enqueue(string kind, string targetId, bool delta, string actor, string role)
    {
        var id = Guid.NewGuid().ToString("n")[..12];
        var status = new JiraJobStatus { Id = id, Kind = kind, TargetId = targetId, State = "queued", At = DateTime.UtcNow.ToString("o") };
        _status[id] = status;
        if (_status.Count > MaxTracked)
            foreach (var stale in _status.Values.OrderBy(s => s.At).Take(_status.Count - MaxTracked).ToList())
                _status.TryRemove(stale.Id, out _);
        _channel.Writer.TryWrite(new JiraSyncJob { Id = id, Kind = kind, TargetId = targetId, Delta = delta, Actor = actor, Role = role });
        return status;
    }

    public bool TryGet(string id, out JiraJobStatus? status) => _status.TryGetValue(id, out status);
    public void Update(string id, Action<JiraJobStatus> mutate)
    {
        if (_status.TryGetValue(id, out var s)) { mutate(s); s.At = DateTime.UtcNow.ToString("o"); }
    }
}

// Consumes queued jobs one at a time, each in its own DI scope, and records a
// completion audit event under the enqueuing user's identity.
public class JiraSyncWorker(IServiceProvider sp, IConfiguration cfg, JiraSyncQueue queue, ILogger<JiraSyncWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken))
        {
            queue.Update(job.Id, s => s.State = "running");
            try
            {
                if (!Jira.JiraConfigured(cfg))
                {
                    queue.Update(job.Id, s => { s.State = "failed"; s.Error = "Jira isn't configured."; });
                    continue;
                }
                using var scope = sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
                var targets = await Jira.ResolveSyncTargetsAsync(db, job.Kind, job.TargetId);
                var r = await Jira.SyncProjectsCoreAsync(db, cfg, targets, job.Delta);
                db.AuditEvents.Add(new AuditEvent
                {
                    At = DateTime.UtcNow, Actor = job.Actor, Role = job.Role, Category = "Integrations",
                    Action = job.Delta ? "Delta-synced Jira (background)" : "Synced Jira (background)",
                    Target = $"{job.Kind} · {r.Projects} projects, {r.Sprints} sprints, {r.Epics} epics, {r.Tasks} tasks",
                });
                await db.SaveChangesAsync(stoppingToken);
                queue.Update(job.Id, s =>
                {
                    s.State = "done"; s.Projects = r.Projects; s.Sprints = r.Sprints;
                    s.Epics = r.Epics; s.Tasks = r.Tasks; s.Errors = r.Errors;
                });
                log.LogInformation("Background Jira sync {Job} ({Kind}) complete: {P} projects, {T} tasks", job.Id, job.Kind, r.Projects, r.Tasks);
            }
            catch (Exception ex)
            {
                queue.Update(job.Id, s => { s.State = "failed"; s.Error = ex.Message; });
                log.LogWarning(ex, "Background Jira sync {Job} failed", job.Id);
            }
        }
    }
}
