using Atlas.Api;
using Xunit;

namespace Atlas.Tests;

// The OpenBao/Vault KV v2 → config mapping. The live HTTP read can't run without
// a server, but the pure response-parsing (the part that decides config keys) is
// unit-covered here: `__` → `:` section mapping, non-string passthrough, and the
// safe no-op on empty/malformed payloads (so a bad secret never wedges boot).
public class OpenBaoTests
{
    [Fact]
    public void Maps_kv_v2_keys_to_config_with_section_delimiter()
    {
        var json = """
        { "data": { "data": {
            "ConnectionStrings__Postgres": "Host=db;Password=s3cret",
            "Jira__ApiToken": "abc123",
            "Bao__Token": "ignored-here"
        }, "metadata": { "version": 3 } } }
        """;
        var map = OpenBao.ParseKvV2(json);
        Assert.Equal("Host=db;Password=s3cret", map["ConnectionStrings:Postgres"]);
        Assert.Equal("abc123", map["Jira:ApiToken"]);
        Assert.True(map.ContainsKey("Bao:Token"));
    }

    [Fact]
    public void Non_string_values_keep_their_raw_json()
    {
        var json = """{ "data": { "data": { "Jira__MaxAttachmentBytes": 26214400 } } }""";
        var map = OpenBao.ParseKvV2(json);
        Assert.Equal("26214400", map["Jira:MaxAttachmentBytes"]);
    }

    [Fact]
    public void Empty_or_shape_mismatch_is_a_safe_no_op()
    {
        Assert.Empty(OpenBao.ParseKvV2("""{ "data": {} }"""));
        Assert.Empty(OpenBao.ParseKvV2("""{ "errors": ["permission denied"] }"""));
        Assert.Empty(OpenBao.ParseKvV2("""{ "data": { "data": null } }"""));
    }
}
