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
    public DbSet<ProductAllocation> ProductAllocations => Set<ProductAllocation>();
    public DbSet<Objective> Objectives => Set<Objective>();
    public DbSet<KeyResult> KeyResults => Set<KeyResult>();
    public DbSet<Resource> Resources => Set<Resource>();
    public DbSet<Phase> Phases => Set<Phase>();
    public DbSet<Milestone> Milestones => Set<Milestone>();
    public DbSet<WowOverride> WowOverrides => Set<WowOverride>();
    public DbSet<EntraGroup> EntraGroups => Set<EntraGroup>();
    public DbSet<TeamMemberRow> TeamMembers => Set<TeamMemberRow>();
    public DbSet<ManagerNode> ManagerNodes => Set<ManagerNode>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<NotificationPref> NotificationPrefs => Set<NotificationPref>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<CommunicationEntry> CommunicationEntries => Set<CommunicationEntry>();
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
    public DbSet<RaidItem> RaidItems => Set<RaidItem>();
    public DbSet<SecurityProfile> SecurityProfiles => Set<SecurityProfile>();
    public DbSet<SecurityControl> SecurityControls => Set<SecurityControl>();
    public DbSet<ProjectTask> ProjectTasks => Set<ProjectTask>();
    public DbSet<Epic> Epics => Set<Epic>();
    public DbSet<Artifact> Artifacts => Set<Artifact>();
    public DbSet<ArtifactVersion> ArtifactVersions => Set<ArtifactVersion>();
    public DbSet<Requirement> Requirements => Set<Requirement>();
    public DbSet<ChangeRequest> ChangeRequests => Set<ChangeRequest>();
    public DbSet<ArchProfile> ArchProfiles => Set<ArchProfile>();
    public DbSet<AdmPhase> AdmPhases => Set<AdmPhase>();
    public DbSet<ArchApproval> ArchApprovals => Set<ArchApproval>();
    public DbSet<TestPlan> TestPlans => Set<TestPlan>();
    public DbSet<Defect> Defects => Set<Defect>();
    public DbSet<ProjectDependency> ProjectDependencies => Set<ProjectDependency>();
    public DbSet<Absence> Absences => Set<Absence>();
    public DbSet<CostLine> CostLines => Set<CostLine>();
    public DbSet<RoleAssignment> RoleAssignments => Set<RoleAssignment>();
    public DbSet<OperationalItem> OperationalItems => Set<OperationalItem>();
    public DbSet<DeletionRequest> DeletionRequests => Set<DeletionRequest>();
    public DbSet<BackupRun> BackupRuns => Set<BackupRun>();
    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<NewsBlock> NewsBlocks => Set<NewsBlock>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Project>().HasKey(x => x.Id);
        b.Entity<Project>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<Project>().Property(x => x.StartDate).HasDefaultValue("");
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
        b.Entity<Program>().Property(x => x.StartDate).HasDefaultValue("");

        b.Entity<Product>().HasKey(x => x.Id);
        b.Entity<Product>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<Product>().Property(x => x.Status).HasDefaultValue("Active");
        b.Entity<Product>().HasMany(x => x.Tasks).WithOne().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Product>().HasMany(x => x.Members).WithOne().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Product>().HasMany(x => x.Allocations).WithOne().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ProductAllocation>().HasKey(x => x.Id);

        b.Entity<Objective>().HasKey(x => x.Id);
        b.Entity<Objective>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<Objective>().Property(x => x.Status).HasDefaultValue("Active");
        b.Entity<Objective>().HasMany(x => x.Krs).WithOne().HasForeignKey(x => x.ObjectiveId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<KeyResult>().HasKey(x => x.Id);
        b.Entity<KeyResult>().Property(x => x.Id).ValueGeneratedNever();

        b.Entity<Resource>().HasKey(x => x.Id);
        b.Entity<Phase>().HasKey(x => x.Id);
        b.Entity<Milestone>().HasKey(x => x.Id);
        b.Entity<WowOverride>().HasKey(x => x.ProjectId);
        b.Entity<EntraGroup>().HasKey(x => x.Id);
        b.Entity<EntraGroup>().Property(x => x.Id).ValueGeneratedNever();
        b.Entity<EntraGroup>().HasMany(x => x.Members).WithOne().HasForeignKey(m => m.GroupId);
        b.Entity<TeamMemberRow>().HasKey(x => x.Id);
        b.Entity<ManagerNode>().HasKey(x => x.Key);
        b.Entity<Subscription>().HasKey(x => x.Id);
        b.Entity<Subscription>().HasIndex(x => new { x.UserKey, x.TargetType, x.TargetId }).IsUnique();
        b.Entity<NotificationPref>().HasKey(x => x.Id);
        b.Entity<NotificationPref>().HasIndex(x => new { x.UserKey, x.EventType }).IsUnique();
        b.Entity<Notification>().HasKey(x => x.Id);
        b.Entity<Notification>().HasIndex(x => new { x.UserKey, x.Read });
        b.Entity<CommunicationEntry>().HasKey(x => x.Id);
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
        b.Entity<RaidItem>().HasKey(x => x.Id);
        b.Entity<RaidItem>().HasIndex(x => x.ProjectId);
        b.Entity<SecurityProfile>().HasKey(x => x.ProjectId);
        b.Entity<SecurityProfile>().Property(x => x.ProjectId).ValueGeneratedNever();
        b.Entity<SecurityControl>().HasKey(x => x.Id);
        b.Entity<SecurityControl>().HasIndex(x => x.ProjectId);
        b.Entity<ProjectTask>().HasKey(x => x.Id);
        b.Entity<ProjectTask>().HasIndex(x => x.ProjectId);
        b.Entity<Epic>().HasKey(x => x.Id);
        b.Entity<Epic>().HasIndex(x => x.ProjectId);
        b.Entity<Artifact>().HasKey(x => x.Id);
        b.Entity<Artifact>().HasIndex(x => x.ProjectId);
        b.Entity<Artifact>().HasMany(x => x.Versions).WithOne().HasForeignKey(x => x.ArtifactId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ArtifactVersion>().HasKey(x => x.Id);
        b.Entity<Requirement>().HasKey(x => x.Id);
        b.Entity<Requirement>().HasIndex(x => x.ProjectId);
        b.Entity<ChangeRequest>().HasKey(x => x.Id);
        b.Entity<ChangeRequest>().HasIndex(x => x.ProjectId);
        b.Entity<ArchProfile>().HasKey(x => x.ProjectId);
        b.Entity<ArchProfile>().Property(x => x.ProjectId).ValueGeneratedNever();
        b.Entity<AdmPhase>().HasKey(x => x.Id);
        b.Entity<AdmPhase>().HasIndex(x => new { x.ProjectId, x.Code }).IsUnique();
        b.Entity<ArchApproval>().HasKey(x => x.Id);
        b.Entity<ArchApproval>().HasIndex(x => new { x.ProjectId, x.Role }).IsUnique();
        b.Entity<TestPlan>().HasKey(x => x.Id);
        b.Entity<TestPlan>().HasIndex(x => x.ProjectId);
        b.Entity<Defect>().HasKey(x => x.Id);
        b.Entity<Defect>().HasIndex(x => x.ProjectId);
        b.Entity<ProjectDependency>().HasKey(x => x.Id);
        b.Entity<ProjectDependency>().HasIndex(x => new { x.ProjectId, x.DependsOnId }).IsUnique();
        b.Entity<Absence>().HasKey(x => x.Id);
        b.Entity<Absence>().HasIndex(x => x.ProjectId);
        b.Entity<CostLine>().HasKey(x => x.Id);
        b.Entity<CostLine>().HasIndex(x => new { x.Scope, x.OwnerId });
        b.Entity<CostLine>().Property(x => x.Scope).HasDefaultValue("project");
        b.Entity<CostLine>().Property(x => x.OwnerRoles).HasDefaultValueSql("'{}'::text[]");
        b.Entity<RoleAssignment>().HasKey(x => x.Id);
        b.Entity<RoleAssignment>().HasIndex(x => new { x.ProjectId, x.RoleKey }).IsUnique();
        b.Entity<OperationalItem>().HasKey(x => x.Id);
        b.Entity<OperationalItem>().HasIndex(x => x.ProjectId);
        b.Entity<DeletionRequest>().HasKey(x => x.Id);
        b.Entity<DeletionRequest>().HasIndex(x => x.ProjectId);
        b.Entity<BackupRun>().HasKey(x => x.Id);
        b.Entity<BackupRun>().HasIndex(x => x.At);
        b.Entity<Setting>().HasKey(x => x.Key);
        b.Entity<Setting>().Property(x => x.Key).ValueGeneratedNever();
        b.Entity<NewsBlock>().HasKey(x => x.Id);

        b.Entity<DeliveryReport>().HasKey(x => x.Period);
        b.Entity<DashboardKpi>().HasKey(x => x.Key);
        b.Entity<ActivityEvent>().HasKey(x => x.Id);
        b.Entity<MyTask>().HasKey(x => x.Id);
        b.Entity<BudgetSnapshot>().HasKey(x => x.Id);
    }
}
