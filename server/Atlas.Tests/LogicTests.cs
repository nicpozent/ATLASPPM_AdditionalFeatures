using Atlas.Api;
using Xunit;

namespace Atlas.Tests;

// Pure-logic unit tests — no database, fully deterministic. These pin the
// trickiest decision logic (authorization ranking, ARB roll-up, team roll-up,
// notification defaults, error codes) so refactors can't silently change it.
public class PermissionRankTests
{
    [Theory]
    [InlineData("F", 3)]
    [InlineData("E", 2)]
    [InlineData("V", 1)]
    [InlineData("N", 0)]
    [InlineData("", 0)]
    [InlineData("garbage", 0)]
    public void Rank_maps_levels(string level, int expected) => Assert.Equal(expected, Permissions.Rank(level));

    [Fact]
    public void Rank_is_strictly_ordered() =>
        Assert.True(Permissions.Rank("F") > Permissions.Rank("E")
                 && Permissions.Rank("E") > Permissions.Rank("V")
                 && Permissions.Rank("V") > Permissions.Rank("N"));
}

public class ArbRollupTests
{
    static List<ArchApproval> Board(params string[] decisions)
    {
        var list = new List<ArchApproval>();
        for (var i = 0; i < decisions.Length; i++)
            list.Add(new ArchApproval { ProjectId = "PRJ-1", Role = $"R{i}", Decision = decisions[i] });
        return list;
    }

    [Fact] public void Empty_board_is_not_started() => Assert.Equal("Not started", Architecture.ArbStatus(Board()));

    [Fact] public void All_pending_is_pending() => Assert.Equal("Pending", Architecture.ArbStatus(Board("pending", "pending")));

    [Fact] public void Some_signed_is_in_review() => Assert.Equal("In review", Architecture.ArbStatus(Board("approved", "pending")));

    [Fact] public void All_approved_is_approved() => Assert.Equal("Approved", Architecture.ArbStatus(Board("approved", "approved")));

    [Fact] public void Approved_with_a_condition_reflects_conditions() =>
        Assert.Equal("Approved with conditions", Architecture.ArbStatus(Board("approved", "conditions")));

    [Fact] public void Any_rejection_rejects_the_board() =>
        Assert.Equal("Rejected", Architecture.ArbStatus(Board("approved", "conditions", "rejected")));

    [Fact] public void Rejection_wins_even_over_pending() =>
        Assert.Equal("Rejected", Architecture.ArbStatus(Board("rejected", "pending")));
}

public class TeamRollupTests
{
    // teammgr → devmgr → (leaf); svcmgr is separate.
    static readonly Dictionary<string, string> Tree = new()
    {
        ["teammgr"] = "", ["devmgr"] = "teammgr", ["juniordev"] = "devmgr", ["svcmgr"] = "",
    };

    [Fact]
    public void Senior_manager_sees_whole_subtree()
    {
        var d = Teams.DescendantsOf("teammgr", Tree);
        Assert.Contains("teammgr", d);
        Assert.Contains("devmgr", d);
        Assert.Contains("juniordev", d);   // transitive roll-up
        Assert.DoesNotContain("svcmgr", d); // a sibling branch stays out of scope
    }

    [Fact]
    public void Leaf_manager_sees_only_self()
    {
        var d = Teams.DescendantsOf("juniordev", Tree);
        Assert.Equal(new HashSet<string> { "juniordev" }, d);
    }

    [Fact]
    public void Descendants_always_includes_self() => Assert.Contains("svcmgr", Teams.DescendantsOf("svcmgr", Tree));
}

public class NotificationPrefTests
{
    [Theory]
    [InlineData("risk")]
    [InlineData("date_slip")]
    [InlineData("status_change")]
    [InlineData("approval")]
    public void Entity_events_default_to_in_app_only(string ev)
    {
        var (inApp, email) = Notifications.DefaultPref(ev);
        Assert.True(inApp);
        Assert.False(email);
    }

    [Fact]
    public void Created_is_opt_in_off_by_default()
    {
        var (inApp, email) = Notifications.DefaultPref("created");
        Assert.False(inApp);
        Assert.False(email);
    }

    [Fact]
    public void Effective_falls_back_to_default_when_unset()
    {
        var (inApp, email) = Notifications.Effective(null, "risk");
        Assert.True(inApp);
        Assert.False(email);
    }

    [Fact]
    public void Effective_honours_a_stored_pref()
    {
        var stored = new NotificationPref { EventType = "risk", InApp = false, Email = true };
        var (inApp, email) = Notifications.Effective(stored, "risk");
        Assert.False(inApp);
        Assert.True(email);
    }
}

public class CorrelationCodeTests
{
    [Theory]
    [InlineData(500, "SRV")]
    [InlineData(400, "SRV")]  // (CategoryFor is only consulted for 5xx, but stays SRV otherwise)
    [InlineData(502, "INT")]
    [InlineData(503, "INT")]
    [InlineData(504, "INT")]
    public void Category_distinguishes_integration_failures(int status, string expected) =>
        Assert.Equal(expected, RequestLogging.CategoryFor(status));

    [Fact]
    public void Code_has_prefix_and_fixed_length()
    {
        var code = RequestLogging.NewCode("SRV");
        Assert.StartsWith("SRV-", code);
        Assert.Equal(10, code.Length);              // "SRV-" + 6
        Assert.Equal(code, code.ToUpperInvariant()); // uppercase, quotable
    }

    [Fact]
    public void Codes_are_unique_across_calls()
    {
        var codes = Enumerable.Range(0, 200).Select(_ => RequestLogging.NewCode("INT")).ToHashSet();
        Assert.Equal(200, codes.Count);
    }
}
