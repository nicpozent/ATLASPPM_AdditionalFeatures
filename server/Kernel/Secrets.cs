using Azure.Identity;
using Microsoft.Extensions.Configuration;

namespace Atlas.Api;

// ============================================================================
//  Secret sourcing — layered on top of the default configuration providers so
//  production never has to bake secrets into appsettings or an image.
//
//  Both providers are INERT unless configured, so this changes nothing until
//  you opt in:
//
//   • Docker / Kubernetes secrets (now, Windows-Docker): files mounted under
//     /run/secrets are read by KeyPerFile. A file named
//     `ConnectionStrings__Postgres` becomes config key
//     `ConnectionStrings:Postgres` — so the DB password never appears in an
//     env var, image layer or appsettings file.
//
//   • Azure Key Vault (later, Azure move): set KeyVault:Uri and secrets are
//     pulled with DefaultAzureCredential — i.e. the app's Managed Identity in
//     Azure, so there is no client secret to store either.
//
//  Added AFTER the default providers, so a configured secret store wins over
//  appsettings and environment variables. See docs/secrets.md.
// ============================================================================
public static class Secrets
{
    public static void AddAtlasSecrets(this WebApplicationBuilder builder)
    {
        var cfg = builder.Configuration;

        // File-mounted secrets (Docker/K8s). KeyPerFile maps `__` in a file name
        // to the config section delimiter, so `ConnectionStrings__Postgres` →
        // `ConnectionStrings:Postgres`.
        var dir = cfg["Secrets:Directory"] ?? "/run/secrets";
        if (Directory.Exists(dir))
            builder.Configuration.AddKeyPerFile(directoryPath: dir, optional: true);

        // Azure Key Vault (passwordless via Managed Identity). Off unless a URI
        // is configured, so it's a one-setting switch when you move to Azure.
        var kvUri = cfg["KeyVault:Uri"];
        if (!string.IsNullOrWhiteSpace(kvUri))
            builder.Configuration.AddAzureKeyVault(new Uri(kvUri), new DefaultAzureCredential());

        // OpenBao / HashiCorp Vault (on-prem, KV v2). Off unless an address AND a
        // token are configured; the token itself may come from the file layer
        // above (a `Bao__Token` secret). Non-fatal on read failure. See OpenBao.cs.
        var baoAddr = cfg["Bao:Address"];
        var baoToken = cfg["Bao:Token"];
        if (!string.IsNullOrWhiteSpace(baoAddr) && !string.IsNullOrWhiteSpace(baoToken))
            ((IConfigurationBuilder)builder.Configuration).Add(new OpenBaoSource
            {
                Address = baoAddr!, Token = baoToken!,
                Mount = cfg["Bao:Mount"] is { Length: > 0 } m ? m : "secret",
                Path = cfg["Bao:Path"] is { Length: > 0 } p ? p : "atlas",
            });
    }
}
