using System.Security.Claims;
using Atlas.Api;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Atlas.Tests;

// Under real auth (Auth:Enabled=true), the effective permission role is resolved
// from the Entra `roles` claim. These lock in that manager app roles grant a
// real permission level (not least-privilege), and that the most-privileged
// role wins when a user holds several.
public class AuthRoleMappingTests
{
    static string? Resolve(params string[] roles)
    {
        var id = new ClaimsIdentity(roles.Select(r => new Claim("roles", r)), "test");
        var req = new DefaultHttpContext().Request;
        return Permissions.ResolveRoleId(new ClaimsPrincipal(id), req, authEnabled: true);
    }

    [Theory]
    [InlineData("GlobalServiceManager", "team")]
    [InlineData("GlobalEngineeringManager", "team")]
    [InlineData("DevelopersManager", "team")]
    [InlineData("InfrastructureManager", "team")]
    [InlineData("ChiefArchitect", "pmo")]
    [InlineData("PlatformAdmin", "admin")]
    [InlineData("TeamMember", "team")]
    [InlineData("CTO", "exec")]
    [InlineData("CIO", "exec")]
    public void Manager_and_canonical_roles_map_to_a_permission_level(string appRole, string expected)
    {
        Assert.Equal(expected, Resolve(appRole));
    }

    [Fact]
    public void Most_privileged_role_wins_when_holding_several()
    {
        // Platform Admin + Global Service Manager → admin permissions.
        Assert.Equal("admin", Resolve("GlobalServiceManager", "PlatformAdmin"));
    }

    [Fact]
    public void An_unknown_role_falls_back_to_least_privilege()
    {
        Assert.Equal("stkhldr", Resolve("SomethingElse"));
    }
}
