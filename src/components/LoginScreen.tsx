// ============================================================================
//  Full-page sign-in shown when auth is enabled and no user is signed in.
//  Split layout: navy brand hero (left) + Entra sign-in card (right).
// ============================================================================
import { useEffect, useState } from "react";
import { color, font, radius } from "@/theme";

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

function CheckDot() {
  return (
    <span
      aria-hidden="true"
      style={{
        flex: "none", width: 22, height: 22, borderRadius: "50%",
        background: "rgba(21,163,74,0.18)", border: "1px solid rgba(21,163,74,0.45)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3FD07A" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

function InfoMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1, stroke: color.primary }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

const BULLETS = [
  "Single sign-on with your Microsoft work account",
  "Multi-factor protected · access by role",
  "No separate password to manage",
];

const COMPLIANCE = ["GDPR", "ISO 27001", "Microsoft Entra ID", "EU data residency"];

// Narrow viewport → stack to a single column and drop the hero panel.
function useNarrow(breakpoint = 900) {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [breakpoint]);
  return narrow;
}

export function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  const narrow = useNarrow();
  const [info, setInfo] = useState<null | "privacy" | "support">(null);

  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", fontFamily: font.body,
      background: color.bg, overflow: "auto",
    }}>
      {/* ── Left: navy brand hero ─────────────────────────────────────── */}
      {!narrow && (
        <div style={{
          flex: "1.15 1 0", position: "relative", overflow: "hidden",
          background: color.sidebarBg,
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "48px 56px",
        }}>
          {/* faint grid */}
          <div aria-hidden="true" style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }} />
          {/* top-right glow */}
          <div aria-hidden="true" style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(620px 420px at 78% 8%, rgba(15,108,189,0.45), transparent 60%)",
          }} />
          {/* bottom accent wash */}
          <div aria-hidden="true" style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(520px 360px at 6% 108%, rgba(122,63,176,0.22), transparent 62%)",
          }} />

          {/* wordmark */}
          <div style={{ position: "absolute", top: 48, left: 56, display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>Atlas</span>
            <span style={{ fontSize: 11, color: color.sidebarMuted, letterSpacing: "0.15em", textTransform: "uppercase" }}>Portfolio &amp; PM</span>
          </div>

          {/* centered content */}
          <div style={{ position: "relative", maxWidth: 540 }}>
            <h1 style={{
              margin: 0, fontFamily: font.head, fontWeight: 700, color: "#fff",
              fontSize: 47, lineHeight: 1.07, letterSpacing: "-0.015em",
            }}>
              One portfolio.<br />Every project, program<br />&amp; demand.
            </h1>
            <p style={{
              margin: "22px 0 0", maxWidth: 440, color: color.sidebarText,
              fontSize: 16, lineHeight: 1.6,
            }}>
              The Birgma &amp; Biltema Group platform for portfolio governance,
              delivery tracking and demand intake — from strategy down to the sprint.
            </p>

            <ul style={{ listStyle: "none", margin: "34px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              {BULLETS.map((b) => (
                <li key={b} style={{ display: "flex", alignItems: "center", gap: 13, color: "#D6DCEC", fontSize: 15 }}>
                  <CheckDot />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* compliance footer */}
          <div style={{
            position: "absolute", bottom: 40, left: 56, right: 56,
            display: "flex", flexWrap: "wrap", gap: "6px 14px",
            fontSize: 12, letterSpacing: "0.04em", color: color.sidebarLabel,
          }}>
            {COMPLIANCE.map((c, i) => (
              <span key={c} style={{ display: "inline-flex", gap: "6px 14px" }}>
                {i > 0 && <span aria-hidden="true" style={{ marginRight: 14, opacity: 0.6 }}>·</span>}
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Right: sign-in ────────────────────────────────────────────── */}
      <div style={{
        flex: "1 1 0", minWidth: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: narrow ? "40px 22px" : "48px 40px",
      }}>
        <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column", gap: 14 }}>
          {narrow && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, justifyContent: "center", marginBottom: 4 }}>
              <span style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: color.ink, letterSpacing: "0.01em" }}>Atlas</span>
              <span style={{ fontSize: 11, color: color.faint, letterSpacing: "0.14em", textTransform: "uppercase" }}>Portfolio &amp; PM</span>
            </div>
          )}

          {/* brand marks */}
          <div style={{
            background: "#fff", borderRadius: 14, padding: "18px 22px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 20,
            boxShadow: "0 1px 3px rgba(17,22,58,0.06)", border: `1px solid ${color.border}`,
          }}>
            <img src="/assets/birgma-logo-trim.png" alt="Birgma" style={{ height: 22, width: "auto", flex: "0 1 auto" }} />
            <span aria-hidden="true" style={{ width: 1, height: 26, background: color.border2, flex: "none" }} />
            <img src="/assets/biltema-logo-trim.png" alt="Biltema" style={{ height: 22, width: "auto", flex: "0 1 auto" }} />
          </div>

          {/* sign-in card */}
          <div style={{
            background: "#fff", borderRadius: 16, padding: "28px 26px 26px",
            boxShadow: "0 1px 3px rgba(17,22,58,0.06)", border: `1px solid ${color.border}`,
          }}>
            <h2 style={{ margin: 0, fontFamily: font.head, fontSize: 22, fontWeight: 700, color: color.ink }}>
              Sign in to Atlas
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: color.subtle, lineHeight: 1.5 }}>
              Use your Birgma / Biltema Microsoft account. You&apos;ll be redirected to Microsoft to complete sign-in.
            </p>

            <button
              onClick={onSignIn}
              style={{
                width: "100%", marginTop: 20, display: "inline-flex", alignItems: "center", justifyContent: "center",
                gap: 11, fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "#fff",
                background: color.sidebarBg, border: "none", padding: "14px 16px",
                borderRadius: radius.lg, cursor: "pointer",
              }}
            >
              <MicrosoftMark />
              Sign in with Microsoft
            </button>

            {/* divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 0" }}>
              <span style={{ flex: 1, height: 1, background: color.border2 }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", color: color.faint3 }}>SECURED BY ENTRA ID</span>
              <span style={{ flex: 1, height: 1, background: color.border2 }} />
            </div>

            {/* no-access note */}
            <div style={{
              marginTop: 18, background: color.primaryTint, border: `1px solid ${color.border}`,
              borderRadius: radius.md, padding: "13px 14px", display: "flex", gap: 10,
            }}>
              <InfoMark />
              <span style={{ fontSize: 12.5, color: color.textMuted, lineHeight: 1.5 }}>
                No access yet? Ask your PMO administrator to assign you an Atlas role in Microsoft Entra ID.
              </span>
            </div>
          </div>

          {/* footer */}
          <div style={{ textAlign: "center", fontSize: 12, color: color.faint, lineHeight: 1.7, marginTop: 8 }}>
            <div>© 2026 Birgma International · Biltema Group</div>
            <div>
              Atlas PPM · v1.0 ·{" "}
              <button type="button" onClick={() => setInfo(info === "privacy" ? null : "privacy")} aria-expanded={info === "privacy"} style={{ background: "none", border: "none", padding: 0, font: "inherit", fontSize: 12, color: color.primary, cursor: "pointer" }}>Privacy</button> ·{" "}
              <button type="button" onClick={() => setInfo(info === "support" ? null : "support")} aria-expanded={info === "support"} style={{ background: "none", border: "none", padding: 0, font: "inherit", fontSize: 12, color: color.primary, cursor: "pointer" }}>Support</button>
            </div>
            {info === "support" && (
              <div style={{ marginTop: 6, fontSize: 11.5, color: color.textMuted, lineHeight: 1.5, maxWidth: 340, marginInline: "auto" }}>
                Need help? Email{" "}
                <a href="mailto:ServiceDesk@Birgma.com" style={{ color: color.primary }}>ServiceDesk@Birgma.com</a>{" "}or{" "}
                <a href="mailto:Helpdesk@biltema.com" style={{ color: color.primary }}>Helpdesk@biltema.com</a>.
              </div>
            )}
            {info === "privacy" && (
              <div style={{ marginTop: 6, fontSize: 11.5, color: color.textMuted, lineHeight: 1.5, maxWidth: 340, marginInline: "auto" }}>
                Atlas stores only the portfolio, resource and integration data your organisation configures, and applies GDPR data-subject and retention controls. Privacy questions:{" "}
                <a href="mailto:ServiceDesk@Birgma.com" style={{ color: color.primary }}>ServiceDesk@Birgma.com</a>.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
