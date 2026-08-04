using Npgsql;

namespace Atlas.Api;

// Small database-config helpers kept out of Program.cs so they're unit-testable.
public static class Db
{
    // Apply a configured TLS mode to the connection string. Non-breaking by
    // design: with no `Database:SslMode` set, the string is returned untouched
    // (Npgsql's own default — Prefer — applies, i.e. TLS is used opportunistically
    // and falls back when the server has no certificate). Production against
    // Azure Postgres sets Database__SslMode=Require to enforce encryption in
    // transit. An unrecognised value is ignored rather than throwing.
    public static string ApplySslMode(string connectionString, string? sslMode)
    {
        if (string.IsNullOrWhiteSpace(sslMode)) return connectionString;
        if (!Enum.TryParse<SslMode>(sslMode.Trim(), ignoreCase: true, out var mode)) return connectionString;
        return new NpgsqlConnectionStringBuilder(connectionString) { SslMode = mode }.ConnectionString;
    }
}
