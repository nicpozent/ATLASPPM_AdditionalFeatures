using Atlas.Api;
using Xunit;

namespace Atlas.Tests;

public class DbTests
{
    const string Base = "Host=db;Port=5432;Database=atlas;Username=atlas;Password=atlas";

    [Fact]
    public void No_ssl_mode_leaves_the_connection_string_untouched()
    {
        Assert.Equal(Base, Db.ApplySslMode(Base, null));
        Assert.Equal(Base, Db.ApplySslMode(Base, ""));
        Assert.Equal(Base, Db.ApplySslMode(Base, "   "));
    }

    [Theory]
    [InlineData("Require")]
    [InlineData("require")]
    [InlineData("VerifyFull")]
    public void A_valid_ssl_mode_is_applied(string mode)
    {
        var result = Db.ApplySslMode(Base, mode);
        Assert.Contains("SSL Mode", result);
        Assert.Contains("atlas", result);          // other settings preserved
        Assert.Contains("Host=db", result);
    }

    [Fact]
    public void An_unrecognised_ssl_mode_is_ignored_not_thrown()
    {
        var result = Db.ApplySslMode(Base, "Bogus");
        Assert.Equal(Base, result);
    }
}
