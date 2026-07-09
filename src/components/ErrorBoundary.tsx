import React from "react";
import { color, font } from "@/theme";

// Catches render-time crashes anywhere below it and shows a friendly full-page
// fallback (never a white screen). A client-side code is generated for the user
// to quote; the details go to the console for support.
interface State { error: Error | null; code: string; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, code: "" };

  static getDerivedStateFromError(error: Error): State {
    // APP- prefix marks a front-end (render) failure, distinct from server SRV-/INT-.
    const code = `APP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return { error, code };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[Atlas ${this.state.code}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: color.bg, fontFamily: font.body }}>
        <div style={{ maxWidth: 460, textAlign: "center", background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, padding: "36px 32px", boxShadow: "0 12px 40px rgba(20,26,60,0.12)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontFamily: font.head, fontSize: 19, fontWeight: 600, color: color.navy, marginBottom: 8 }}>This screen hit a snag</div>
          <div style={{ fontSize: 13.5, color: color.subtle, lineHeight: 1.5, marginBottom: 18 }}>
            Something went wrong displaying this page. Reloading usually fixes it. If it keeps happening, share this code with your administrator:
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 14, fontWeight: 700, color: color.textMuted, background: color.bg, border: `1px solid ${color.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 20, display: "inline-block" }}>{this.state.code}</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => window.location.reload()} style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontFamily: "inherit" }}>Reload</button>
            <a href="/help?code=APP" style={{ fontSize: 13.5, fontWeight: 600, color: color.textMuted, background: color.surface, border: `1px solid ${color.border2}`, borderRadius: 10, padding: "10px 18px", textDecoration: "none" }}>Troubleshooting</a>
          </div>
        </div>
      </div>
    );
  }
}
