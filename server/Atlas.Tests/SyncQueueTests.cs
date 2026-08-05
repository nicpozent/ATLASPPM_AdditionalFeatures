using Atlas.Api;
using Atlas.Api.Integrations;
using Xunit;

namespace Atlas.Tests;

// The shared connector pipeline (ADR-0083, R15): one generic SyncQueue<T> +
// SyncWorker<T> + IWorkItemConnector replace the former per-connector copies.
// The end-to-end enqueue path needs a configured connector (absent in the test
// host), so the queue's own contract and the adapters are covered here; the
// import loops themselves stay in JiraSyncFixtureTests / AdoSyncFixtureTests.
public class SyncQueueTests
{
    [Fact]
    public void Queue_tracks_a_queued_job_that_can_be_read_and_advanced()
    {
        var q = new SyncQueue<JiraConnector>();
        var status = q.Enqueue("project", "PRJ-1", delta: true, actor: "Ada", role: "admin");

        Assert.False(string.IsNullOrEmpty(status.Id));
        Assert.Equal("queued", status.State);
        Assert.Equal("project", status.Kind);
        Assert.Equal("PRJ-1", status.TargetId);

        Assert.True(q.TryGet(status.Id, out var found));
        Assert.Same(status, found);

        // The worker advances the same tracked record.
        q.Update(status.Id, s => { s.State = "done"; s.Tasks = 42; s.Projects = 1; });
        Assert.True(q.TryGet(status.Id, out var done));
        Assert.Equal("done", done!.State);
        Assert.Equal(42, done.Tasks);
        Assert.Equal(1, done.Projects);

        // The enqueued job is readable off the channel for the worker.
        Assert.True(q.Reader.TryRead(out var job));
        Assert.Equal(status.Id, job!.Id);
        Assert.Equal("PRJ-1", job.TargetId);
        Assert.True(job.Delta);
    }

    [Fact]
    public void Unknown_job_id_is_not_found()
    {
        var q = new SyncQueue<AdoConnector>();
        Assert.False(q.TryGet("nope", out var s));
        Assert.Null(s);
    }

    // The same generic queue serves each connector as a distinct DI type — this
    // is what lets one implementation back both (and the four planned connectors).
    [Fact]
    public void The_generic_queue_serves_each_connector_independently()
    {
        var jira = new SyncQueue<JiraConnector>();
        var ado = new SyncQueue<AdoConnector>();
        var j = jira.Enqueue("all", "all", delta: false, actor: "Ada", role: "admin");
        // A job tracked in the Jira queue is not visible in the ADO queue.
        Assert.True(jira.TryGet(j.Id, out _));
        Assert.False(ado.TryGet(j.Id, out _));
    }

    [Theory]
    [InlineData(typeof(JiraConnector), "jira", "Jira")]
    [InlineData(typeof(AdoConnector), "ado", "Azure DevOps")]
    public void Connector_adapters_expose_their_identity_and_are_unconfigured_by_default(
        System.Type connectorType, string name, string displayName)
    {
        var connector = (IWorkItemConnector)System.Activator.CreateInstance(connectorType)!;
        Assert.Equal(name, connector.Name);
        Assert.Equal(displayName, connector.DisplayName);
        // No credentials in the test host → not configured (so the worker fails the
        // job gracefully rather than calling out).
        Assert.False(connector.Configured(new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build()));
    }
}
