using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public class AtlasDbContext(DbContextOptions<AtlasDbContext> options) : DbContext(options)
{
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Blocker> Blockers => Set<Blocker>();
    public DbSet<Demand> Demands => Set<Demand>();
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

        b.Entity<DeliveryReport>().HasKey(x => x.Period);
        b.Entity<DashboardKpi>().HasKey(x => x.Key);
        b.Entity<ActivityEvent>().HasKey(x => x.Id);
        b.Entity<MyTask>().HasKey(x => x.Id);
        b.Entity<BudgetSnapshot>().HasKey(x => x.Id);
    }
}
