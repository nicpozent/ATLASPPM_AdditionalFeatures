namespace Atlas.Api;

// ============================================================================
//  Response DTOs — shaped exactly like the frontend's TypeScript interfaces.
//  System.Text.Json (ASP.NET default) serializes these PascalCase properties
//  to camelCase, matching the client. Dictionary keys are written verbatim.
// ============================================================================

public record ProjectDto(string Id, string Name, string Dept, string Owner, string Methodology,
    string Status, string Health, int Progress, decimal Budget, decimal Spent, string Target, int BlockerCount,
    bool Archived = false, bool IsSystem = false, string StartDate = "");

public record BlockerDto(string Id, string Title, string ProjectId, string ProjectName, string Owner, string Status, string Description = "");
public record ProjectBlockersDto(bool CanEdit, List<BlockerDto> Blockers);

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

public record DecisionDto(string Code, string Title, string Context, string Decision, string Owner, string Date, string Status, int Id = 0);
public record DecisionsDto(bool CanGovern, List<DecisionDto> Decisions);

public record RaidItemDto(int Id, string Type, string Title, string Owner, string Status, bool Auto = false);
public record RaidDto(bool CanEdit, List<RaidItemDto> Items);

public record SecurityProfileDto(string Classification, string Residency, string Subjects, string Retention,
    bool PersonalData, bool SpecialCategory, bool AutomatedDecisions, bool CardholderData,
    bool Gdpr, bool Pci, bool Iso, bool AiAct, bool Soc2, bool Nis2,
    bool Dpp = false, bool Ppwr = false, bool Eudr = false);
public record SecurityControlDto(int Id, string Code, string Control, string Framework, string Evidence, string Owner, string Status,
    string Description = "", string Reason = "");
public record SecurityReviewGateDto(int Id, string Name, string Type, string Reviewer, string Status, string Date, string Note);
public record SecurityDto(bool CanEdit, SecurityProfileDto Profile, List<SecurityControlDto> Controls, List<SecurityReviewGateDto> ReviewGates);

public record ProjectTaskDto(int Id, string Code, string Name, string Epic, string Assignee,
    string Status, string Sprint, string Baseline, string Priority,
    string StartDate = "", string TargetDate = "", int Points = 0, string Size = "",
    int EstimateHours = 0, bool AssigneeOnLeave = false);
public record ProjectTasksDto(bool CanEdit, List<ProjectTaskDto> Tasks, bool CanCreate = false);
public record TaskCommentDto(int Id, string Author, string Initials, string Body, string At);
public record SprintDto(int Id, string Name, string Goal, string StartDate, string EndDate, string Status,
    int CommittedPoints, int TaskCount, int DoneCount, int Points, int DonePoints, int SpilledCount);
public record SprintsDto(bool CanEdit, bool CanCreate, List<SprintDto> Sprints);

public record EpicRefDto(int Id, string Name);
public record EpicDto(int Id, string Name, int Stories, int Done, int Pct, string Status, string DependsOn,
    List<EpicRefDto> Deps);
public record EpicsDto(bool CanEdit, List<EpicDto> Epics, bool CanCreate = false);

public record ArtifactVersionDto(int Id, int Version, string FileName, long Size, string UploadedAt);
public record ArtifactDto(int Id, string Name, string Type, string Owner, string Status, List<ArtifactVersionDto> Versions);
public record ArtifactsDto(bool CanEdit, List<ArtifactDto> Artifacts);

public record RequirementAttachmentDto(int Id, string FileName, long Size, string UploadedAt);
public record RequirementDto(int Id, string Code, string Title, string Type, string Priority, string Status,
    string Epic, string Story, string Test, string TestStatus, string Release, bool Verified,
    string Description, List<RequirementAttachmentDto> Attachments);
public record ChangeRequestDto(int Id, string Code, string Title, string ReqCode, string Impact, string Sdp,
    string Status, string RaisedBy, string Date);
public record ReqStatsDto(int Total, int Approved, int Coverage, int Verified);
public record RequirementsDto(bool CanEdit, ReqStatsDto Stats, List<RequirementDto> Requirements, List<ChangeRequestDto> ChangeRequests);

public record AdmPhaseDto(int Id, string Code, string Phase, string Focus, string Owner, string Artefact, string Status);
public record ArchApprovalDto(int Id, string Role, string Decision, string DecidedBy, string DecidedAt, string Note);
public record ArchitectureDto(bool CanEdit, string ChangeType, List<AdmPhaseDto> Phases,
    List<ArchApprovalDto> Approvals, string ArbStatus);
public record SetArbDecisionReq(string Decision, string? Note);

public record TestPlanTaskDto(int Id, string Title, string Status, string Assignee);
public record TestPlanDto(int Id, string Name, string Stage, int Cases, int Passed, int Failed, int Blocked, int NotRun, int ExecPct,
    List<TestPlanTaskDto> Tasks);
public record DefectDto(int Id, string Code, string Title, string Severity, string Owner, string Status, string Test);
public record QualityTotalsDto(int Cases, int Coverage, int PassRate, int Failed, int OpenDefects);
public record QualityDto(bool CanEdit, QualityTotalsDto Totals, List<TestPlanDto> Plans, List<DefectDto> Defects);

public record DepLinkDto(string Id, string Name, string Dept, string Status, string Health);
public record DependenciesDto(bool CanEdit, List<DepLinkDto> DependsOn, List<DepLinkDto> Blocks,
    bool InheritedRisk, string OwnHealth, string EffHealth, string DepRiskTitle);

public record AbsenceDto(int Id, string Person, string From, string To, string Type);
public record VacationsDto(bool CanEdit, List<AbsenceDto> Absences);

// ---- Communication plan (per-stakeholder cadence & channels) ---------------
public record CommEntryDto(int Id, string Stakeholder, string Channel, string CommType, string Schedule, string Owner, string Notes);
public record CommPlanDto(bool CanEdit, List<CommEntryDto> Entries);

// ---- Teams (Entra groups → manager slots, roll-up hierarchy) ---------------
public record TeamMemberDto(int Id, string DisplayName, string Email, string JobTitle);
public record ProvisionedUserDto(string Name, string Email, string Group, string Role, string Status);
public record DirectoryDto(bool CanManage, List<ProvisionedUserDto> Users);
public record TeamGroupDto(string Id, string DisplayName, string ManagerKey, bool Manual, string LastSynced, int MemberCount);
public record TeamManagerDto(string Key, string Label, string ParentKey, List<string> GroupIds, int MemberCount);
public record TeamsAdminDto(bool CanManage, bool GraphConfigured, List<TeamManagerDto> Managers, List<TeamGroupDto> Groups);
// My Team roll-up: one entry per manager in scope, with that manager's members.
public record MyTeamGroupDto(string Id, string DisplayName, List<TeamMemberDto> Members);
public record MyTeamManagerDto(string Key, string Label, bool IsSelf, List<MyTeamGroupDto> Groups, int MemberCount);
public record MyTeamDto(bool IsAdmin, string ManagerKey, string ManagerLabel, List<MyTeamManagerDto> Teams);

// ---- Help centre & troubleshooting -----------------------------------------
public record HelpArticleDto(int Id, string Kind, string Audience, string Code, string Title, string Summary, string Body, int Ord);
public record HelpDto(bool CanManage, List<HelpArticleDto> Guides, List<HelpArticleDto> Troubleshooting);
public record UpsertHelpReq(string Kind, string? Audience, string? Code, string Title, string? Summary, string? Body, int? Ord);

// ---- Notifications, subscriptions & preferences ----------------------------
public record NotificationDto(int Id, string EventType, string Title, string Body, string TargetType, string TargetId, bool Read, string At);
public record InboxDto(int UnreadCount, List<NotificationDto> Items);
public record SubscriptionDto(int Id, string TargetType, string TargetId);
public record NotifPrefDto(string EventType, string Label, string Detail, bool EntityScoped, bool InApp, bool Email);
public record MarkReadReq(List<int>? Ids, bool All);
public record SubscribeReq(string TargetType, string TargetId);
public record SetPrefReq(bool InApp, bool Email);

// ---- Timeline / Gantt ------------------------------------------------------
public record PhaseDto(int Id, string Name, int StartMonth, int EndMonth, int Progress);
public record MilestoneDto(int Id, string Label, int Month, string Date);
public record GanttDto(bool CanEdit, List<PhaseDto> Phases, List<MilestoneDto> Milestones,
    int? ProjectStart = null, int? ProjectEnd = null, string StartDate = "", string EndDate = "");
public record ProgramGanttRowDto(string ProjectId, string ProjectName, List<PhaseDto> Phases);
public record ProgramGanttDto(List<ProgramGanttRowDto> Rows, List<MilestoneDto> Milestones);

// Portfolio-wide timeline: one bar per entity on the 12-month grid.
public record PortfolioGanttItemDto(string Type, string Id, string Name, string Status, int StartMonth, int EndMonth, int? Progress, string StartLabel, string EndLabel);
public record PortfolioGanttDto(List<PortfolioGanttItemDto> Items);

// ---- Ways of working (methodology-specific ceremonies & artifacts) ---------
public record WowItemDto(string Label, string Detail);
public record WaysOfWorkingDto(string Methodology, string Cadence, string Summary,
    List<WowItemDto> Ceremonies, List<string> Artifacts, List<string> Roles, bool CanEdit = false);

public record CostLineDto(int Id, string Label, string Note, List<string> OwnerRoles, decimal Amount, bool CanEdit, bool IsSystem);
public record CostsDto(bool CanManage, decimal Total, decimal Savings, List<CostLineDto> Lines);

public record ScaffoldItemDto(string Type, string Title);

// ---- Spillover (tasks carried past their baselined sprint) ------------------
public record SpilledTaskDto(string Code, string Name, string Baseline, string Sprint, string Assignee);
public record ProjectSpilloverDto(string Id, string Name, int Count);
public record SpilloverSummaryDto(int Total, int Projects, List<ProjectSpilloverDto> ByProject);

// ---- Weekly Updates news wall ----------------------------------------------
public record NewsBlockDto(int Id, string Kind, string Title, string Body, string Metric, string Label,
    string Tone, string Who, string Caption, string Date, string Meta);
public record NewsWallDto(bool CanEdit, string Theme, string Layout, List<NewsBlockDto> Blocks);

// ---- Backups & settings ----------------------------------------------------
public record BackupComponentDto(string Name, string Schedule, string Retention, int Records, string LastBackup);
public record BackupRunDto(string At, string Actor, string Role, string Size, int Records, string Status);
public record BackupsDto(bool CanManage, bool AutoBackups, string LastBackup, long LastSizeBytes,
    List<BackupComponentDto> Components, List<BackupRunDto> Runs);

public record DeletionRequestDto(int Id, string ProjectId, string ProjectName, string RequestedBy, string RequestedRole, string Date);
public record ArchivedProjectDto(string Id, string Name, string Dept, string Owner, bool IsSystem);
public record ArchiveAdminDto(bool CanGovern, bool CanDelete, List<DeletionRequestDto> Requests, List<ArchivedProjectDto> Archived);

// ---- Team capacity (assigned people vs their allocation) --------------------
public record CapacityRowDto(string Name, string Role, string Initials, string Color,
    int OpsPct, int ProjectPct, int ProductPct, int Util, bool Over, bool HighOps);
public record CapacityDto(int Assigned, int OverCount, int HighOps, List<CapacityRowDto> People, List<string> Unknown);

// ---- Operational items (ops work that can affect a project) -----------------
public record OperationalItemDto(int Id, string Ref, string Title, string Type, string Severity,
    string Status, string Source, string? ProjectId, string? ProjectName, string Owner, string Date);
public record OperationalDto(bool CanEdit, List<OperationalItemDto> Items);

// ---- People & roles (project assignments) ----------------------------------
public record RoleAssignmentDto(string Key, string Label, string Person);
public record AssignmentsDto(bool CanAssignLead, bool CanAssignArch, string LeadKey, string LeadLabel,
    string Lead, List<RoleAssignmentDto> ArchRoles, List<string> Options, List<string> MissingArch);

// ---- Risk engine & status report ------------------------------------------
public record RiskFindingDto(string Severity, string Category, string Title, string Detail, string Framework, string Control);
public record RiskReportDto(int High, int Medium, int Low, List<RiskFindingDto> Findings);
public record StatusReportDto(string Name, string Phase, string Health, int Progress, string BudgetLine,
    int TasksDone, int TasksTotal, int Blocked, int Spillover, int PassRate, int OpenDefects,
    int GatesApproved, int GatesTotal, string DpiaLevel, List<string> Highlights, List<RiskFindingDto> TopRisks);

// ---- Roles & permissions ---------------------------------------------------
public record CapabilityDto(string Key, string Label);
public record RoleDto(string Id, string Name, string Short, string Who, string Description,
    string Icon, string Color, string Tint, bool IsSystem, Dictionary<string, string> Permissions);
public record RolesMatrixDto(List<CapabilityDto> Capabilities, List<RoleDto> Roles, bool CanManage);

public record ProgramDto(string Id, string Name, string Owner, string Goal, string Status,
    List<string> Projects, decimal Budget, decimal Spent, int Progress, string Health, string StartDate = "",
    bool Archived = false, string EndDate = "", string Dept = "");
public record UpdateProgramReq(string? Owner, string? Dept, string? Goal, string? StartDate, string? EndDate, List<string>? Projects);

public record TaskDto(string Id, string Title, string Status, int Points, string DateISO, string MappedRelease);
public record MemberDto(string Name, int Alloc);
public record UpdateProductReq(List<string>? Projects, List<string>? Releases, string? StartDate, string? EndDate, string? Owner, string? Dept);
// ---- Product team (Entra members allocated to a product) -------------------
public record TeamOptionDto(string Key, string Label);
public record ProductAllocationDto(int Id, string Name, string Email, string Title, string TeamKey, string TeamLabel, int Alloc);
public record AllocatableDto(string Name, string Email, string JobTitle, string TeamKey, string TeamLabel);
public record ProductTeamDto(string ProductId, string TeamKey, string TeamLabel, bool CanAssignTeam, bool CanAllocate,
    List<ProductAllocationDto> Allocations, List<AllocatableDto> Assignable, List<TeamOptionDto> TeamOptions);
public record SetProductTeamReq(string? TeamKey);
public record AddAllocationReq(string Name, string? Email, string? Title, string? SourceTeamKey, int Alloc);
public record SetAllocationReq(int Alloc);
public record ProductDto(string Id, string Name, string Owner, string Source, List<string> Projects,
    List<TaskDto> Tasks, List<MemberDto> Members, List<string> Releases, string Status = "Active",
    string StartDate = "", string EndDate = "", bool CanManage = false,
    string TeamKey = "", string TeamLabel = "", int TeamSize = 0, string Dept = "");

public record KrDto(string Id, string Title, string Link, int Progress, string LinkType = "", string LinkId = "", bool Auto = false);
public record ObjectiveDto(string Id, string Title, string Owner, string Horizon, List<KrDto> Krs, string Status = "Active",
    string Health = "green", string StartDate = "", string TargetDate = "");
public record UpdateObjectiveReq(string? Title, string? Owner, string? Horizon, string? StartDate, string? TargetDate, string? Health);

public record ResourceDto(string Name, string Role, string Dept, string Initials, string Color,
    int OpsPct, int ProjectPct, int ProductPct, bool Over);

public record FinRowDto(string Id, string Name, decimal Budget, decimal Spent, decimal Capex,
    decimal Forecast, decimal Variance, decimal Roi, decimal LaborDev, decimal LaborArch, decimal LaborInfra,
    int UsedPct, bool OnTrack, decimal Savings, decimal InfraCloud, decimal DevTooling, decimal Vendor,
    bool RoiManual = false, string Scope = "project");

// Financials envelope: the rows for the selected scope + whether the caller may
// set a manual ROI override, and the ROI calculation explanations.
public record FinancialsDto(string Scope, bool CanEditRoi, List<FinRowDto> Rows,
    string RoiAutoNote, string RoiManualNote);

public record ReleaseDto(string Id, string Name, int Reqs, int Crs, string Owner, string Link,
    string Scope, string Date, string Env, int Progress, string Risk, string Status, bool Archived = false);

public record DeliveryStatsDto(int Completed, int InProgress, int Planned, int Velocity, string VelTrend,
    int OnTime, int BlockersCleared, int BlockersOpen, int Milestones, string BudgetBurn, int SpendPct,
    string Satisfaction, string CostPerDeliverable, string ValuePerEuro);

public record StakeholderProjectDto(string Id, string Name, string Dept, string Status, string Health,
    int Progress, string Target, string Phase);

public record ProjectDetailDto(string Id, string Name, string Dept, string Owner, string Methodology,
    string Status, string Health, int Progress, string Phase, decimal Budget, decimal Spent, string Due,
    string StartDate = "", string Target = "", string Summary = "",
    string JiraProjectKey = "", int? JiraBoardId = null);

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
