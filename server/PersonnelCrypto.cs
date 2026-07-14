using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace Atlas.Api;

// ============================================================================
//  Field encryption for the DPIA-gated personnel notes (Team SWOT + individual
//  development plans, ADR-0062/0063). AES-256-GCM with a per-value random nonce.
//
//  The key comes from config `Personnel:EncryptionKey` — delivered by the secret
//  layer (a /run/secrets file, env var or OpenBao/Vault) and NEVER stored in the
//  database, so a stolen DB/backup yields only ciphertext.
//
//  INERT until a key is set: Protect() returns plaintext, so the gated-off default
//  deployment is unaffected and no migration/backfill is needed. Reads are
//  backward-compatible — a value is decrypted only if it carries the "enc:v1:"
//  marker, otherwise it's passed through as legacy plaintext. A second key
//  `Personnel:EncryptionKeyOld` is accepted for reads to allow zero-downtime key
//  rotation (write new, still read old, then re-encrypt and drop the old key).
//
//  See docs/secrets.md · ADR-0068.
// ============================================================================
public static class PersonnelCrypto
{
    const string Marker = "enc:v1:";

    // A configured 256-bit key (base64 of 32 bytes), or null when absent/invalid.
    static byte[]? Key(IConfiguration cfg, string name)
    {
        var raw = cfg[name];
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try { var k = Convert.FromBase64String(raw.Trim()); return k.Length == 32 ? k : null; }
        catch { return null; }
    }

    public static bool Enabled(IConfiguration cfg) => Key(cfg, "Personnel:EncryptionKey") is not null;

    // Encrypt plaintext for storage; returns it unchanged when no key is configured.
    public static string Protect(IConfiguration cfg, string plaintext)
    {
        var key = Key(cfg, "Personnel:EncryptionKey");
        if (key is null) return plaintext;                     // inert — plaintext passthrough
        var nonce = RandomNumberGenerator.GetBytes(AesGcm.NonceByteSizes.MaxSize);
        var pt = Encoding.UTF8.GetBytes(plaintext);
        var ct = new byte[pt.Length];
        var tag = new byte[AesGcm.TagByteSizes.MaxSize];
        using var gcm = new AesGcm(key, tag.Length);
        gcm.Encrypt(nonce, pt, ct, tag);
        var blob = new byte[nonce.Length + ct.Length + tag.Length];
        Buffer.BlockCopy(nonce, 0, blob, 0, nonce.Length);
        Buffer.BlockCopy(ct, 0, blob, nonce.Length, ct.Length);
        Buffer.BlockCopy(tag, 0, blob, nonce.Length + ct.Length, tag.Length);
        return Marker + Convert.ToBase64String(blob);
    }

    // Decrypt a stored value; passes legacy plaintext (no marker) through. Returns
    // null when a marked value can't be decrypted with any configured key (missing
    // or wrong key, or tampering) — the caller treats that as "not shown", never a
    // crash, so a lost/rotated-away key hides the data rather than corrupting it.
    public static string? Unprotect(IConfiguration cfg, string stored)
    {
        if (!stored.StartsWith(Marker, StringComparison.Ordinal)) return stored;   // legacy plaintext
        byte[] blob;
        try { blob = Convert.FromBase64String(stored[Marker.Length..]); }
        catch { return null; }
        var nonceLen = AesGcm.NonceByteSizes.MaxSize;
        var tagLen = AesGcm.TagByteSizes.MaxSize;
        if (blob.Length < nonceLen + tagLen) return null;
        foreach (var name in new[] { "Personnel:EncryptionKey", "Personnel:EncryptionKeyOld" })
        {
            var key = Key(cfg, name);
            if (key is null) continue;
            try
            {
                var nonce = blob[..nonceLen];
                var tag = blob[^tagLen..];
                var ct = blob[nonceLen..^tagLen];
                var pt = new byte[ct.Length];
                using var gcm = new AesGcm(key, tagLen);
                gcm.Decrypt(nonce, ct, tag, pt);
                return Encoding.UTF8.GetString(pt);
            }
            catch (CryptographicException) { /* wrong key or tampered — try the next */ }
        }
        return null;   // no configured key could decrypt it
    }
}
