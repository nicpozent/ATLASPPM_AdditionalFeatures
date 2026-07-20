namespace Atlas.Api;

// ============================================================================
//  Write-endpoint request & inline DTO bodies (create/update payloads).
//  (Split out of WriteEndpoints.cs — same namespace, no behavioural change.)
// ============================================================================

// ---- Request bodies --------------------------------------------------------
public record CreateDemandReq(
    string Title, string? Dept, string? Priority, int? Value, int? Effort,
    // IT Request & Innovation intake form
    string? Description, string? Source, List<string>? GeoImpact, bool? HasDeadline, string? Deadline,
    string? BusinessProblem, bool? ImprovementExisting, int? Criticality, int? Risk,
    string? ExpectedBenefits, int? BenefitValue, List<string>? Stakeholders, bool? AllStakeholders);
public record UpdateDemandStageReq(string Stage);
public record DemandCommentReq(string Body);
public record DemandCommentDto(int Id, string Author, string Body, string CreatedAt);
public record DemandCommentsDto(bool CanComment, List<DemandCommentDto> Comments);
public record CreateBlockerReq(string Title, string ProjectId, string? Owner, string? Status, string? Description);
public record UpdateBlockerReq(string? Title, string? Owner, string? Status, string? Description);
public record CreateProjectReq(string Name, string? Dept, string? Owner, string? Methodology, bool? ApplyTemplate,
    string? StartDate, string? Target);
public record UpdateProjectReq(string? Name, string? Dept, string? Owner, string? Methodology,
    string? Status, int? Progress, string? Phase, string? Target, decimal? Budget, decimal? Spent, decimal? Forecast,
    string? StartDate, string? Summary, string? JiraProjectKey, int? JiraBoardId);
public record CreateProgramReq(string Name, string? Owner, string? Goal, string? Status, List<string>? Projects, string? StartDate, string? EndDate, string? Dept);
public record CreateProductReq(string Name, string? Owner, string? Source, List<string>? Projects, string? StartDate, string? EndDate, string? TeamKey, string? Dept);
public record CreateReleaseReq(string Name, string? Owner, string? Link, string? Scope, string? Date, string? Env, string? Risk);
public record UpdateReleaseReq(string? Name, string? Owner, string? Link, string? Scope, string? Date, string? Env,
    string? Risk, int? Reqs, int? Crs, int? Progress, string? Status);
public record CreateObjectiveReq(string Title, string? Owner, string? Horizon, string? StartDate, string? TargetDate);
public record CreateKrReq(string Title, string? Link, int? Progress, string? LinkType, string? LinkId);
public record UpdateKrReq(int? Progress, string? LinkType, string? LinkId);

