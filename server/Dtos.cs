namespace Atlas.Api;

// ============================================================================
//  Response DTOs — shaped exactly like the frontend's TypeScript interfaces.
//  System.Text.Json (ASP.NET default) serializes these PascalCase properties
//  to camelCase, matching the client. Dictionary keys are written verbatim.
// ============================================================================

public record ProjectDto(string Id, string Name, string Dept, string Owner, string Methodology,
    string Status, string Health, int Progress, decimal Budget, decimal Spent, string Target, int BlockerCount);

public record BlockerDto(string Id, string Title, string ProjectId, string ProjectName, string Owner, string Status);

public record DemandDto(string Id, string Title, string Stage, string Priority, int Value, int Effort,
    string Requester, string Dept, string Date);

public record MyDemandDto(string Id, string Title, string Dept, string Priority, string Date, string Stage);

public record AttachmentDto(int Id, string FileName, string ContentType, long Size);
public record DemandDetailDto(string Id, string Title, string Stage, string Priority, int Value, int Effort,
    string Requester, string Dept, string Date, string Description, string Source, List<string> GeoImpact,
    bool HasDeadline, string? Deadline, string BusinessProblem, bool ImprovementExisting, int Criticality,
    int Risk, string ExpectedBenefits, int BenefitValue, List<string> Stakeholders, bool AllStakeholders,
    List<AttachmentDto> Attachments, bool CanDelete);

public record AuditEventDto(string At, string Actor, string Role, string Category, string Action, string Target);

// ---- Stage gates -----------------------------------------------------------
public record GateCriterionDto(int Id, string Label, bool Met);
public record GateDto(int Id, string Code, string Name, string Approver, string Status, string Date,
    int Pct, string MetLabel, List<GateCriterionDto> Criteria);
public record GatesDto(bool CanGovern, List<GateDto> Gates);

public record DecisionDto(string Code, string Title, string Context, string Decision, string Owner, string Date, string Status);
public record DecisionsDto(bool CanGovern, List<DecisionDto> Decisions);

// ---- Roles & permissions ---------------------------------------------------
public record CapabilityDto(string Key, string Label);
public record RoleDto(string Id, string Name, string Short, string Who, string Description,
    string Icon, string Color, string Tint, bool IsSystem, Dictionary<string, string> Permissions);
public record RolesMatrixDto(List<CapabilityDto> Capabilities, List<RoleDto> Roles, bool CanManage);

public record ProgramDto(string Id, string Name, string Owner, string Goal, string Status,
    List<string> Projects, decimal Budget, decimal Spent, int Progress, string Health);

public record TaskDto(string Id, string Title, string Status, int Points, string DateISO, string MappedRelease);
public record MemberDto(string Name, int Alloc);
public record ProductDto(string Id, string Name, string Owner, string Source, List<string> Projects,
    List<TaskDto> Tasks, List<MemberDto> Members, List<string> Releases);

public record KrDto(string Id, string Title, string Link, int Progress);
public record ObjectiveDto(string Id, string Title, string Owner, string Horizon, List<KrDto> Krs);

public record ResourceDto(string Name, string Role, string Dept, string Initials, string Color,
    int OpsPct, int ProjectPct, int ProductPct, bool Over);

public record FinRowDto(string Id, string Name, decimal Budget, decimal Spent, decimal Capex,
    decimal Forecast, decimal Variance, decimal Roi, decimal LaborDev, decimal LaborArch, decimal LaborInfra,
    int UsedPct, bool OnTrack);

public record ReleaseDto(string Id, string Name, int Reqs, int Crs, string Owner, string Link,
    string Scope, string Date, string Env, int Progress, string Risk, string Status);

public record DeliveryStatsDto(int Completed, int InProgress, int Planned, int Velocity, string VelTrend,
    int OnTime, int BlockersCleared, int BlockersOpen, int Milestones, string BudgetBurn, int SpendPct,
    string Satisfaction, string CostPerDeliverable, string ValuePerEuro);

public record StakeholderProjectDto(string Id, string Name, string Dept, string Status, string Health,
    int Progress, string Target, string Phase);

public record ProjectDetailDto(string Id, string Name, string Dept, string Owner, string Methodology,
    string Status, string Health, int Progress, string Phase, decimal Budget, decimal Spent, string Due);

// ---- Dashboard -------------------------------------------------------------
public record KpiValueDto(string Value, string Delta, bool Good, List<int> Spark);
public record HealthSegmentDto(int Value);
public record PipelineStageDto(int Count);
public record BudgetDto(string Allocated, string Spent, int SpentPct, List<string> Months,
    List<int> Planned, List<int> Actual, int Max);
public record ProjectRowDto(string Id, string Name, string Dept, string Owner, string Methodology,
    string Status, string Health, int Progress, decimal Budget, decimal Spent);
public record AttentionItemDto(string Id, string Name, string Reason, string Severity);
public record ActivityEventDto(string Who, string Action, string Time, string Initials, string Color);
public record TaskRowDto(string Name, string Sprint, string Status);
public record ApprovalRowDto(string Id, string Title, string Requester, string Dept, int Value);

public record DashboardDto(
    Dictionary<string, KpiValueDto> Kpis,
    Dictionary<string, HealthSegmentDto> Health,
    BudgetDto? Budget,
    Dictionary<string, PipelineStageDto> Pipeline,
    List<ProjectRowDto> Projects,
    List<AttentionItemDto> Attention,
    List<ActivityEventDto> Activity,
    List<TaskRowDto> Tasks,
    List<ApprovalRowDto> Approvals);
