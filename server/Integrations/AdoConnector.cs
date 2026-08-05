namespace Atlas.Api.Integrations;

// Azure DevOps as an IWorkItemConnector (ADR-0083). A thin adapter over the
// existing AzureDevOps static pipeline — the connector-specific WIQL/paging/PAT
// auth stays in AzureDevOps.cs; this only exposes the shared surface.
public sealed class AdoConnector : IWorkItemConnector
{
    public string Name => "ado";
    public string DisplayName => "Azure DevOps";
    public bool Configured(IConfiguration cfg) => AzureDevOps.AdoConfigured(cfg);
    // ADO doesn't scope by program/product — it keys off targetId ("all" | id).
    public Task<List<Project>> ResolveTargetsAsync(AtlasDbContext db, string kind, string targetId)
        => AzureDevOps.ResolveSyncTargetsAsync(db, targetId);
    public Task<BulkSyncResult> SyncCoreAsync(AtlasDbContext db, IConfiguration cfg, List<Project> targets, bool delta)
        => AzureDevOps.SyncProjectsCoreAsync(db, cfg, targets, delta);
}
