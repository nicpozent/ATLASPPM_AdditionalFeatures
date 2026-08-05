namespace Atlas.Api.Integrations;

// Jira as an IWorkItemConnector (ADR-0083). A thin adapter over the existing
// Jira static pipeline — the connector-specific JQL/ADF/sprint parsing stays in
// Jira.cs; this only exposes the shared surface the queue/worker/endpoints use.
public sealed class JiraConnector : IWorkItemConnector
{
    public string Name => "jira";
    public string DisplayName => "Jira";
    public bool Configured(IConfiguration cfg) => Jira.JiraConfigured(cfg);
    public Task<List<Project>> ResolveTargetsAsync(AtlasDbContext db, string kind, string targetId)
        => Jira.ResolveSyncTargetsAsync(db, kind, targetId);
    public Task<BulkSyncResult> SyncCoreAsync(AtlasDbContext db, IConfiguration cfg, List<Project> targets, bool delta)
        => Jira.SyncProjectsCoreAsync(db, cfg, targets, delta);
}
