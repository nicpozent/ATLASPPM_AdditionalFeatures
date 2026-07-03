import { useState } from "react";
import { color, font, radius } from "@/theme";
import { Icon } from "@/components/Icon";

// ---- Identity, email & directory (Microsoft 365) — structural sections ----
interface Identity { name: string; icon: string; detail: string; tint: string; ink: string }
const IDENTITY: Identity[] = [
  { name: "Microsoft Entra ID — Single Sign-On", icon: "shield", detail: "SAML 2.0 / OIDC · enforce MFA for all members", tint: "#E6EFFB", ink: color.primary },
  { name: "Exchange Online — Email notifications", icon: "mail", detail: "Microsoft Graph · digest & alert delivery", tint: "#E7F4EC", ink: "#0B6B37" },
  { name: "Active Directory — Users & Groups sync", icon: "users", detail: "Enterprise Application · SCIM provisioning", tint: color.accentTint, ink: color.accent },
];

// ---- Connector catalogue — structural chrome (render all; "Not connected" by default) ----
interface App { name: string; brand: string; initials: string; detail: string }
const APPS: App[] = [
  { name: "Jira", brand: "#0052CC", initials: "JR", detail: "Issues, boards & 2-way sync" },
  { name: "ServiceNow", brand: "#1B3B3A", initials: "SN", detail: "Incidents & changes" },
  { name: "ManageEngine ServiceDesk Plus", brand: "#C8202F", initials: "ME", detail: "Requests, problems & assets" },
  { name: "Azure DevOps", brand: "#0078D7", initials: "AZ", detail: "Repos, boards & pipelines" },
  { name: "GitHub", brand: "#181717", initials: "GH", detail: "Commits, PRs & Actions" },
  { name: "Confluence", brand: "#172B4D", initials: "CF", detail: "Linked spaces & documents" },
  { name: "Power BI", brand: "#E6A200", initials: "PB", detail: "Embedded portfolio dashboards" },
  { name: "Microsoft Teams", brand: "#6264A7", initials: "TM", detail: "Channel & chat notifications" },
  { name: "Slack", brand: "#4A154B", initials: "SL", detail: "Channel notifications & alerts" },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{ position: "relative", width: 42, height: 24, border: "none", padding: 0, cursor: "pointer", background: "transparent", flex: "none" }}
    >
      <span style={{ position: "absolute", inset: 0, background: on ? color.success : "#C7CEDB", borderRadius: 20, transition: "background .15s" }} />
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, background: "#fff", borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left .15s" }} />
    </button>
  );
}

export default function Integrations() {
  const [idOn, setIdOn] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* Identity & platform */}
      <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 13 }}>Identity, email &amp; directory · Microsoft 365</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 30 }}>
        {IDENTITY.map((x) => {
          const on = !!idOn[x.name];
          return (
            <div key={x.name} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: 19 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: x.tint, color: x.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={x.icon} size={20} />
                </div>
                <Toggle on={on} onClick={() => setIdOn((s) => ({ ...s, [x.name]: !s[x.name] }))} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: color.ink, marginBottom: 6, lineHeight: 1.3 }}>{x.name}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: color.faint }}>{x.detail}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? color.success : "#C7CEDB" }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: on ? "#0B6B37" : color.faint }}>{on ? "Enabled" : "Not configured"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connected apps */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: color.faint, letterSpacing: "0.07em", textTransform: "uppercase" }}>Connected tools &amp; data sources</span>
        <div style={{ flex: 1 }} />
        <button style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "9px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>
          <Icon name="plus" size={16} /> Add connector
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
        {APPS.map((a) => {
          const on = !!connected[a.name];
          const toggle = () => setConnected((s) => ({ ...s, [a.name]: !s[a.name] }));
          return (
            <div key={a.name} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: a.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontFamily: font.head, fontSize: 15, fontWeight: 700 }}>{a.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                <div style={{ fontSize: 12, color: color.faint2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.detail}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: on ? "#0B6B37" : "#566077", background: on ? "#E7F4EC" : "#EEF0F4", padding: "3px 10px", borderRadius: 20 }}>{on ? "Connected" : "Not connected"}</span>
                <button
                  onClick={toggle}
                  style={{ fontSize: 12, fontWeight: 600, color: on ? color.textMuted : color.primary, background: "#fff", border: `1px solid ${on ? color.border2 : "#CFE0F4"}`, padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >{on ? "Disconnect" : "Connect"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
