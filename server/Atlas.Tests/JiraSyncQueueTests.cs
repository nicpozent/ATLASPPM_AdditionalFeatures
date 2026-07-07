using Atlas.Api;
using Xunit;

namespace Atlas.Tests;

// The background Jira-sync queue tracks job status so the UI can poll it after a
// 202. (The end-to-end enqueue path needs a configured Jira connector, which the
// test host doesn't have, so the queue's own contract is covered here.)
public class JiraSyncQueueTests
{
    [Fact]
    public void Enqueue_tracks_a_queued_job_that_can_be_read_and_advanced()
    {
        var q = new JiraSyncQueue();
        var status = q.Enqueue("project", "PRJ-1", delta: true, actor: "Ada", role: "admin");

        Assert.False(string.IsNullOrEmpty(status.Id));
        Assert.Equal("queued", status.State);
        Assert.Equal("project", status.Kind);

        Assert.True(q.TryGet(status.Id, out var found));
        Assert.Same(status, found);

        // The worker advances the same tracked record.
        q.Update(status.Id, s => { s.State = "done"; s.Tasks = 42; });
        Assert.True(q.TryGet(status.Id, out var done));
        Assert.Equal("done", done!.State);
        Assert.Equal(42, done.Tasks);

        // A job that was enqueued is readable off the channel for the worker.
        Assert.True(q.Reader.TryRead(out var job));
        Assert.Equal(status.Id, job!.Id);
        Assert.Equal("PRJ-1", job.TargetId);
        Assert.True(job.Delta);
    }

    [Fact]
    public void Unknown_job_id_is_not_found()
    {
        var q = new JiraSyncQueue();
        Assert.False(q.TryGet("nope", out var s));
        Assert.Null(s);
    }
}
