using Atlas.Api;
using Xunit;

namespace Atlas.Tests;

// The background Azure DevOps sync queue tracks job status so the UI can poll it
// after a 202. The end-to-end enqueue path needs a configured ADO connector
// (absent in the test host), so the queue's own contract is covered here.
public class AdoSyncQueueTests
{
    [Fact]
    public void Enqueue_tracks_a_queued_job_that_can_be_read_and_advanced()
    {
        var q = new AdoSyncQueue();
        var status = q.Enqueue("all", actor: "Ada", role: "admin");

        Assert.False(string.IsNullOrEmpty(status.Id));
        Assert.Equal("queued", status.State);
        Assert.Equal("all", status.TargetId);

        Assert.True(q.TryGet(status.Id, out var found));
        Assert.Same(status, found);

        // The worker advances the same tracked record.
        q.Update(status.Id, s => { s.State = "done"; s.Tasks = 17; s.Projects = 2; });
        Assert.True(q.TryGet(status.Id, out var done));
        Assert.Equal("done", done!.State);
        Assert.Equal(17, done.Tasks);
        Assert.Equal(2, done.Projects);

        // The enqueued job is readable off the channel for the worker.
        Assert.True(q.Reader.TryRead(out var job));
        Assert.Equal(status.Id, job!.Id);
        Assert.Equal("all", job.TargetId);
    }

    [Fact]
    public void Unknown_job_id_is_not_found()
    {
        var q = new AdoSyncQueue();
        Assert.False(q.TryGet("nope", out var s));
        Assert.Null(s);
    }
}
