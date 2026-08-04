using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Atlas.Api;

// ============================================================================
//  OpenTelemetry wiring — distributed traces, metrics and logs over OTLP.
//
//  The exporter endpoint is CONFIGURATION ONLY. With nothing set the entire
//  stack stays off and the app runs exactly as before — so shipping this can't
//  break anything; you switch it on by pointing it at a collector.
//
//  Turn it on by setting either:
//    • OTEL_EXPORTER_OTLP_ENDPOINT  (the standard env var the exporter reads
//      for endpoint/headers/protocol on its own), or
//    • OpenTelemetry:Enabled = true (env: OpenTelemetry__Enabled)
//
//  Instruments ASP.NET Core requests, outbound HttpClient calls, EF Core
//  queries and .NET runtime metrics. See docs/observability.md for the full
//  setup (self-hosted collector and Azure Monitor paths).
// ============================================================================
public static class Observability
{
    public static void AddAtlasObservability(this WebApplicationBuilder builder)
    {
        var cfg = builder.Configuration;
        // On when a standard OTLP endpoint is present, or explicitly enabled.
        var endpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
        var enabled = cfg.GetValue("OpenTelemetry:Enabled", false) || !string.IsNullOrWhiteSpace(endpoint);
        if (!enabled) return;

        var serviceName = cfg["OpenTelemetry:ServiceName"]
            ?? Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME")
            ?? "atlas-api";
        var version = typeof(Observability).Assembly.GetName().Version?.ToString() ?? "0.0.0";

        // Shared resource identity applied to traces, metrics AND logs so they
        // correlate to the same service in the backend.
        ResourceBuilder Resource() => ResourceBuilder.CreateDefault()
            .AddService(serviceName: serviceName, serviceVersion: version)
            .AddTelemetrySdk();

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(r => r
                .AddService(serviceName: serviceName, serviceVersion: version)
                .AddTelemetrySdk())
            .WithTracing(t => t
                .AddSource(AtlasTelemetry.Name)                       // manual domain spans
                .AddAspNetCoreInstrumentation(o => o.RecordException = true)
                .AddHttpClientInstrumentation()
                .AddEntityFrameworkCoreInstrumentation(o => o.SetDbStatementForText = false)
                .AddOtlpExporter())
            .WithMetrics(m => m
                .AddMeter(AtlasTelemetry.Name)                        // Atlas domain metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation()
                .AddOtlpExporter());

        // Structured logs (including the SRV-/INT- correlation codes) exported
        // over OTLP alongside traces, so a trace and its logs sit together.
        builder.Logging.AddOpenTelemetry(o =>
        {
            o.SetResourceBuilder(Resource());
            o.IncludeScopes = true;
            o.IncludeFormattedMessage = true;
            o.AddOtlpExporter();
        });
    }
}
