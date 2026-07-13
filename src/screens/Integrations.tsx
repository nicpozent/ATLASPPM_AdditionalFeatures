import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font, radius } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { syncJira, syncToast } from "@/lib/jiraSync";
import { syncAdo, adoSyncToast } from "@/lib/adoSync";

// ---- Identity, email & directory (Microsoft 365) — persisted via /settings --
interface Identity { key: string; name: string; icon: string; detail: string; tint: string; ink: string }
const IDENTITY: Identity[] = [
  { key: "integration.sso", name: "Microsoft Entra ID — Single Sign-On", icon: "shield", detail: "SAML 2.0 / OIDC · enforce MFA for all members", tint: color.primaryTint2, ink: color.primary },
  { key: "integration.email", name: "Exchange Online — Email notifications", icon: "mail", detail: "Microsoft Graph · digest & alert delivery", tint: color.successTint, ink: color.successInk },
  { key: "integration.adsync", name: "Active Directory — Users & Groups sync", icon: "users", detail: "Enterprise Application · SCIM provisioning", tint: color.accentTint, ink: color.accent },
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
      <span style={{ position: "absolute", inset: 0, background: on ? color.success : color.border2, borderRadius: 20, transition: "background .15s" }} />
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, background: color.surface, borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left .15s" }} />
    </button>
  );
}

export default function Integrations() {
  const qc = useQueryClient();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<Record<string, string>> => (await api<Record<string, string>>("/settings")) ?? {},
  });
  const setSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      api(`/settings/${key}`, { method: "PATCH", body: JSON.stringify({ value: value ? "true" : "false" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  // Jira is a live connector (Phase 1: config + connection test, pull-only).
  const { data: jira } = useQuery({
    queryKey: ["jira-status"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ configured: boolean; baseUrl: string; canManage: boolean }> =>
      (await api<{ configured: boolean; baseUrl: string; canManage: boolean }>("/integrations/jira/status")) ?? { configured: false, baseUrl: "", canManage: false },
  });
  const testJira = useMutation({
    mutationFn: () => api<{ ok: boolean; displayName?: string; error?: string }>("/integrations/jira/test", { method: "POST" }),
    onSuccess: (r) => toast(r?.ok ? `Jira connected${r.displayName ? " as " + r.displayName : ""}.` : (r?.error ?? "Jira test failed."), r?.ok ? "info" : "error"),
    onError: (e) => toast((e as Error).message, "error"),
  });

  // Azure DevOps is a live connector scaffold (config + connection test +
  // discovery/import). Board sync is a follow-up (see ADR-0035).
  const { data: ado } = useQuery({
    queryKey: ["ado-status"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ configured: boolean; orgUrl: string; canManage: boolean }> =>
      (await api<{ configured: boolean; orgUrl: string; canManage: boolean }>("/integrations/ado/status")) ?? { configured: false, orgUrl: "", canManage: false },
  });
  const testAdo = useMutation({
    mutationFn: () => api<{ ok: boolean; orgUrl?: string; error?: string }>("/integrations/ado/test", { method: "POST" }),
    onSuccess: (r) => toast(r?.ok ? `Azure DevOps connected${r.orgUrl ? " · " + r.orgUrl : ""}.` : (r?.error ?? "Azure DevOps test failed."), r?.ok ? "info" : "error"),
    onError: (e) => toast((e as Error).message, "error"),
  });
  // Pull every ADO-mapped project's work items → tasks/epics/sprints in one pass.
  // Runs in the background (202 + jobId polling) so a large org can't 504 (ADR-0039).
  const syncAllAdo = useMutation({
    mutationFn: (delta: boolean) => syncAdo("/integrations/ado/sync", delta),
    onSuccess: (o) => { toast(adoSyncToast(o), o.ok || o.state === "running" ? "info" : "error"); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e) => toast((e as Error).message, "error"),
  });
  // Pull every mapped project from Jira in one pass — runs in the background so a
  // large portfolio-wide sync can't 504 the request (see syncJira/ADR-0030).
  const syncAll = useMutation({
    mutationFn: () => syncJira("/integrations/jira/sync", false),
    onSuccess: (o) => toast(syncToast(o), o.ok || o.state === "running" ? "info" : "error"),
    onError: (e) => toast((e as Error).message, "error"),
  });

  // Microsoft Teams is a live connector: a channel webhook turns every Atlas
  // notification into an Adaptive Card in a Teams channel (ADR-0060). The raw
  // webhook URL is never returned — status carries only a masked host + flags.
  const { data: teams } = useQuery({
    queryKey: ["teams-status"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ configured: boolean; enabled: boolean; host: string; canManage: boolean }> =>
      (await api<{ configured: boolean; enabled: boolean; host: string; canManage: boolean }>("/integrations/teams/status")) ?? { configured: false, enabled: false, host: "", canManage: false },
  });
  const testTeams = useMutation({
    mutationFn: () => api<{ ok: boolean; error?: string }>("/integrations/teams/test", { method: "POST" }),
    onSuccess: (r) => toast(r?.ok ? "Test posted to the Teams channel." : (r?.error ?? "Teams test failed."), r?.ok ? "info" : "error"),
    onError: (e) => toast((e as Error).message, "error"),
  });
  const [configuringTeams, setConfiguringTeams] = useState(false);

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* Identity & platform */}
      <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 13 }}>Identity, email &amp; directory · Microsoft 365</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 30 }}>
        {IDENTITY.map((x) => {
          const on = settings[x.key] === "true";
          return (
            <div key={x.name} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: 19 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: x.tint, color: x.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={x.icon} size={20} />
                </div>
                <Toggle on={on} onClick={() => setSetting.mutate({ key: x.key, value: !on })} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: color.ink, marginBottom: 6, lineHeight: 1.3 }}>{x.name}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: color.faint }}>{x.detail}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? color.success : color.border2 }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: on ? "#0B6B37" : color.faint }}>{on ? "Enabled" : "Not configured"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Governance — personnel-data processing gate (SWOT & development plans) */}
      <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 13 }}>Governance</div>
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: 19, marginBottom: 30, maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: color.ink, marginBottom: 6 }}>Personnel-data processing — Team SWOT &amp; development plans</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: color.faint }}>Manager assessment features on <b>My Team</b>. These process sensitive employee personal data, so they stay <b>off</b> until your data-processing sign-off (DPIA + MBL §11 union negotiation). See <b>docs/compliance-sweden.md</b>.</div>
          </div>
          <Toggle on={settings["personnel.assessmentsEnabled"] === "true"} onClick={() => setSetting.mutate({ key: "personnel.assessmentsEnabled", value: settings["personnel.assessmentsEnabled"] !== "true" })} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: settings["personnel.assessmentsEnabled"] === "true" ? color.success : color.border2 }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: settings["personnel.assessmentsEnabled"] === "true" ? "#0B6B37" : color.faint }}>{settings["personnel.assessmentsEnabled"] === "true" ? "Enabled" : "Disabled — pending data-processing approval"}</span>
        </div>
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
          // Jira is wired to the real backend (config status + live test); the
          // rest remain cosmetic connector chrome until each is built.
          if (a.name === "Jira") {
            const configured = !!jira?.configured;
            const detail = configured && jira?.baseUrl ? jira.baseUrl : a.detail;
            return (
              <div key={a.name} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: a.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontFamily: font.head, fontSize: 15, fontWeight: 700 }}>{a.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: color.faint2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: configured ? "#0B6B37" : color.subtle, background: configured ? color.successTint : color.neutralTint, padding: "3px 10px", borderRadius: 20 }}>{configured ? "Configured" : "Not configured"}</span>
                  <button
                    onClick={() => testJira.mutate()}
                    disabled={testJira.isPending || !jira?.canManage}
                    title={jira?.canManage ? (configured ? "Verify the Jira credentials" : "Set Jira credentials in config, then test") : "Needs Edit on Integrations & connectors"}
                    style={{ fontSize: 12, fontWeight: 600, color: color.primary, background: color.surface, border: `1px solid ${color.primaryTint2}`, padding: "7px 12px", borderRadius: 8, cursor: testJira.isPending || !jira?.canManage ? "not-allowed" : "pointer", opacity: testJira.isPending || !jira?.canManage ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}
                  >{testJira.isPending ? "Testing…" : "Test connection"}</button>
                  {configured && (
                    <button
                      onClick={() => syncAll.mutate()}
                      disabled={syncAll.isPending || !jira?.canManage}
                      title={jira?.canManage ? "Pull all Jira-mapped projects (map a project's Jira key & board id in its details)" : "Needs Edit on Integrations & connectors"}
                      style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "7px 12px", borderRadius: 8, cursor: syncAll.isPending || !jira?.canManage ? "not-allowed" : "pointer", opacity: syncAll.isPending || !jira?.canManage ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}
                    >{syncAll.isPending ? "Syncing…" : "Sync now"}</button>
                  )}
                </div>
              </div>
            );
          }
          // Azure DevOps is wired to the real backend (config status + live test);
          // discovery & import follow below. Board sync is a follow-up (ADR-0035).
          if (a.name === "Azure DevOps") {
            const configured = !!ado?.configured;
            const detail = configured && ado?.orgUrl ? ado.orgUrl : a.detail;
            return (
              <div key={a.name} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: a.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontFamily: font.head, fontSize: 15, fontWeight: 700 }}>{a.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: color.faint2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: configured ? "#0B6B37" : color.subtle, background: configured ? color.successTint : color.neutralTint, padding: "3px 10px", borderRadius: 20 }}>{configured ? "Configured" : "Not configured"}</span>
                  <button
                    onClick={() => testAdo.mutate()}
                    disabled={testAdo.isPending || !ado?.canManage}
                    title={ado?.canManage ? (configured ? "Verify the Azure DevOps organisation & PAT" : "Set AzureDevOps:Organization and AzureDevOps:Pat in config, then test") : "Needs Edit on Integrations & connectors"}
                    style={{ fontSize: 12, fontWeight: 600, color: color.primary, background: color.surface, border: `1px solid ${color.primaryTint2}`, padding: "7px 12px", borderRadius: 8, cursor: testAdo.isPending || !ado?.canManage ? "not-allowed" : "pointer", opacity: testAdo.isPending || !ado?.canManage ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}
                  >{testAdo.isPending ? "Testing…" : "Test connection"}</button>
                  {configured && (
                    <>
                      <button
                        onClick={() => syncAllAdo.mutate(true)}
                        disabled={syncAllAdo.isPending || !ado?.canManage}
                        title={ado?.canManage ? "Pull only work items changed since the last sync (faster)" : "Needs Edit on Integrations & connectors"}
                        style={{ fontSize: 12, fontWeight: 600, color: color.primary, background: color.surface, border: `1px solid ${color.primaryTint2}`, padding: "7px 12px", borderRadius: 8, cursor: syncAllAdo.isPending || !ado?.canManage ? "not-allowed" : "pointer", opacity: syncAllAdo.isPending || !ado?.canManage ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}
                      >Incremental</button>
                      <button
                        onClick={() => syncAllAdo.mutate(false)}
                        disabled={syncAllAdo.isPending || !ado?.canManage}
                        title={ado?.canManage ? "Full pull of all Azure DevOps-mapped projects (map a project from Discover below, or in its details)" : "Needs Edit on Integrations & connectors"}
                        style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "7px 12px", borderRadius: 8, cursor: syncAllAdo.isPending || !ado?.canManage ? "not-allowed" : "pointer", opacity: syncAllAdo.isPending || !ado?.canManage ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}
                      >{syncAllAdo.isPending ? "Syncing…" : "Sync now"}</button>
                    </>
                  )}
                </div>
              </div>
            );
          }
          // Microsoft Teams is wired to the real backend (channel webhook config
          // + live test). Configured ⇒ notifications post as Adaptive Cards.
          if (a.name === "Microsoft Teams") {
            const configured = !!teams?.configured;
            const live = configured && !!teams?.enabled;
            const detail = configured && teams?.host ? `Channel webhook · ${teams.host}` : a.detail;
            return (
              <div key={a.name} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: a.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontFamily: font.head, fontSize: 15, fontWeight: 700 }}>{a.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: color.faint2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: live ? "#0B6B37" : color.subtle, background: live ? color.successTint : color.neutralTint, padding: "3px 10px", borderRadius: 20 }}>{live ? "Connected" : configured ? "Muted" : "Not connected"}</span>
                  <button
                    onClick={() => teams?.canManage && setConfiguringTeams(true)}
                    disabled={!teams?.canManage}
                    title={teams?.canManage ? "Set the Teams channel webhook & delivery" : "Needs Edit on Integrations & connectors"}
                    style={{ fontSize: 12, fontWeight: 600, color: color.primary, background: color.surface, border: `1px solid ${color.primaryTint2}`, padding: "7px 12px", borderRadius: 8, cursor: teams?.canManage ? "pointer" : "not-allowed", opacity: teams?.canManage ? 1 : 0.6, fontFamily: "inherit", whiteSpace: "nowrap" }}
                  >Configure</button>
                  {configured && (
                    <button
                      onClick={() => testTeams.mutate()}
                      disabled={testTeams.isPending || !teams?.canManage}
                      title={teams?.canManage ? "Post a test card to the channel" : "Needs Edit on Integrations & connectors"}
                      style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "7px 12px", borderRadius: 8, cursor: testTeams.isPending || !teams?.canManage ? "not-allowed" : "pointer", opacity: testTeams.isPending || !teams?.canManage ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}
                    >{testTeams.isPending ? "Sending…" : "Send test"}</button>
                  )}
                </div>
              </div>
            );
          }
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
                <span style={{ fontSize: 11, fontWeight: 700, color: on ? "#0B6B37" : color.subtle, background: on ? color.successTint : color.neutralTint, padding: "3px 10px", borderRadius: 20 }}>{on ? "Connected" : "Not connected"}</span>
                <button
                  onClick={toggle}
                  style={{ fontSize: 12, fontWeight: 600, color: on ? color.textMuted : color.primary, background: color.surface, border: `1px solid ${on ? color.border2 : color.primaryTint2}`, padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >{on ? "Disconnect" : "Connect"}</button>
              </div>
            </div>
          );
        })}
      </div>

      {jira?.configured && <DiscoverJira />}
      {ado?.configured && <DiscoverAdo />}

      {configuringTeams && (
        <ConfigureTeamsModal
          enabled={!!teams?.enabled}
          configured={!!teams?.configured}
          onClose={() => setConfiguringTeams(false)}
          onDone={() => { setConfiguringTeams(false); qc.invalidateQueries({ queryKey: ["teams-status"] }); }}
        />
      )}
    </div>
  );
}

// ---- Microsoft Teams channel configuration (ADR-0060) ----------------------
function ConfigureTeamsModal({ enabled, configured, onClose, onDone }: { enabled: boolean; configured: boolean; onClose: () => void; onDone: () => void }) {
  // The webhook URL is write-only — the server never returns it — so the field
  // starts blank: leave it empty to keep the stored URL, or paste a new one.
  const [webhook, setWebhook] = useState("");
  // Default delivery ON for a first-time setup so paste-and-save just works;
  // for an already-configured channel, reflect its current state.
  const [on, setOn] = useState(configured ? enabled : true);

  const save = useMutation({
    mutationFn: () => api("/integrations/teams/config", {
      method: "POST",
      body: JSON.stringify({
        // Only send the URL when the user typed one (blank ⇒ leave unchanged).
        ...(webhook.trim() ? { webhookUrl: webhook.trim() } : {}),
        enabled: on,
      }),
    }),
    onSuccess: () => { toast("Teams channel saved.", "info"); onDone(); },
    onError: (e) => toast((e as Error).message, "error"),
  });
  const clear = useMutation({
    mutationFn: () => api("/integrations/teams/config", { method: "POST", body: JSON.stringify({ webhookUrl: "" }) }),
    onSuccess: () => { toast("Teams channel disconnected.", "info"); onDone(); },
    onError: (e) => toast((e as Error).message, "error"),
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,22,60,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: color.surface, borderRadius: 14, padding: 22, width: 480, maxWidth: "92vw" }}>
        <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, marginBottom: 4 }}>Microsoft Teams channel</div>
        <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 16 }}>Post every Atlas notification to a Teams channel as an Adaptive Card.</div>

        <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>Incoming webhook URL</div>
        <input
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
          type="url"
          placeholder={configured ? "•••••••• (leave blank to keep current)" : "https://…/workflows/…"}
          aria-label="Teams incoming webhook URL"
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${color.border}`, fontSize: 13, fontFamily: "inherit" }}
        />
        <div style={{ fontSize: 11, color: color.faint3, marginTop: 5, lineHeight: 1.5 }}>
          In Teams, add <b>Workflows → “Post to a channel when a webhook request is received”</b> to the target channel and paste the generated URL here. See <b>docs/teams-setup.md</b>.
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, cursor: "pointer" }}>
          <Toggle on={on} onClick={() => setOn((v) => !v)} />
          <span style={{ fontSize: 13, color: color.text }}>Deliver notifications to this channel</span>
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}>
          {configured && (
            <button onClick={() => clear.mutate()} disabled={clear.isPending} style={{ fontSize: 13, fontWeight: 600, color: color.dangerInk, background: color.surface, border: `1px solid ${color.border2}`, padding: "9px 15px", borderRadius: 9, cursor: clear.isPending ? "not-allowed" : "pointer", fontFamily: "inherit", marginRight: "auto" }}>{clear.isPending ? "Disconnecting…" : "Disconnect"}</button>
          )}
          <div style={{ flex: configured ? "none" : 1 }} />
          <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: color.textMuted, background: color.surface, border: `1px solid ${color.border2}`, padding: "9px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending || (!configured && !webhook.trim())} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "9px 15px", borderRadius: 9, cursor: save.isPending || (!configured && !webhook.trim()) ? "not-allowed" : "pointer", opacity: save.isPending || (!configured && !webhook.trim()) ? 0.6 : 1, fontFamily: "inherit" }}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ---- Jira project discovery & import ---------------------------------------
interface JiraProj { key: string; name: string; jiraId: string; mappedProjectId: string | null; mappedProjectName: string | null; mappedBoardId: number | null; }
interface Opt { id: string; name: string; }

function DiscoverJira() {
  const qc = useQueryClient();
  const [importing, setImporting] = useState<JiraProj | null>(null);
  const { data } = useQuery({
    queryKey: ["jira-projects"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ configured: boolean; canManage: boolean; projects: JiraProj[]; error?: string }> =>
      (await api<{ configured: boolean; canManage: boolean; projects: JiraProj[] }>("/integrations/jira/projects")) ?? { configured: false, canManage: false, projects: [] },
  });
  const projects = data?.projects ?? [];
  const canManage = data?.canManage ?? false;

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 13 }}>Discover from Jira</div>
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", fontSize: 12.5, color: color.faint2, borderBottom: `1px solid ${color.border}` }}>
          Every project in your Jira site. Import one to create — or link — an Atlas project (optionally under a program); it stays editable from the project's details.
        </div>
        {data?.error ? (
          <div style={{ padding: "18px", fontSize: 13, color: color.dangerInk }}>{data.error}</div>
        ) : projects.length === 0 ? (
          <div style={{ padding: "26px 18px", fontSize: 13, color: color.faint3, textAlign: "center" }}>No Jira projects returned. Check the service account's Browse Projects permission.</div>
        ) : projects.map((p) => (
          <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
            <span style={{ fontFamily: font.mono, fontSize: 11.5, fontWeight: 700, color: "#0052CC", background: color.primaryTint2, padding: "3px 9px", borderRadius: 6, flex: "none" }}>{p.key}</span>
            <span style={{ flex: 1, fontSize: 13.5, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
            {p.mappedProjectId ? (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: color.successInk, background: color.successTint, padding: "4px 11px", borderRadius: 20 }}>Mapped → {p.mappedProjectName}</span>
            ) : (
              <button onClick={() => setImporting(p)} disabled={!canManage} title={canManage ? "Import & map this Jira project" : "Needs Full on Projects & tasks (Platform Admin / PMO / PM)"}
                style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "7px 14px", borderRadius: 8, cursor: canManage ? "pointer" : "not-allowed", opacity: canManage ? 1 : 0.6, fontFamily: "inherit", flex: "none" }}>Import</button>
            )}
          </div>
        ))}
      </div>
      {importing && <ImportJiraModal proj={importing} onClose={() => setImporting(null)} onDone={() => { setImporting(null); qc.invalidateQueries({ queryKey: ["jira-projects"] }); qc.invalidateQueries({ queryKey: ["projects"] }); qc.invalidateQueries({ queryKey: ["programs"] }); qc.invalidateQueries({ queryKey: ["ops"] }); }} />}
    </div>
  );
}

function ImportJiraModal({ proj, onClose, onDone }: { proj: JiraProj; onClose: () => void; onDone: () => void }) {
  const [target, setTarget] = useState<"new" | "existing" | "program" | "ops">("new");
  const [board, setBoard] = useState("");
  const [atlasId, setAtlasId] = useState("");
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], retry: false, staleTime: 30_000, queryFn: async (): Promise<Opt[]> => (await api<Opt[]>("/projects")) ?? [] });
  const { data: programs = [] } = useQuery({ queryKey: ["programs"], retry: false, staleTime: 30_000, queryFn: async (): Promise<Opt[]> => (await api<Opt[]>("/programs")) ?? [] });

  const doImport = useMutation({
    mutationFn: () => api("/integrations/jira/import", {
      method: "POST",
      body: JSON.stringify({
        jiraProjectKey: proj.key, name: proj.name,
        boardId: Number(board) || 0,
        target: target === "program" ? "program" : target === "ops" ? "ops" : "project",
        atlasId: target === "existing" || target === "program" ? atlasId : null,
      }),
    }),
    onSuccess: () => { toast(target === "ops" ? `Imported ${proj.key} as an Ops service.` : `Imported ${proj.key} into Atlas.`, "info"); onDone(); },
    onError: (e) => toast((e as Error).message, "error"),
  });
  const needsPick = target === "existing" || target === "program";
  const opts = target === "program" ? programs : projects;
  const valid = !needsPick || !!atlasId;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,22,60,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: color.surface, borderRadius: 14, padding: 22, width: 460, maxWidth: "92vw" }}>
        <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, marginBottom: 4 }}>Import {proj.key}</div>
        <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 16 }}>{proj.name}</div>

        <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 6 }}>Map to</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
          {([["new", "A new Atlas project"], ["existing", "An existing project"], ["program", "A new project under a program"], ["ops", "A new Ops service (run-the-business)"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => { setTarget(v); setAtlasId(""); }} style={{ display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: target === v ? color.primaryTint : color.surfaceAlt, border: `1px solid ${target === v ? color.primaryTint2 : color.border}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, color: color.text }}>
              <span style={{ width: 15, height: 15, borderRadius: "50%", border: `2px solid ${target === v ? color.primary : color.border2}`, background: target === v ? color.primary : "#fff", flex: "none" }} />
              {label}
            </button>
          ))}
        </div>

        {needsPick && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>{target === "program" ? "Program" : "Project"}</div>
            <select value={atlasId} onChange={(e) => setAtlasId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${color.border}`, fontSize: 13, fontFamily: "inherit" }}>
              <option value="">{opts.length ? "— Select —" : (target === "program" ? "No programs yet" : "No projects yet")}</option>
              {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        {target === "ops" ? (
          <div style={{ fontSize: 11.5, color: color.faint3, marginBottom: 4 }}>Creates (or updates) an Ops service mapped to <b>{proj.key}</b> and pulls its issues in as work items. Re-sync anytime from the Ops board.</div>
        ) : (
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>Jira board id (optional)</div>
            <input value={board} onChange={(e) => setBoard(e.target.value)} type="number" placeholder="e.g. 93" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${color.border}`, fontSize: 13, fontFamily: "inherit" }} />
            <div style={{ fontSize: 11, color: color.faint3, marginTop: 5 }}>Needed to sync sprints & backlog. Find it in the board URL: …/boards/<b>93</b>/…. You can set it later in the project's details.</div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: color.textMuted, background: color.surface, border: `1px solid ${color.border2}`, padding: "9px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => valid && doImport.mutate()} disabled={!valid || doImport.isPending} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "9px 15px", borderRadius: 9, cursor: valid && !doImport.isPending ? "pointer" : "not-allowed", opacity: valid && !doImport.isPending ? 1 : 0.6, fontFamily: "inherit" }}>{doImport.isPending ? "Importing…" : "Import"}</button>
        </div>
      </div>
    </div>
  );
}

// ---- Azure DevOps project discovery & import (scaffold, ADR-0035) ----------
interface AdoProj { id: string; name: string; state: string; mappedProjectId: string | null; mappedProjectName: string | null; }

function DiscoverAdo() {
  const qc = useQueryClient();
  const [importing, setImporting] = useState<AdoProj | null>(null);
  const { data } = useQuery({
    queryKey: ["ado-projects"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ configured: boolean; canManage: boolean; projects: AdoProj[]; error?: string }> =>
      (await api<{ configured: boolean; canManage: boolean; projects: AdoProj[] }>("/integrations/ado/projects")) ?? { configured: false, canManage: false, projects: [] },
  });
  const projects = data?.projects ?? [];
  const canManage = data?.canManage ?? false;

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 13 }}>Discover from Azure DevOps</div>
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", fontSize: 12.5, color: color.faint2, borderBottom: `1px solid ${color.border}` }}>
          Every project in your Azure DevOps organisation. Import one to create — or link — an Atlas project (optionally under a program); it stays editable from the project's details. Board &amp; work-item sync is a follow-up.
        </div>
        {data?.error ? (
          <div style={{ padding: "18px", fontSize: 13, color: color.dangerInk }}>{data.error}</div>
        ) : projects.length === 0 ? (
          <div style={{ padding: "26px 18px", fontSize: 13, color: color.faint3, textAlign: "center" }}>No Azure DevOps projects returned. Check the PAT's Project &amp; Team (Read) scope.</div>
        ) : projects.map((p) => (
          <div key={p.id || p.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
            <span style={{ fontFamily: font.mono, fontSize: 11.5, fontWeight: 700, color: "#0078D7", background: color.primaryTint2, padding: "3px 9px", borderRadius: 6, flex: "none" }}>AZ</span>
            <span style={{ flex: 1, fontSize: 13.5, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
            {p.mappedProjectId ? (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: color.successInk, background: color.successTint, padding: "4px 11px", borderRadius: 20 }}>Mapped → {p.mappedProjectName}</span>
            ) : (
              <button onClick={() => setImporting(p)} disabled={!canManage} title={canManage ? "Import & map this Azure DevOps project" : "Needs Full on Projects & tasks (Platform Admin / PMO / PM)"}
                style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "7px 14px", borderRadius: 8, cursor: canManage ? "pointer" : "not-allowed", opacity: canManage ? 1 : 0.6, fontFamily: "inherit", flex: "none" }}>Import</button>
            )}
          </div>
        ))}
      </div>
      {importing && <ImportAdoModal proj={importing} onClose={() => setImporting(null)} onDone={() => { setImporting(null); qc.invalidateQueries({ queryKey: ["ado-projects"] }); qc.invalidateQueries({ queryKey: ["projects"] }); qc.invalidateQueries({ queryKey: ["programs"] }); }} />}
    </div>
  );
}

function ImportAdoModal({ proj, onClose, onDone }: { proj: AdoProj; onClose: () => void; onDone: () => void }) {
  const [target, setTarget] = useState<"new" | "existing" | "program">("new");
  const [atlasId, setAtlasId] = useState("");
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], retry: false, staleTime: 30_000, queryFn: async (): Promise<Opt[]> => (await api<Opt[]>("/projects")) ?? [] });
  const { data: programs = [] } = useQuery({ queryKey: ["programs"], retry: false, staleTime: 30_000, queryFn: async (): Promise<Opt[]> => (await api<Opt[]>("/programs")) ?? [] });

  const doImport = useMutation({
    mutationFn: () => api("/integrations/ado/import", {
      method: "POST",
      body: JSON.stringify({
        adoProject: proj.name, name: proj.name,
        target: target === "program" ? "program" : "project",
        atlasId: target === "existing" || target === "program" ? atlasId : null,
      }),
    }),
    onSuccess: () => { toast(`Imported ${proj.name} into Atlas.`, "info"); onDone(); },
    onError: (e) => toast((e as Error).message, "error"),
  });
  const needsPick = target === "existing" || target === "program";
  const opts = target === "program" ? programs : projects;
  const valid = !needsPick || !!atlasId;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,22,60,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: color.surface, borderRadius: 14, padding: 22, width: 460, maxWidth: "92vw" }}>
        <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, marginBottom: 4 }}>Import {proj.name}</div>
        <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 16 }}>Azure DevOps project</div>

        <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 6 }}>Map to</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
          {([["new", "A new Atlas project"], ["existing", "An existing project"], ["program", "A new project under a program"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => { setTarget(v); setAtlasId(""); }} style={{ display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: target === v ? color.primaryTint : color.surfaceAlt, border: `1px solid ${target === v ? color.primaryTint2 : color.border}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, color: color.text }}>
              <span style={{ width: 15, height: 15, borderRadius: "50%", border: `2px solid ${target === v ? color.primary : color.border2}`, background: target === v ? color.primary : "#fff", flex: "none" }} />
              {label}
            </button>
          ))}
        </div>

        {needsPick && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>{target === "program" ? "Program" : "Project"}</div>
            <select aria-label={target === "program" ? "Program to place the new project under" : "Existing project to link"} value={atlasId} onChange={(e) => setAtlasId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${color.border}`, fontSize: 13, fontFamily: "inherit" }}>
              <option value="">{opts.length ? "— Select —" : (target === "program" ? "No programs yet" : "No projects yet")}</option>
              {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: color.faint3, marginBottom: 4 }}>Stores the mapping to <b>{proj.name}</b> on the Atlas project. Board &amp; work-item sync is a follow-up (see the connector docs).</div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: color.textMuted, background: color.surface, border: `1px solid ${color.border2}`, padding: "9px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => valid && doImport.mutate()} disabled={!valid || doImport.isPending} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "9px 15px", borderRadius: 9, cursor: valid && !doImport.isPending ? "pointer" : "not-allowed", opacity: valid && !doImport.isPending ? 1 : 0.6, fontFamily: "inherit" }}>{doImport.isPending ? "Importing…" : "Import"}</button>
        </div>
      </div>
    </div>
  );
}
