using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Integrations;

// ============================================================================
//  Scheduled Jira sync — a background service that re-pulls every Jira-linked
//  project on an interval (Jira:SyncMinutes, default 30) so tasks/sprints stay
//  current without anyone pressing "Sync". Only runs when Jira is configured;
//  each project is best-effort so one failure doesn't stop the pass. The manual
//  sync endpoint and the auto-pull on linking a project remain the on-demand paths.
// ============================================================================
public class JiraSyncService(IServiceProvider sp, IConfiguration cfg, ILogger<JiraSyncService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var minutes = Math.Max(5, cfg.GetValue("Jira:SyncMinutes", 30));
        // Let the app finish starting (migrations, seed) before the first pass.
        try { await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken); }
        catch (OperationCanceledException) { return; }

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(minutes));
        do
        {
            if (!Jira.JiraConfigured(cfg)) continue;   // nothing to do until a connector is set
            try
            {
                using var scope = sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AtlasDbContext>();
                var linked = await db.Projects.Where(p => !p.Archived && p.JiraProjectKey != "").ToListAsync(stoppingToken);
                if (linked.Count == 0) continue;
                using var c = Jira.Client(cfg);
                foreach (var p in linked)
                {
                    try { await Jira.SyncProjectAsync(db, cfg, c, p); }
                    catch (Exception ex) { log.LogWarning(ex, "Scheduled Jira sync failed for project {Project}", p.Id); }
                }
                log.LogInformation("Scheduled Jira sync pass complete ({Count} project(s)).", linked.Count);
            }
            catch (Exception ex) { log.LogWarning(ex, "Scheduled Jira sync pass failed"); }
        }
        while (await SafeWait(timer, stoppingToken));
    }

    static async Task<bool> SafeWait(PeriodicTimer timer, CancellationToken ct)
    {
        try { return await timer.WaitForNextTickAsync(ct); }
        catch (OperationCanceledException) { return false; }
    }
}
