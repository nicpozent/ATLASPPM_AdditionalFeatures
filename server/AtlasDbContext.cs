using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public class AtlasDbContext(DbContextOptions<AtlasDbContext> options) : DbContext(options)
{
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Blocker> Blockers => Set<Blocker>();
    public DbSet<Demand> Demands => Set<Demand>();
    public DbSet<DemandAttachment> DemandAttachments => Set<DemandAttachment>();
    public DbSet<Program> Programs => Set<Program>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductTask> ProductTasks => Set<ProductTask>();
    public DbSet<ProductMember> ProductMembers => Set<ProductMember>();
    public DbSet<Objective> Objectives => Set<Objective>();
    public DbSet<KeyResult> KeyResults => Set<KeyResult>();
    public DbSet<Resource> Resources => Set<Resource>();
    public DbSet<Release> Releases => Set<Release>();
    public DbSet<DeliveryReport> DeliveryReports => Set<DeliveryReport>();
    public DbSet<DashboardKpi> DashboardKpis => Set<DashboardKpi>();
    public DbSet<ActivityEvent> ActivityEvents => Set<ActivityEvent>();
    public DbSet<MyTask> MyTasks => Set<MyTask>();
    public DbSet<BudgetSnapshot> BudgetSnapshots => Set<BudgetSnapshot>();
    public DbSet<RoleDef> RoleDefs => Set<RoleDef>();
    public DbSet<Capability> Capabilities => Set<Capability>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<Gate> Gates => Set<Gate>();
    public DbSet<GateCriterion> GateCriteria => Set<GateCriterion>();
    public DbSet<Decision> Decisions => Set<Decision>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Project>().HasKey(x => x.Id);
        b.Entity<Project>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<Project>()
            .HasMany(x => x.Blockers)
            .WithOne(x => x.Project!)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<Blocker>().HasKey(x => x.Id);
        b.Entity<Blocker>().Property(x => x.Id).ValueGeneratedNever();

        b.Entity<Demand>().HasKey(x => x.Id);
        b.Entity<Demand>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<Demand>()
            .HasMany(x => x.Attachments)
            .WithOne()
            .HasForeignKey(x => x.DemandId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Entity<DemandAttachment>().HasKey(x => x.Id);
        // Defaults so adding these columns is safe on tables that already hold rows.
        var d = b.Entity<Demand>();
        d.Property(x => x.Description).HasDefaultValue("");
        d.Property(x => x.Source).HasDefaultValue("");
        d.Property(x => x.GeoImpact).HasDefaultValueSql("'{}'::text[]");
        d.Property(x => x.HasDeadline).HasDefaultValue(false);
        d.Property(x => x.BusinessProblem).HasDefaultValue("");
        d.Property(x => x.ImprovementExisting).HasDefaultValue(false);
        d.Property(x => x.Criticality).HasDefaultValue(0);
        d.Property(x => x.Risk).HasDefaultValue(0);
        d.Property(x => x.ExpectedBenefits).HasDefaultValue("");
        d.Property(x => x.BenefitValue).HasDefaultValue(0);
        d.Property(x => x.Stakeholders).HasDefaultValueSql("'{}'::text[]");
        d.Property(x => x.AllStakeholders).HasDefaultValue(false);
        d.Property(x => x.CreatedBy).HasDefaultValue("");

        b.Entity<Program>().HasKey(x => x.Id);
        b.Entity<Program>().Property(x => x.Id).ValueGeneratedNever();

        b.Entity<Product>().HasKey(x => x.Id);
        b.Entity<Product>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<Product>().HasMany(x => x.Tasks).WithOne().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Product>().HasMany(x => x.Members).WithOne().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);

        b.Entity<Objective>().HasKey(x => x.Id);
        b.Entity<Objective>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<Objective>().HasMany(x => x.Krs).WithOne().HasForeignKey(x => x.ObjectiveId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<KeyResult>().HasKey(x => x.Id);
        b.Entity<KeyResult>().Property(x => x.Id).ValueGeneratedNever();

        b.Entity<Resource>().HasKey(x => x.Id);
        b.Entity<Release>().HasKey(x => x.Id);
        b.Entity<Release>().Property(x => x.Id).ValueGeneratedNever();

        b.Entity<RoleDef>().HasKey(x => x.Id);
        b.Entity<RoleDef>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<RoleDef>()
            .HasMany(x => x.Permissions)
            .WithOne()
            .HasForeignKey(x => x.RoleId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Entity<Capability>().HasKey(x => x.Key);
        b.Entity<Capability>().Property(x => x.Key).ValueGeneratedNever();
        b.Entity<RolePermission>().HasKey(x => x.Id);
        b.Entity<RolePermission>().HasIndex(x => new { x.RoleId, x.CapabilityKey }).IsUnique();
        b.Entity<AuditEvent>().HasKey(x => x.Id);
        b.Entity<AuditEvent>().HasIndex(x => x.At);
        b.Entity<Gate>().HasKey(x => x.Id);
        b.Entity<Gate>().HasIndex(x => new { x.ProjectId, x.Code }).IsUnique();
        b.Entity<Gate>().HasMany(x => x.Criteria).WithOne().HasForeignKey(x => x.GateId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<GateCriterion>().HasKey(x => x.Id);
        b.Entity<Decision>().HasKey(x => x.Id);
        b.Entity<Decision>().HasIndex(x => x.ProjectId);

        b.Entity<DeliveryReport>().HasKey(x => x.Period);
        b.Entity<DashboardKpi>().HasKey(x => x.Key);
        b.Entity<ActivityEvent>().HasKey(x => x.Id);
        b.Entity<MyTask>().HasKey(x => x.Id);
        b.Entity<BudgetSnapshot>().HasKey(x => x.Id);
    }
}
