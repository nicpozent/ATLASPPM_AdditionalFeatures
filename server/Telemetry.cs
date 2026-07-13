using System.Data.Common;
using System.Diagnostics;
using System.Diagnostics.Metrics;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Atlas.Api;

// ============================================================================
//  Atlas application-level telemetry — a custom Meter and ActivitySource on top
//  of the auto-instrumentation (ASP.NET Core / HttpClient / EF / runtime).
//
//  These emit only when OpenTelemetry is enabled (an OTLP endpoint is set); the
//  instruments are cheap no-ops otherwise. The meter/source names are registered
//  in Observability.cs so the collector picks them up.
//
//  • atlas.audit.events   — counter of audited domain writes, tagged by area/action
//  • Activity source      — for manual spans around domain operations (ready to use)
// ============================================================================
public static class AtlasTelemetry
{
    public const string Name = "Atlas.Api";

    static readonly Meter Meter = new(Name);
    public static readonly ActivitySource Source = new(Name);

    // A domain-write counter — every audited action bumps it, tagged so a
    // dashboard can break activity down by area (Tasks, Blockers, Security…).
    public static readonly Counter<long> AuditEvents =
        Meter.CreateCounter<long>("atlas.audit.events", unit: "{event}", description: "Audited domain write actions.");

    public static void RecordAudit(string category, string action) =>
        AuditEvents.Add(1, new KeyValuePair<string, object?>("area", category), new KeyValuePair<string, object?>("action", action));

    // Connector sync duration (seconds) per project, tagged by connector + outcome
    // — powers "Jira/ADO sync durations" and a sync-failure alert.
    static readonly Histogram<double> SyncSeconds =
        Meter.CreateHistogram<double>("atlas.sync.duration", unit: "s", description: "Connector work-item sync duration per project.");

    public static void RecordSync(string connector, double seconds, bool ok) =>
        SyncSeconds.Record(seconds,
            new KeyValuePair<string, object?>("connector", connector),
            new KeyValuePair<string, object?>("outcome", ok ? "ok" : "error"));

    // Over-allocation alerts freshly delivered per capacity pass.
    public static readonly Counter<long> CapacityAlerts =
        Meter.CreateCounter<long>("atlas.capacity.alerts", unit: "{alert}", description: "Over-allocation alerts delivered.");

    // Microsoft Teams notification delivery, tagged by outcome (ADR-0060) —
    // powers a delivery-failure alert; the in-app copy is unaffected either way.
    static readonly Counter<long> TeamsNotifications =
        Meter.CreateCounter<long>("atlas.teams.notifications", unit: "{message}", description: "Teams channel notifications posted, by outcome.");

    public static void RecordTeamsDelivery(bool ok) =>
        TeamsNotifications.Add(1, new KeyValuePair<string, object?>("outcome", ok ? "ok" : "error"));

    // Real-time collaboration hub (ADR-0061): count of change-pings broadcast to
    // viewers across all rooms (PI boards, the demand funnel, …). Metric name kept
    // stable (atlas.board.*) for dashboard continuity as rooms were generalised.
    static readonly Counter<long> BoardBroadcasts =
        Meter.CreateCounter<long>("atlas.board.broadcasts", unit: "{broadcast}", description: "Real-time room change-pings broadcast to viewers.");

    public static void RecordBoardBroadcast() => BoardBroadcasts.Add(1);

    // Live collaboration-hub state — observable gauges registered once at startup
    // with accessors into the hub's in-memory presence map (see BoardHub /
    // Program.cs). Counts span every room (PI boards, the demand funnel, …).
    static bool _boardGaugesRegistered;
    public static void RegisterBoardGauges(Func<int> activeConnections, Func<int> activeBoards)
    {
        if (_boardGaugesRegistered) return;
        _boardGaugesRegistered = true;
        Meter.CreateObservableGauge("atlas.board.connections", activeConnections,
            unit: "{connection}", description: "Live real-time hub connections across all rooms.");
        Meter.CreateObservableGauge("atlas.board.active", activeBoards,
            unit: "{board}", description: "Real-time rooms with at least one viewer.");
    }

    // DB command duration (seconds) — recorded by AtlasDbMetricsInterceptor so EF
    // query timings show up as a Prometheus histogram (traces live in Tempo).
    static readonly Histogram<double> DbSeconds =
        Meter.CreateHistogram<double>("atlas.db.command.duration", unit: "s", description: "EF Core database command duration.");

    public static void RecordDbCommand(double seconds, bool ok) =>
        DbSeconds.Record(seconds, new KeyValuePair<string, object?>("outcome", ok ? "ok" : "error"));

    // Background-sync queue depth (pending jobs) per connector — an observable
    // gauge registered once at startup with accessors into the queue singletons.
    static bool _gaugesRegistered;
    public static void RegisterQueueGauges(Func<int> jiraDepth, Func<int> adoDepth)
    {
        if (_gaugesRegistered) return;
        _gaugesRegistered = true;
        Meter.CreateObservableGauge("atlas.sync.queue.depth",
            () => new[]
            {
                new Measurement<int>(jiraDepth(), new KeyValuePair<string, object?>("connector", "jira")),
                new Measurement<int>(adoDepth(), new KeyValuePair<string, object?>("connector", "ado")),
            },
            unit: "{job}", description: "Pending background sync jobs per connector.");
    }
}

// Records every EF Core command's duration into the atlas.db.command.duration
// histogram (see AtlasTelemetry). Cheap: a Stopwatch per command; the metric is
// a no-op when OpenTelemetry isn't wired.
public sealed class AtlasDbMetricsInterceptor : DbCommandInterceptor
{
    public override async ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData, DbDataReader result, CancellationToken cancellationToken = default)
    {
        AtlasTelemetry.RecordDbCommand(eventData.Duration.TotalSeconds, ok: true);
        return await base.ReaderExecutedAsync(command, eventData, result, cancellationToken);
    }
    public override DbDataReader ReaderExecuted(DbCommand command, CommandExecutedEventData eventData, DbDataReader result)
    {
        AtlasTelemetry.RecordDbCommand(eventData.Duration.TotalSeconds, ok: true);
        return base.ReaderExecuted(command, eventData, result);
    }
    public override async ValueTask<int> NonQueryExecutedAsync(DbCommand command, CommandExecutedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        AtlasTelemetry.RecordDbCommand(eventData.Duration.TotalSeconds, ok: true);
        return await base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
    }
    public override int NonQueryExecuted(DbCommand command, CommandExecutedEventData eventData, int result)
    {
        AtlasTelemetry.RecordDbCommand(eventData.Duration.TotalSeconds, ok: true);
        return base.NonQueryExecuted(command, eventData, result);
    }
    public override async ValueTask<object?> ScalarExecutedAsync(DbCommand command, CommandExecutedEventData eventData, object? result, CancellationToken cancellationToken = default)
    {
        AtlasTelemetry.RecordDbCommand(eventData.Duration.TotalSeconds, ok: true);
        return await base.ScalarExecutedAsync(command, eventData, result, cancellationToken);
    }
    public override object? ScalarExecuted(DbCommand command, CommandExecutedEventData eventData, object? result)
    {
        AtlasTelemetry.RecordDbCommand(eventData.Duration.TotalSeconds, ok: true);
        return base.ScalarExecuted(command, eventData, result);
    }
    public override void CommandFailed(DbCommand command, CommandErrorEventData eventData)
    {
        AtlasTelemetry.RecordDbCommand(eventData.Duration.TotalSeconds, ok: false);
        base.CommandFailed(command, eventData);
    }
    public override async Task CommandFailedAsync(DbCommand command, CommandErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        AtlasTelemetry.RecordDbCommand(eventData.Duration.TotalSeconds, ok: false);
        await base.CommandFailedAsync(command, eventData, cancellationToken);
    }
}
