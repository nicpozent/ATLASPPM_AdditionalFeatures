using Atlas.Api;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Atlas.Tests;

// DB-backed tests (EF in-memory) for the permission matrix seed/reconcile — the
// invariants behind the RBAC feature. In-memory is enough: these paths use plain
// LINQ, no Npgsql-specific SQL.
public class RbacMatrixTests
{
    static AtlasDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AtlasDbContext>()
            .UseInMemoryDatabase($"rbac-{Guid.NewGuid():N}").Options);

    static async Task<AtlasDbContext> SeededAsync()
    {
        var db = NewDb();
        await Rbac.SeedAsync(db);
        await Rbac.ReconcileAsync(db);
        return db;
    }

    [Fact]
    public async Task PmLead_has_exactly_the_same_permissions_as_ProjectManager()
    {
        using var db = await SeededAsync();
        var pm = await db.RolePermissions.Where(p => p.RoleId == "pm").ToDictionaryAsync(p => p.CapabilityKey, p => p.Level);
        var pmlead = await db.RolePermissions.Where(p => p.RoleId == "pmlead").ToDictionaryAsync(p => p.CapabilityKey, p => p.Level);

        Assert.NotEmpty(pm);
        Assert.Equal(pm.Count, pmlead.Count);
        Assert.Equal(pm.OrderBy(k => k.Key), pmlead.OrderBy(k => k.Key)); // same caps AND same levels
    }

    [Fact]
    public async Task Reconcile_is_idempotent()
    {
        using var db = await SeededAsync();
        var before = await db.RolePermissions.CountAsync();
        await Rbac.ReconcileAsync(db);
        await Rbac.ReconcileAsync(db);
        Assert.Equal(before, await db.RolePermissions.CountAsync());
    }

    [Fact]
    public async Task PlatformAdmin_has_full_access_on_every_capability()
    {
        using var db = await SeededAsync();
        var caps = await db.Capabilities.Select(c => c.Key).ToListAsync();
        var adminPerms = await db.RolePermissions.Where(p => p.RoleId == "admin").ToDictionaryAsync(p => p.CapabilityKey, p => p.Level);

        Assert.NotEmpty(caps);
        foreach (var cap in caps)
            Assert.Equal("F", adminPerms.GetValueOrDefault(cap)); // admin is Full everywhere
    }
}
