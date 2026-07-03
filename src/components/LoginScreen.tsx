// ============================================================================
//  Full-page sign-in shown when auth is enabled and no user is signed in.
//  Matches the Atlas shell palette (navy) and reuses the Birgma/Biltema marks.
// ============================================================================
import { color, font } from "@/theme";

function MicrosoftMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true" style={{ flex: "none" }}>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: color.navy,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: font.body,
    }}>
      <div style={{
        width: 420, maxWidth: "100%", background: color.surface,
        borderRadius: 18, padding: "34px 32px 30px",
        boxShadow: "0 30px 70px rgba(0,0,0,0.35)",
      }}>
        {/* Brand marks (same as sidebar) */}
        <div style={{
          background: "#fff", border: `1px solid ${color.border}`, borderRadius: 12,
          padding: "14px 16px", display: "flex", flexDirection: "column",
          alignItems: "center", gap: 10, marginBottom: 22,
        }}>
          <img src="/assets/birgma-logo-trim.png" alt="Birgma" style={{ height: 20, width: "auto" }} />
          <span style={{ width: "70%", height: 1, background: "#E8ECF3" }} />
          <img src="/assets/biltema-logo-trim.png" alt="Biltema" style={{ height: 20, width: "auto" }} />
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 6 }}>
          <span style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: color.ink, letterSpacing: "0.01em" }}>Atlas</span>
          <span style={{ fontSize: 11, color: color.faint, letterSpacing: "0.13em", textTransform: "uppercase" }}>Portfolio &amp; PM</span>
        </div>
        <div style={{ fontSize: 14, color: color.subtle, lineHeight: 1.5, marginBottom: 24 }}>
          Sign in with your Biltema Group account to access the portfolio.
        </div>

        <button
          onClick={onSignIn}
          style={{
            width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center",
            gap: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 600,
            color: "#fff", background: color.primary, border: "none",
            padding: "13px 16px", borderRadius: 10, cursor: "pointer",
          }}
        >
          <MicrosoftMark />
          Sign in with Microsoft
        </button>

        <div style={{ fontSize: 11.5, color: color.faint3, textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
          Secured by Microsoft Entra ID · single sign-on
        </div>
      </div>
    </div>
  );
}
