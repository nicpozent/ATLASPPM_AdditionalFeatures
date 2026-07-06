using Xunit;

// The integration tests share a single in-memory database per WebApplicationFactory.
// Running test collections in parallel occasionally races the shared store and aborts
// the test host ("VSTestTask returned false but did not log an error"), which shows up
// as a spurious CI failure. Disable cross-collection parallelization so the suite runs
// deterministically; it stays fast (a few seconds) at this size.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
