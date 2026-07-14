using System.Security.Cryptography;
using Atlas.Api;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Atlas.Tests;

// Field encryption for the DPIA-gated personnel notes: round-trip, inert-when-
// unset (so the gated-off default needs no migration), legacy-plaintext read
// passthrough, two-key rotation, and tamper/wrong-key → "not shown" (null) not a
// crash. AES-GCM's nonce/tag handling is the framework's; here we cover the
// wrapper's behaviour contract.
public class PersonnelCryptoTests
{
    static string NewKey() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    static IConfiguration Cfg(params (string k, string v)[] pairs) =>
        new ConfigurationBuilder().AddInMemoryCollection(
            pairs.Select(p => new KeyValuePair<string, string?>(p.k, p.v))).Build();

    [Fact]
    public void Round_trips_when_a_key_is_set()
    {
        var cfg = Cfg(("Personnel:EncryptionKey", NewKey()));
        var stored = PersonnelCrypto.Protect(cfg, "sensitive note");
        Assert.StartsWith("enc:v1:", stored);                       // marked + not plaintext
        Assert.DoesNotContain("sensitive note", stored);
        Assert.Equal("sensitive note", PersonnelCrypto.Unprotect(cfg, stored));
    }

    [Fact]
    public void Inert_when_no_key_is_configured()
    {
        var cfg = Cfg();
        Assert.False(PersonnelCrypto.Enabled(cfg));
        Assert.Equal("plain", PersonnelCrypto.Protect(cfg, "plain"));   // passthrough, no marker
        Assert.Equal("plain", PersonnelCrypto.Unprotect(cfg, "plain"));
    }

    [Fact]
    public void Legacy_plaintext_reads_through_even_after_a_key_is_added()
    {
        // A value written before encryption was enabled has no marker → returned as-is.
        var cfg = Cfg(("Personnel:EncryptionKey", NewKey()));
        Assert.Equal("{\"Strengths\":\"x\"}", PersonnelCrypto.Unprotect(cfg, "{\"Strengths\":\"x\"}"));
    }

    [Fact]
    public void Second_key_allows_zero_downtime_rotation()
    {
        var oldKey = NewKey();
        var written = PersonnelCrypto.Protect(Cfg(("Personnel:EncryptionKey", oldKey)), "rotate me");
        // After rotation the old key moves to the *Old slot and a new key is primary;
        // the old ciphertext still decrypts on read.
        var rotated = Cfg(("Personnel:EncryptionKey", NewKey()), ("Personnel:EncryptionKeyOld", oldKey));
        Assert.Equal("rotate me", PersonnelCrypto.Unprotect(rotated, written));
    }

    [Fact]
    public void Wrong_or_missing_key_yields_null_not_a_crash()
    {
        var written = PersonnelCrypto.Protect(Cfg(("Personnel:EncryptionKey", NewKey())), "secret");
        Assert.Null(PersonnelCrypto.Unprotect(Cfg(("Personnel:EncryptionKey", NewKey())), written));  // wrong key
        Assert.Null(PersonnelCrypto.Unprotect(Cfg(), written));                                        // no key at all
        Assert.Null(PersonnelCrypto.Unprotect(Cfg(("Personnel:EncryptionKey", NewKey())), "enc:v1:not-base64!"));
    }

    [Fact]
    public void Tampered_ciphertext_fails_closed()
    {
        var key = NewKey();
        var cfg = Cfg(("Personnel:EncryptionKey", key));
        var stored = PersonnelCrypto.Protect(cfg, "authentic");
        // Flip a character in the base64 body — GCM auth must reject it.
        var body = stored["enc:v1:".Length..];
        var tampered = "enc:v1:" + (body[0] == 'A' ? 'B' : 'A') + body[1..];
        Assert.Null(PersonnelCrypto.Unprotect(cfg, tampered));
    }
}
