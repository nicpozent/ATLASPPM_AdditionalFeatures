using Atlas.Api;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Atlas.Tests;

// Per-role demand email (ADR-0045): people in the target roles are resolved via
// the IN-APP group→role mapping (EntraGroup.ManagerKey → member email), and each
// person can opt out (a NotificationPref for the event with Email=false). With no
// directory sync there are no addresses, so delivery is in-app only.
public class RoleEmailResolveTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public RoleEmailResolveTests(AtlasApiFactory factory) => _factory = factory;

    AtlasDbContext Db(IServiceScope s) => s.ServiceProvider.GetRequiredService<AtlasDbContext>();

    [Fact]
    public async Task Resolves_role_members_via_in_app_mapping_and_honours_opt_out()
    {
        using var scope = _factory.Services.CreateScope();
        var db = Db(scope);

        // A group mapped (in-app) to the Chief Architect role, with two members.
        var g = new EntraGroup { Id = "grp-arch-1", DisplayName = "Architecture", ManagerKey = "architect", Manual = true };
        g.Members.Add(new TeamMemberRow { GroupId = g.Id, Uid = "u-ingrid", DisplayName = "Ingrid", Email = "ingrid@birgma.com" });
        g.Members.Add(new TeamMemberRow { GroupId = g.Id, Uid = "u-olav", DisplayName = "Olav", Email = "olav@birgma.com" });
        // A group mapped to a role NOT in the target set — must not be pulled in.
        var g2 = new EntraGroup { Id = "grp-dev-1", DisplayName = "Devs", ManagerKey = "devmgr", Manual = true };
        g2.Members.Add(new TeamMemberRow { GroupId = g2.Id, Uid = "u-dev", DisplayName = "Dev", Email = "dev@birgma.com" });
        db.EntraGroups.AddRange(g, g2);
        // Olav opted out of "created" email.
        db.NotificationPrefs.Add(new NotificationPref { UserKey = "u-olav", EventType = Notifications.Created, InApp = true, Email = false });
        await db.SaveChangesAsync();

        var emails = await Notifications.ResolveRoleEmailsAsync(db, Notifications.Created, new[] { "pmo", "architect", "cto", "cio", "pmlead" });

        Assert.Contains("ingrid@birgma.com", emails);          // architect member, subscribed
        Assert.DoesNotContain("olav@birgma.com", emails);      // architect member, opted out
        Assert.DoesNotContain("dev@birgma.com", emails);       // not a target role
    }

    [Fact]
    public async Task Roles_with_no_mapped_group_yield_no_emails()
    {
        // 'finance' isn't a mapped ManagerKey anywhere, so there are no addresses
        // to resolve → in-app only. (Robust to the shared class-fixture DB.)
        using var scope = _factory.Services.CreateScope();
        var emails = await Notifications.ResolveRoleEmailsAsync(Db(scope), Notifications.Created, new[] { "finance" });
        Assert.Empty(emails);
    }
}
