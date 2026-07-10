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

public class DepartmentTests
{
    [Theory]
    [InlineData("Development", "Development")]
    [InlineData("development", "Development")]   // case-insensitive
    [InlineData("  PMO  ", "PMO")]               // trimmed
    [InlineData("D365", "D365")]
    public void Normalizes_known_departments(string input, string expected) =>
        Assert.Equal(expected, Departments.Normalize(input));

    [Theory]
    [InlineData("Marketing")]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("   ")]
    public void Rejects_unknown_to_empty(string? input) =>
        Assert.Equal("", Departments.Normalize(input));

    [Fact]
    public void Has_the_seven_expected_departments() =>
        Assert.Equal(new[] { "Infrastructure", "Development", "Security", "D365", "Architecture", "PMO", "PO" }, Departments.All);
}

public class UploadValidationTests
{
    [Theory]
    [InlineData("plan.pdf", 1024)]
    [InlineData("sheet.xlsx", 5_000_000)]
    [InlineData("diagram.drawio", 2048)]
    [InlineData("photo.PNG", 4096)]   // extension check is case-insensitive
    public void Accepts_allowed_types_within_size(string name, long size) =>
        Assert.Null(Hardening.ValidateUpload(name, size));

    [Fact] public void Rejects_empty() => Assert.NotNull(Hardening.ValidateUpload("x.pdf", 0));

    [Fact] public void Rejects_oversize() =>
        Assert.Contains("limit", Hardening.ValidateUpload("big.pdf", Hardening.MaxUploadBytes + 1)!);

    [Theory]
    [InlineData("evil.exe")]
    [InlineData("run.sh")]
    [InlineData("macro.docm")]
    [InlineData("noextension")]
    public void Rejects_disallowed_or_missing_extension(string name) =>
        Assert.NotNull(Hardening.ValidateUpload(name, 1024));
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

// Jira base-URL normalisation — tolerate a missing scheme and a pasted path.
public class JiraBaseUrlTests
{
    [Theory]
    [InlineData("https://biltema.atlassian.net", "https://biltema.atlassian.net")]
    [InlineData("biltema.atlassian.net", "https://biltema.atlassian.net")]              // missing scheme
    [InlineData("https://biltema.atlassian.net/", "https://biltema.atlassian.net")]      // trailing slash
    [InlineData("https://biltema.atlassian.net/jira/software/projects/GIT/boards/93", "https://biltema.atlassian.net")] // pasted path
    [InlineData("  biltema.atlassian.net  ", "https://biltema.atlassian.net")]           // whitespace
    public void Normalizes_to_clean_origin(string raw, string expected) =>
        Assert.Equal(expected, Jira.NormalizeBaseUrl(raw));

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Blank_is_null(string? raw) => Assert.Null(Jira.NormalizeBaseUrl(raw));
}

// Jira → Atlas field mappings used by the pull sync.
public class JiraSyncMappingTests
{
    [Theory]
    [InlineData("active", "Started")]
    [InlineData("closed", "Completed")]
    [InlineData("future", "Planned")]
    [InlineData("FUTURE", "Planned")]
    [InlineData("", "Planned")]
    [InlineData(null, "Planned")]
    public void Sprint_state_maps(string? state, string expected) =>
        Assert.Equal(expected, Jira.MapSprintState(state));

    [Theory]
    [InlineData("done", "Done")]
    [InlineData("indeterminate", "In Progress")]
    [InlineData("new", "To Do")]
    [InlineData("", "To Do")]
    [InlineData(null, "To Do")]
    public void Issue_status_category_maps(string? cat, string expected) =>
        Assert.Equal(expected, Jira.MapIssueStatus(cat));

    [Theory]
    [InlineData("Highest", "Critical")]
    [InlineData("Blocker", "Critical")]
    [InlineData("High", "High")]
    [InlineData("Medium", "Medium")]
    [InlineData("Low", "Low")]
    [InlineData("Lowest", "Low")]
    [InlineData("", "Medium")]
    [InlineData(null, "Medium")]
    public void Priority_maps(string? name, string expected) =>
        Assert.Equal(expected, Jira.MapPriority(name));

    [Theory]
    [InlineData("2026-03-01T09:00:00.000+0000", "2026-03-01")]
    [InlineData("2026-03-01", "2026-03-01")]
    [InlineData("", "")]
    [InlineData(null, "")]
    public void Date_part_keeps_calendar_day(string? iso, string expected) =>
        Assert.Equal(expected, Jira.DatePart(iso));

    [Fact]
    public void Sprints_are_derived_from_an_issue_current_and_closed()
    {
        // An issue with a current sprint (array) plus one closed sprint — the
        // board-less derivation should surface both.
        var fields = System.Text.Json.JsonDocument.Parse("""
        {
          "sprint": [{"id":42,"name":"Sprint 7","state":"active","startDate":"2026-06-01T00:00:00.000Z"}],
          "closedSprints": [{"id":41,"name":"Sprint 6","state":"closed","completeDate":"2026-05-31T00:00:00.000Z"}]
        }
        """).RootElement;
        var ids = Jira.SprintsFromIssue(fields, "customfield_10020")
            .Select(s => s.GetProperty("id").GetInt32()).OrderBy(x => x).ToArray();
        Assert.Equal(new[] { 41, 42 }, ids);
    }

    [Fact]
    public void Sprints_are_derived_from_the_jira_sprint_custom_field()
    {
        // A JQL/board-less search returns the Sprint field as a CUSTOM field
        // (default customfield_10020), an array of sprint objects — these must
        // become Sprint rows so sprints aren't 0 without a readable board.
        var fields = System.Text.Json.JsonDocument.Parse("""
        {
          "summary": "GIT-329",
          "customfield_10020": [
            {"id":101,"name":"IP Sprint 1","state":"closed","startDate":"2026-01-05T00:00:00.000Z","endDate":"2026-01-19T00:00:00.000Z"},
            {"id":102,"name":"IP Sprint 2","state":"active","startDate":"2026-01-20T00:00:00.000Z","endDate":"2026-02-03T00:00:00.000Z"}
          ]
        }
        """).RootElement;
        var ids = Jira.SprintsFromIssue(fields, "customfield_10020")
            .Select(s => s.GetProperty("id").GetInt32()).OrderBy(x => x).ToArray();
        Assert.Equal(new[] { 101, 102 }, ids);
    }

    [Fact]
    public void Sprints_from_issue_tolerates_absent_fields()
    {
        var fields = System.Text.Json.JsonDocument.Parse("""{"summary":"x"}""").RootElement;
        Assert.Empty(Jira.SprintsFromIssue(fields, "customfield_10020"));
    }

    [Fact]
    public void Started_at_is_the_earliest_status_transition_in_the_changelog()
    {
        // Histories out of order; only status-field changes count. The earliest
        // one (To Do → In Progress) is the start date, ignoring a later change
        // and a non-status (assignee) history.
        var issue = System.Text.Json.JsonDocument.Parse("""
        {
          "key": "GIT-329",
          "changelog": { "histories": [
            { "created": "2026-03-10T09:00:00.000+0000", "items": [{"field":"status","fromString":"In Progress","toString":"Done"}] },
            { "created": "2026-02-01T08:30:00.000+0000", "items": [{"field":"status","fromString":"To Do","toString":"In Progress"}] },
            { "created": "2026-01-15T08:00:00.000+0000", "items": [{"field":"assignee","toString":"Jane"}] }
          ] }
        }
        """).RootElement;
        Assert.Equal("2026-02-01", Jira.StartedAtFromChangelog(issue));
    }

    [Fact]
    public void Started_at_is_empty_without_a_changelog_or_status_change()
    {
        var noLog = System.Text.Json.JsonDocument.Parse("""{"key":"GIT-1"}""").RootElement;
        Assert.Equal("", Jira.StartedAtFromChangelog(noLog));
        var noStatus = System.Text.Json.JsonDocument.Parse("""
        { "changelog": { "histories": [ { "created": "2026-02-01T08:00:00.000+0000", "items": [{"field":"assignee","toString":"Jane"}] } ] } }
        """).RootElement;
        Assert.Equal("", Jira.StartedAtFromChangelog(noStatus));
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(-5, 0)]
    [InlineData(3600, 1)]
    [InlineData(5400, 2)]     // 1.5h rounds to 2
    [InlineData(28800, 8)]
    public void Seconds_convert_to_whole_hours(long seconds, int expected) =>
        Assert.Equal(expected, Jira.SecondsToHours(seconds));

    [Fact]
    public void Adf_flattens_to_plain_text()
    {
        // A minimal ADF doc: two paragraphs, a bold run and a hard break.
        var adf = System.Text.Json.JsonDocument.Parse("""
        {"type":"doc","version":1,"content":[
          {"type":"paragraph","content":[{"type":"text","text":"Hello "},{"type":"text","text":"world"}]},
          {"type":"paragraph","content":[{"type":"text","text":"line one"},{"type":"hardBreak"},{"type":"text","text":"line two"}]}
        ]}
        """).RootElement;
        var text = Jira.AdfToText(adf);
        Assert.Contains("Hello world", text);
        Assert.Contains("line one", text);
        Assert.Contains("line two", text);
    }

    [Fact]
    public void Adf_tolerates_plain_string_and_null()
    {
        var plain = System.Text.Json.JsonDocument.Parse("\"just a string\"").RootElement;
        Assert.Equal("just a string", Jira.AdfToText(plain));
        Assert.Equal("", Jira.AdfToText(null));
    }
}

// Capacity model behind time-phased allocation (40h/week = 100%).
public class AllocMathTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(40, 100)]
    [InlineData(20, 50)]
    [InlineData(10, 25)]
    [InlineData(80, 100)]     // clamped
    public void Hours_convert_to_percent(int hours, int expected) =>
        Assert.Equal(expected, AllocMath.PctFromHours(hours));

    [Fact]
    public void Percent_prefers_hours_when_given()
    {
        Assert.Equal(50, AllocMath.Percent(30, 20));   // hours win → 20/40
        Assert.Equal(30, AllocMath.Percent(30, null)); // no hours → percent
        Assert.Equal(30, AllocMath.Percent(30, 0));    // zero hours → percent
    }

    [Fact]
    public void Segment_is_active_only_within_its_window()
    {
        var mid = new DateOnly(2026, 6, 15);
        Assert.True(AllocMath.ActiveOn("", "", mid));                       // open both ends
        Assert.True(AllocMath.ActiveOn("2026-06-01", "2026-06-30", mid));   // inside
        Assert.False(AllocMath.ActiveOn("2026-07-01", "2026-07-31", mid));  // before start
        Assert.False(AllocMath.ActiveOn("2026-01-01", "2026-05-31", mid));  // after end
        Assert.True(AllocMath.ActiveOn("2026-06-15", "", mid));             // starts today, open end
    }
}
