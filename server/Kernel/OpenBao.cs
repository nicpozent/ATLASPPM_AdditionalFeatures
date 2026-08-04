using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace Atlas.Api;

// ============================================================================
//  OpenBao / HashiCorp Vault secrets (KV v2), read over the HTTP API at startup.
//
//  OpenBao is the open-source (MPL-2.0) fork of Vault and is API-compatible, so
//  this one provider works against either. It's the on-prem counterpart to the
//  Azure Key Vault layer: centralised secrets + audit, without a cloud tie.
//
//  INERT unless Bao:Address AND a token are configured, so it changes nothing
//  until you opt in. Reads {Address}/v1/{Mount}/data/{Path} with the X-Vault-
//  Token header; each secret key maps to a config key with `__` → `:`, exactly
//  like the file-secrets and Key Vault layers — so a secret named
//  `ConnectionStrings__Postgres` becomes `ConnectionStrings:Postgres`.
//
//  Added AFTER the default + file providers (see Secrets.cs) so a vaulted secret
//  wins over appsettings/env; the token itself can therefore be delivered by the
//  /run/secrets file layer (`Bao__Token`). Failure is non-fatal by default: a
//  read error is logged and boot continues (the app falls back to whatever the
//  lower layers provide), so an unreachable vault never wedges startup.
//  See docs/secrets.md · ADR-0067.
// ============================================================================
internal sealed class OpenBaoSource : IConfigurationSource
{
    public required string Address { get; init; }
    public required string Token { get; init; }
    public string Mount { get; init; } = "secret";
    public string Path { get; init; } = "atlas";
    public bool Optional { get; init; } = true;
    public IConfigurationProvider Build(IConfigurationBuilder builder) => new OpenBaoProvider(this);
}

internal sealed class OpenBaoProvider(OpenBaoSource src) : ConfigurationProvider
{
    public override void Load()
    {
        try
        {
            using var http = new HttpClient { BaseAddress = new Uri(src.Address.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(10) };
            http.DefaultRequestHeaders.Add("X-Vault-Token", src.Token);
            var json = http.GetStringAsync($"v1/{src.Mount}/data/{Uri.EscapeDataString(src.Path)}").GetAwaiter().GetResult();
            Data = OpenBao.ParseKvV2(json);
        }
        catch (Exception ex) when (src.Optional)
        {
            Console.Error.WriteLine($"[secrets] OpenBao read from {src.Address} failed (continuing without it): {ex.Message}");
        }
    }
}

public static class OpenBao
{
    // Flatten a KV v2 read response ({ data: { data: { k: v, … } } }) into config
    // entries, mapping `__` in a key to the section delimiter `:`. Non-string
    // values keep their raw JSON. Missing/!object data → empty (no throw), so a
    // malformed or empty secret is a no-op rather than a boot failure.
    internal static Dictionary<string, string?> ParseKvV2(string json)
    {
        var result = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.TryGetProperty("data", out var outer) &&
            outer.ValueKind == JsonValueKind.Object &&
            outer.TryGetProperty("data", out var kv) &&
            kv.ValueKind == JsonValueKind.Object)
        {
            foreach (var p in kv.EnumerateObject())
                result[p.Name.Replace("__", ":")] =
                    p.Value.ValueKind == JsonValueKind.String ? p.Value.GetString() : p.Value.GetRawText();
        }
        return result;
    }
}
