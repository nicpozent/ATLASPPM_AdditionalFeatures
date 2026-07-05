using System.Diagnostics;
using System.Diagnostics.Metrics;

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
}
