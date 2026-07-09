import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font, radius } from "@/theme";
import { api, apiDownload } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Card, EmptyBlock, Input, Modal, Select, Textarea } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { useRole } from "@/components/RoleContext";
import { toast, toastError } from "@/components/Toast";
import { EVALUATION, USER_STORY_SECTIONS, USER_STORY_INTRO, SECURITY_POSTURE, type EvalDimension } from "@/data/adminDocs";

// ---------------------------------------------------------------------------
// Administration — built 1:1 from the prototype (design/Atlas PPM.dc.html,
// lines 2129-2430). The roles & permissions matrix and the install/integration
// setup guides are STRUCTURAL chrome (fixed platform documentation, not backend
// data) and are rendered in full. Everything that is genuinely data — provisioned
// users, stakeholder assignments, audit entries, deletion requests, archive,
// backup history — renders as the real layout with tasteful empty states.
// ---------------------------------------------------------------------------

const GRADIENT = "linear-gradient(115deg,#11163A,#0F6CBD)";

const ADMIN_TABS: { id: string; label: string; adminOnly?: boolean }[] = [
  { id: "roles", label: "Roles & Permissions" },
  { id: "users", label: "Users & Groups" },
  { id: "teams", label: "Teams" },
  { id: "stakeholders", label: "Stakeholders" },
  { id: "archive", label: "Archive & Deletions" },
  { id: "audit", label: "Audit Log" },
  { id: "privacy", label: "Data Privacy", adminOnly: true },
  { id: "backups", label: "Backups & Restore" },
  { id: "install", label: "Installation Guides" },
  { id: "integrations", label: "Integration Setup" },
  { id: "security", label: "Security Posture" },
  { id: "evaluation", label: "Application Evaluation" },
  { id: "userstories", label: "User Stories" },
];

// ---- Roles & permissions (data-driven; DB-backed matrix) ------------------
type PermLevel = "F" | "E" | "V" | "N";
interface Capability { key: string; label: string; }
interface RoleRow {
  id: string; name: string; short: string; who: string; description: string;
  icon: string; color: string; tint: string; isSystem: boolean;
  permissions: Record<string, PermLevel>;
}
interface RolesMatrix { capabilities: Capability[]; roles: RoleRow[]; canManage: boolean; }

// Permission legend — tinted cells per code (F Full, E Edit, V View, N None).
const PERM_LEGEND: Record<PermLevel, { label: string; cell: string; ink: string; tint: string }> = {
  F: { label: "F", cell: "#15A34A", ink: color.successInk, tint: color.successTint },
  E: { label: "E", cell: "#0F6CBD", ink: color.primaryDark, tint: color.primaryTint2 },
  V: { label: "V", cell: "#C98A00", ink: color.warningInk, tint: color.warningTint },
  N: { label: "—", cell: color.border2, ink: "#9AA2B4", tint: color.surfaceInput },
};
// Clicking a cell cycles through the levels (admins only).
const NEXT_LEVEL: Record<PermLevel, PermLevel> = { N: "V", V: "E", E: "F", F: "N" };
// Icons offered when creating a role — all exist in Icon.tsx.
const ROLE_ICONS = ["shield", "shieldUser", "userCheck", "users", "folder", "trendUp", "key", "lock", "star", "briefcase", "building", "target", "flag", "award"];
const ROLE_COLORS: [string, string][] = [
  ["#11163A", color.border3], ["#0F6CBD", color.primaryTint2], ["#7A3FB0", color.accentTint],
  ["#15A34A", color.successTint], ["#C98A00", color.warningTint], ["#0E7C7B", "#DEF2F1"], ["#B4232A", color.dangerTint],
];

type Guide = { id: string; name: string; sub: string; icon?: string; time?: string; brand?: string; initials?: string; steps: string[] };

const INSTALL_GUIDES: Guide[] = [
  { id: "app-server", name: "Application / Web tier", icon: "server", time: "~25 min", sub: "IIS / Kestrel on Windows Server or container", steps: ["Provision a host (Windows Server 2022 or Linux container, 4 vCPU / 16 GB RAM minimum).", "Install the .NET 8 hosting bundle and enable the web server role (IIS or reverse proxy of choice).", "Copy the Atlas application package to /opt/atlas (or C:\\Atlas) and unzip the release artifact.", "Create the appsettings.Production.json from the template and set the database connection string and base URL.", "Bind a TLS certificate (Let’s Encrypt or corporate CA) and force HTTPS.", "Start the Atlas service and confirm the health endpoint /healthz returns 200."] },
  { id: "database", name: "Database (SQL Server)", icon: "database", time: "~20 min", sub: "SQL Server 2019+ or Azure SQL", steps: ["Create an empty database named AtlasPPM with collation Latin1_General_100_CI_AS.", "Create a least-privilege SQL login for the app and grant db_owner on AtlasPPM only.", "Run the schema migration: atlas migrate --connection \"<conn>\" (applies all pending migrations).", "Seed reference data (methodologies, role definitions) with atlas seed.", "Enable nightly transaction-log backups and point-in-time recovery.", "Verify connectivity from the app tier using the built-in atlas db:test command."] },
  { id: "storage", name: "Artifact & file storage", icon: "server", time: "~10 min", sub: "Azure Blob / S3 / SMB share", steps: ["Create a private blob container or bucket named atlas-artifacts.", "Generate a scoped access key or managed identity for the application.", "Set Storage:Provider and the credentials in configuration.", "Configure lifecycle rules for the 90-day retention policy.", "Upload a test file via Settings → Storage → Test to confirm read/write."] },
  { id: "jobs", name: "Background jobs & scheduler", icon: "clock", time: "~10 min", sub: "Recurring sync, digests & backups", steps: ["Enable the Atlas worker service (atlas-worker) on the app host or a dedicated node.", "Confirm the worker shares the same database and storage configuration.", "Set the timezone for scheduled jobs (default Europe/Stockholm).", "Verify the scheduler dashboard lists email digest, integration sync and backup jobs.", "Trigger a test job to confirm execution and logging."] },
  { id: "sso", name: "Microsoft Entra ID — SSO", icon: "key", time: "~15 min", sub: "SAML 2.0 / OIDC app registration", steps: ["In Entra ID → App registrations, create “Atlas PPM”.", "Add the redirect URI https://atlas.yourco.com/signin-oidc.", "Create a client secret (or certificate) and copy the value.", "Add API permissions: openid, profile, email, User.Read.", "In Atlas → Settings → SSO, paste the Tenant ID, Client ID and secret; enable “Require SSO”.", "Test a sign-in with a pilot account, then enforce MFA via Conditional Access."] },
  { id: "mail", name: "Exchange Online — email (Graph)", icon: "mail", time: "~12 min", sub: "Notifications & digests via MS Graph", steps: ["Reuse the Entra app or create a dedicated one for mail.", "Grant the application permission Mail.Send (admin consent required).", "Designate a sender mailbox (e.g. atlas-noreply@yourco.com).", "In Atlas → Settings → Email, select Microsoft Graph and enter the app credentials.", "Send a test email and confirm delivery and branding (logo + footer)."] },
  { id: "adsync", name: "AD users & groups sync", icon: "users", time: "~15 min", sub: "Enterprise Application provisioning", steps: ["Create an Enterprise Application for Atlas and enable provisioning.", "Map AD security groups to Atlas roles (e.g. PMO-Leads → PMO Lead).", "Set provisioning scope to assigned users and groups.", "Provide the Atlas SCIM endpoint and bearer token in the provisioning settings.", "Run “Provision on demand” for a test user, then start the sync cycle.", "Confirm users and group memberships appear under Admin → Users."] },
  { id: "reporting", name: "Reporting / Power BI", icon: "trendUp", time: "~10 min", sub: "Embedded portfolio analytics", steps: ["Create a Power BI workspace and publish the Atlas dataset.", "Register a service principal with workspace access.", "Enter the workspace and report IDs in Atlas → Settings → Reporting.", "Validate the embedded report renders on the dashboard."] },
];

const INTEGRATION_GUIDES: Guide[] = [
  { id: "jira", name: "Jira", brand: "#0052CC", initials: "JR", sub: "2-way issue & epic sync", steps: ["In Jira → Apps → OAuth 2.0 (3LO), create an app and add the Atlas callback URL.", "Grant scopes read:jira-work and write:jira-work.", "In Atlas → Integrations → Jira, paste the Client ID and secret and authorise.", "Map Atlas projects to Jira projects and align statuses/fields.", "Choose sync direction (2-way) and conflict policy.", "Run an initial sync and verify issues appear under the linked project."] },
  { id: "snow", name: "ServiceNow", brand: "#1B3B3A", initials: "SN", sub: "Incidents & changes inbound", steps: ["Create an OAuth API endpoint (Application Registry) in ServiceNow.", "Create an integration user with itil and read access to the required tables.", "In Atlas → Integrations → ServiceNow, enter the instance URL and OAuth credentials.", "Select tables to ingest (incident, change_request) and map fields.", "Set the polling interval and enable the connector."] },
  { id: "me-sdp", name: "ManageEngine ServiceDesk Plus", brand: "#C8202F", initials: "ME", sub: "Requests, problems & assets", steps: ["In ServiceDesk Plus → Admin → API, generate a technician API key.", "Whitelist the Atlas server IP if API access is restricted.", "In Atlas → Integrations → ServiceDesk Plus, enter the base URL and API key.", "Map request/problem modules to Atlas demands and blockers.", "Test the connection and enable scheduled import."] },
  { id: "ado", name: "Azure DevOps", brand: "#0078D7", initials: "AZ", sub: "Boards, repos & pipelines", steps: ["Create a Personal Access Token (or use Entra app) with Work Items & Build read scopes.", "In Atlas → Integrations → Azure DevOps, enter the organisation URL and token.", "Select the projects and area paths to sync.", "Map work item types to Atlas epics/tasks.", "Enable the connector and run the first sync."] },
  { id: "github", name: "GitHub", brand: "#181717", initials: "GH", sub: "Issues, PRs & Actions", steps: ["Create a fine-grained PAT (or GitHub App) with Issues & Pull requests read access.", "In Atlas → Integrations → GitHub, enter owner/repo and the token.", "Choose which repositories to sync.", "Run the first sync and verify issues/PRs appear."] },
  { id: "confluence", name: "Confluence", brand: "#172B4D", initials: "CF", sub: "Spaces & documents", steps: ["Create an Atlassian API token for the integration account.", "In Atlas → Integrations → Confluence, enter the site URL, email and token.", "Select the spaces to index.", "Run the first sync to link pages."] },
  { id: "powerbi", name: "Power BI", brand: "#E6A200", initials: "PB", sub: "Embedded analytics", steps: ["Register an Entra app (service principal) and enable Power BI service permissions.", "Add the service principal to the Power BI workspace as a member.", "In Atlas → Integrations → Power BI, enter tenant, client id/secret and workspace id.", "Map report keys to report ids.", "Validate the embedded report renders on the dashboard."] },
  { id: "teams", name: "Microsoft Teams", brand: "#6264A7", initials: "TM", sub: "Channel notifications", steps: ["In the target Teams channel, add an Incoming Webhook connector.", "Copy the webhook URL.", "In Atlas → Integrations → Teams, paste the webhook URL.", "Send a test notification and confirm delivery."] },
  { id: "slack", name: "Slack", brand: "#4A154B", initials: "SL", sub: "Channel notifications", steps: ["Create a Slack app and enable Incoming Webhooks.", "Add a webhook to the target channel and copy the URL.", "In Atlas → Integrations → Slack, paste the webhook URL.", "Send a test message and confirm delivery."] },
];

const BACKUP_COLS = "1.8fr 1fr 0.8fr 0.7fr 0.9fr 1.1fr";

export default function Admin() {
  const [tab, setTab] = useState("roles");
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const { role } = useRole();
  // GDPR data-subject actions are Platform-Admin only on the API; hide the tab
  // for everyone else (cosmetic — the endpoints stay authoritative).
  const isPlatformAdmin = role === "admin";
  const tabs = ADMIN_TABS.filter((t) => !t.adminOnly || isPlatformAdmin);

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${color.border3}`, marginBottom: 22, overflowX: "auto" }}>
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 4px", margin: "0 18px 0 0", border: "none",
              borderBottom: active ? `2.5px solid ${color.primary}` : "2.5px solid transparent",
              background: "none", cursor: "pointer", fontSize: 14, fontWeight: active ? 700 : 500,
              color: active ? color.primary : color.subtle, fontFamily: "inherit", whiteSpace: "nowrap",
            }}>{t.label}</button>
          );
        })}
      </div>

      {tab === "roles" && <RolesSection />}
      {tab === "users" && <UsersSection />}
      {tab === "teams" && <TeamsSection />}
      {tab === "stakeholders" && <StakeholdersSection />}
      {tab === "archive" && <ArchiveSection />}
      {tab === "audit" && <AuditSection />}
      {tab === "privacy" && isPlatformAdmin && <PrivacySection />}
      {tab === "backups" && <BackupsSection />}
      {tab === "install" && <GuidesSection kind="install" openGuide={openGuide} setOpenGuide={setOpenGuide} />}
      {tab === "integrations" && <GuidesSection kind="int" openGuide={openGuide} setOpenGuide={setOpenGuide} />}
      {tab === "security" && <SecurityPostureSection />}
      {tab === "evaluation" && <EvaluationSection />}
      {tab === "userstories" && <UserStoriesSection />}
    </div>
  );
}

// ---- shared bits ----------------------------------------------------------
const sectionTitle: React.CSSProperties = { fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink };
const sectionSub: React.CSSProperties = { fontSize: 12, color: color.faint2, marginTop: 2 };
const colHeadStyle: React.CSSProperties = { fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 };

function TableCard({ title, subtitle, cols, headers, empty, rows }: {
  title: string; subtitle?: string; cols: string; headers: string[]; empty: string; rows?: (string | number)[][];
}) {
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}` }}>
        <div style={sectionTitle}>{title}</div>
        {subtitle && <div style={sectionSub}>{subtitle}</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: cols, padding: "11px 22px", borderBottom: `1px solid ${color.bg}`, ...colHeadStyle }}>
        {headers.map((h, i) => <div key={i} style={i === headers.length - 1 && headers.length > 3 ? {} : undefined}>{h}</div>)}
      </div>
      {!rows || rows.length === 0 ? (
        <EmptyBlock message={empty} />
      ) : rows.map((r, ri) => (
        <div key={ri} style={{ display: "grid", gridTemplateColumns: cols, padding: "12px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, fontSize: 12.5, color: color.text, alignItems: "center" }}>
          {r.map((cell, ci) => <div key={ci} style={{ color: ci === 0 ? color.text : color.subtle, fontWeight: ci === 0 ? 600 : 400 }}>{cell}</div>)}
        </div>
      ))}
    </Card>
  );
}

// ---- ROLES & PERMISSIONS --------------------------------------------------
function useRolesMatrix() {
  return useQuery({
    queryKey: ["roles"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<RolesMatrix> =>
      (await api<RolesMatrix>("/roles")) ?? { capabilities: [], roles: [], canManage: false },
  });
}

function RolesSection() {
  const { data } = useRolesMatrix();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const roles = data?.roles ?? [];
  const caps = data?.capabilities ?? [];
  const canManage = data?.canManage ?? false;

  const setCell = useMutation({
    mutationFn: (v: { roleId: string; capabilityKey: string; level: PermLevel }) =>
      api(`/roles/${v.roleId}/permissions`, { method: "PUT", body: JSON.stringify({ capabilityKey: v.capabilityKey, level: v.level }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  });
  const removeRole = useMutation({
    mutationFn: (id: string) => api(`/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  });

  const cols = `2fr repeat(${Math.max(roles.length, 1)},1fr)`;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 13, marginBottom: 22 }}>
        {roles.map((r) => (
          <div key={r.id} style={{ position: "relative", background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: 17 }}>
            {canManage && !r.isSystem && (
              <button type="button" title={`Delete ${r.name}`} aria-label={`Delete ${r.name}`}
                onClick={() => { if (confirm(`Delete the “${r.name}” role? This cannot be undone.`)) removeRole.mutate(r.id); }}
                style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "none", background: "transparent", color: color.faint2, cursor: "pointer", borderRadius: 7 }}>
                <Icon name="trash" size={14} />
              </button>
            )}
            <div style={{ width: 40, height: 40, borderRadius: radius.lg, background: r.tint, color: r.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Icon name={r.icon} size={20} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: color.ink, lineHeight: 1.25, marginBottom: 3 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: color.faint3, marginBottom: 9 }}>{r.who}{!r.isSystem && " · custom"}</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: color.subtle }}>{r.description}</div>
          </div>
        ))}
        {canManage && (
          <button type="button" onClick={() => setCreating(true)}
            style={{ background: color.surface, border: `1.5px dashed ${color.border2}`, borderRadius: radius.xl, padding: 17, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: color.primary, fontFamily: "inherit", minHeight: 120 }}>
            <Icon name="plus" size={22} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>New role</span>
          </button>
        )}
      </div>

      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "17px 22px 14px", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={sectionTitle}>Permission matrix</div>
            <div style={{ fontSize: 12, color: color.faint2 }}>
              {canManage ? "Click any cell to change what a role can do." : "What each role can do across the platform"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 13, fontSize: 11.5, color: color.faint }}>
            {[["Full", "#15A34A"], ["Edit", "#0F6CBD"], ["View", "#C98A00"], ["None", color.border2]].map(([label, c]) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: c }} />{label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: cols, padding: "0 22px 11px", borderBottom: `1px solid ${color.bg}`, ...colHeadStyle, letterSpacing: "0.04em" }}>
          <div>Capability</div>
          {roles.map((r) => <div key={r.id} style={{ textAlign: "center" }}>{r.short || r.name}</div>)}
        </div>
        {caps.length === 0 ? (
          <EmptyBlock message="No capabilities defined yet." />
        ) : caps.map((cap) => (
          <div key={cap.key} style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", padding: "11px 22px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: color.text }}>{cap.label}</div>
            {roles.map((r) => {
              const code = (r.permissions[cap.key] ?? "N") as PermLevel;
              const p = PERM_LEGEND[code];
              return (
                <div key={r.id} style={{ display: "flex", justifyContent: "center" }}>
                  <button type="button" disabled={!canManage || setCell.isPending}
                    title={canManage ? `${r.name} · ${cap.label} — click to change` : undefined}
                    aria-label={`${r.name} ${cap.label}: ${code}`}
                    onClick={() => canManage && setCell.mutate({ roleId: r.id, capabilityKey: cap.key, level: NEXT_LEVEL[code] })}
                    style={{ minWidth: 46, textAlign: "center", fontSize: 11.5, fontWeight: 700, color: p.ink, background: p.tint, padding: "4px 0", borderRadius: 8, border: "none", fontFamily: "inherit", cursor: canManage ? "pointer" : "default" }}>
                    {p.label}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      {creating && <NewRoleModal onClose={() => setCreating(false)} />}
    </>
  );
}

function NewRoleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [who, setWho] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(ROLE_ICONS[0]);
  const [palette, setPalette] = useState(0);

  const create = useMutation({
    mutationFn: () => api("/roles", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), who: who.trim(), description: description.trim(), icon, color: ROLE_COLORS[palette][0], tint: ROLE_COLORS[palette][1] }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); onClose(); },
  });

  const submit = () => { if (name.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={480} label="Add a role">
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>
        Create a role and set its access in the matrix. New roles start with no permissions.
        A matching app role must also be added in the Entra app registration for SSO sign-ins to carry it.
      </div>
      <label style={labelStyle}>Role name</label>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Security Officer" style={{ marginBottom: 13 }} />
      <label style={labelStyle}>Who it's for</label>
      <Input value={who} onChange={(e) => setWho(e.target.value)} placeholder="e.g. Risk & compliance" style={{ marginBottom: 13 }} />
      <label style={labelStyle}>Description</label>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is responsible for" style={{ minHeight: 64, resize: "vertical", marginBottom: 13 }} />
      <label style={labelStyle}>Icon</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 13 }}>
        {ROLE_ICONS.map((ic) => (
          <button key={ic} type="button" onClick={() => setIcon(ic)} aria-label={ic} aria-pressed={icon === ic}
            style={{ width: 38, height: 38, borderRadius: radius.lg, border: `1.5px solid ${icon === ic ? color.primary : color.border2}`, background: icon === ic ? color.primaryTint : color.surface, color: icon === ic ? color.primary : color.subtle, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Icon name={ic} size={18} />
          </button>
        ))}
      </div>
      <label style={labelStyle}>Colour</label>
      <div style={{ display: "flex", gap: 8 }}>
        {ROLE_COLORS.map(([c, t], i) => (
          <button key={c} type="button" onClick={() => setPalette(i)} aria-label={`Colour ${i + 1}`} aria-pressed={palette === i}
            style={{ width: 34, height: 34, borderRadius: radius.lg, border: `2px solid ${palette === i ? color.ink : "transparent"}`, background: t, color: c, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <span style={{ width: 14, height: 14, borderRadius: 5, background: c }} />
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !name.trim()}>{create.isPending ? "Creating…" : "Create role"}</Button>
      </div>
    </Modal>
  );
}

// ---- USERS & GROUPS -------------------------------------------------------
interface DirTeamManager { key: string; label: string; }
interface DirTeamGroup { id: string; displayName: string; managerKey: string; lastSynced: string; memberCount: number; }
interface DirTeamsAdmin { canManage: boolean; graphConfigured: boolean; managers: DirTeamManager[]; groups: DirTeamGroup[]; }
interface ProvisionedUser { name: string; email: string; group: string; role: string; status: string; }

function UsersSection() {
  const qc = useQueryClient();
  const { data: admin } = useQuery({
    queryKey: ["teams-admin"], retry: false, staleTime: 15_000,
    queryFn: async (): Promise<DirTeamsAdmin> => (await api<DirTeamsAdmin>("/teams/admin")) ?? { canManage: false, graphConfigured: false, managers: [], groups: [] },
  });
  const { data: dir } = useQuery({
    queryKey: ["teams-directory"], retry: false, staleTime: 15_000,
    queryFn: async (): Promise<{ canManage: boolean; users: ProvisionedUser[] }> => (await api<{ canManage: boolean; users: ProvisionedUser[] }>("/teams/directory")) ?? { canManage: false, users: [] },
  });
  const sync = useMutation({
    mutationFn: () => api<{ configured: boolean; synced: number; message?: string; error?: string }>("/teams/groups/sync", { method: "POST" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["teams-admin"] });
      qc.invalidateQueries({ queryKey: ["teams-directory"] });
      toast(r?.error ?? r?.message ?? `Synced ${r?.synced ?? 0} group(s) from Entra.`, r?.error ? "error" : "info");
    },
    onError: (e) => toast((e as Error).message, "error"),
  });

  const managerLabel = (k: string) => admin?.managers.find((m) => m.key === k)?.label ?? "Unmapped";
  const groupRows = (admin?.groups ?? []).map((g) => [g.displayName, g.memberCount, managerLabel(g.managerKey), g.lastSynced || "—"]);
  const userRows = (dir?.users ?? []).map((u) => [u.name, u.email || "—", u.group, u.role, u.status]);
  const connected = !!admin?.graphConfigured;

  return (
    <>
      <div style={{ background: GRADIENT, borderRadius: radius.xl, padding: "16px 20px", marginBottom: 16, color: "#fff", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="users" size={18} /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600 }}>Microsoft Entra ID — directory sync</div>
          <div style={{ fontSize: 12.5, color: "#C9D6EE", marginTop: 2 }}>SCIM provisioning · roles derive from group membership · {connected ? "connected to Microsoft Graph" : "Graph not configured — see Integration Setup"}</div>
        </div>
        {admin?.canManage && (
          <button onClick={() => sync.mutate()} disabled={sync.isPending} title={connected ? "Sync groups & members from Entra" : "Graph not configured — this will report how to enable it"}
            style={{ display: "flex", alignItems: "center", gap: 7, background: color.surface, color: color.primary, border: "none", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: sync.isPending ? "default" : "pointer", opacity: sync.isPending ? 0.7 : 1, fontFamily: "inherit" }}>
            <Icon name="sync" size={16} /> {sync.isPending ? "Syncing…" : "Sync now"}
          </button>
        )}
      </div>
      <div style={{ marginBottom: 18 }}>
        <TableCard title="AD group → role mapping" subtitle="Map Entra security groups to Atlas role-groups. Membership & access follow automatically." cols="1.4fr 0.6fr 1.4fr 0.8fr" headers={["Entra group", "Members", "Mapped role", "Synced"]} empty="No group mappings yet — connect Entra ID and sync, then map groups under Teams." rows={groupRows} />
      </div>
      <TableCard title="Provisioned users" subtitle="Synced from Entra ID · role derived from group membership" cols="1.3fr 1.6fr 1.2fr 1fr 0.7fr" headers={["User", "Email", "Group", "Role", "Status"]} empty="No users provisioned yet — run a sync above." rows={userRows} />
    </>
  );
}

// ---- STAKEHOLDERS ---------------------------------------------------------
const labelStyle: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 };

function StakeholdersSection() {
  const [name, setName] = useState(""); const [title, setTitle] = useState(""); const [org, setOrg] = useState(""); const [email, setEmail] = useState("");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
      <TableCard title="Project stakeholders" subtitle="People assigned here can see that project in their My Projects and track it — nothing else." cols="1.6fr 1.2fr 1fr 70px" headers={["Project", "Person", "Stakeholder role", ""]} empty="No stakeholders assigned yet." />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <span style={{ color: "#0E7C7B", display: "flex" }}><Icon name="users" size={18} /></span>
            <div style={sectionTitle}>Assign a stakeholder</div>
          </div>
          <div style={{ fontSize: 12, color: color.faint2, marginBottom: 16 }}>Grant a person stakeholder access to a project.</div>
          <label style={labelStyle}>Project</label>
          <Select style={{ marginBottom: 13 }}><option value="">Select a project…</option></Select>
          <label style={labelStyle}>Person</label>
          <Select style={{ marginBottom: 13 }}><option value="">Select a person…</option></Select>
          <label style={labelStyle}>Stakeholder role</label>
          <Select style={{ marginBottom: 13 }}><option value="">Select a role…</option></Select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <div><label style={labelStyle}>Power</label><Select><option>High</option><option>Low</option></Select></div>
            <div><label style={labelStyle}>Interest</label><Select><option>High</option><option>Low</option></Select></div>
          </div>
          <button style={{ width: "100%", fontSize: 13.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: 11, borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>Assign stakeholder</button>
        </Card>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <span style={{ color: color.primary, display: "flex" }}><Icon name="userCheck" size={18} /></span>
            <div style={sectionTitle}>Create stakeholder contact</div>
          </div>
          <div style={{ fontSize: 12, color: color.faint2, marginBottom: 16 }}>Add a person to the contact directory, then assign them above.</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={{ marginBottom: 11 }} />
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title / role" style={{ marginBottom: 11 }} />
          <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Organisation / unit" style={{ marginBottom: 11 }} />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ marginBottom: 16 }} />
          <button style={{ width: "100%", fontSize: 13.5, fontWeight: 600, color: color.primary, background: color.primaryTint, border: `1px solid ${color.primaryTint2}`, padding: 11, borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>Create contact</button>
        </Card>
      </div>
    </div>
  );
}

// ---- ARCHIVE & DELETIONS --------------------------------------------------
interface DeletionReq { id: number; projectId: string; projectName: string; requestedBy: string; requestedRole: string; date: string; }
interface ArchivedProj { id: string; name: string; dept: string; owner: string; isSystem: boolean; }
interface ArchiveAdmin { canGovern: boolean; canDelete: boolean; requests: DeletionReq[]; archived: ArchivedProj[]; }

function ArchiveSection() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["archive-admin"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<ArchiveAdmin> => (await api<ArchiveAdmin>("/deletion-requests")) ?? { canGovern: false, canDelete: false, requests: [], archived: [] },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["archive-admin"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const approve = useMutation({ mutationFn: (id: number) => api(`/deletion-requests/${id}/approve`, { method: "POST" }), onSuccess: refresh });
  const reject = useMutation({ mutationFn: (id: number) => api(`/deletion-requests/${id}`, { method: "DELETE" }), onSuccess: refresh });
  const restore = useMutation({ mutationFn: (id: string) => api(`/projects/${id}/unarchive`, { method: "POST" }), onSuccess: refresh });
  const purge = useMutation({ mutationFn: (id: string) => api(`/projects/${id}`, { method: "DELETE" }), onSuccess: refresh });

  const d = data ?? { canGovern: false, canDelete: false, requests: [], archived: [] };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <div style={sectionTitle}>Deletion requests · PMO approval</div>
          <div style={sectionSub}>Approving archives the project (a soft delete) — it stays recoverable in the archive.</div>
        </div>
        {d.requests.length === 0 ? (
          <EmptyBlock message="No pending deletion requests." />
        ) : d.requests.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 22px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{r.projectName}</div>
              <div style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono }}>{r.projectId} · by {r.requestedBy} ({r.requestedRole}) · {r.date}</div>
            </div>
            {d.canGovern ? (
              <>
                <button onClick={() => approve.mutate(r.id)} disabled={approve.isPending} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#15A34A", border: "none", padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Approve → Archive</button>
                <button onClick={() => reject.mutate(r.id)} disabled={reject.isPending} style={{ fontSize: 12, fontWeight: 600, color: color.dangerInk, background: color.dangerTint, border: "none", padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Reject</button>
              </>
            ) : <span style={{ fontSize: 11.5, color: color.faint3 }}>Awaiting PMO</span>}
          </div>
        ))}
      </Card>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <div style={sectionTitle}>Archive</div>
          <div style={sectionSub}>Recoverable by Platform Admin &amp; PMO Lead only.</div>
        </div>
        {d.archived.length === 0 ? (
          <EmptyBlock message="Archive is empty." />
        ) : d.archived.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 22px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{a.name}</div>
              <div style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono }}>{a.id} · {a.dept} · {a.owner}</div>
            </div>
            {d.canGovern && (
              <button onClick={() => restore.mutate(a.id)} disabled={restore.isPending} style={{ fontSize: 12, fontWeight: 600, color: color.primary, background: color.primaryTint, border: `1px solid ${color.primaryTint2}`, padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Restore</button>
            )}
            {d.canDelete && !a.isSystem && (
              <button onClick={() => purge.mutate(a.id)} disabled={purge.isPending} title="Permanently delete (Platform Admin)" style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#D13438", border: "none", padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---- AUDIT LOG ------------------------------------------------------------
interface AuditEntry { at: string; actor: string; role: string; category: string; action: string; target: string; }
const AUDIT_COLS = "1.1fr 1.2fr 1.4fr 0.9fr 1.5fr";

function useAudit() {
  return useQuery({
    queryKey: ["audit"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<AuditEntry[]> => (await api<AuditEntry[]>("/audit")) ?? [],
  });
}

function AuditSection() {
  const { data: entries = [] } = useAudit();
  const { can } = usePermissions();
  const mayExport = can("cap-export", "V") && can("cap-audit", "V");
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 22px", borderBottom: `1px solid ${color.bg}` }}>
        <div style={{ flex: 1 }}>
          <div style={sectionTitle}>Audit log</div>
          <div style={sectionSub}>Append-only record of role, permission &amp; portfolio changes</div>
        </div>
        {mayExport && (
          <Button variant="secondary" onClick={() => apiDownload("/audit.csv", "atlas-audit-log.csv")}>
            <Icon name="download" size={15} /> Export CSV
          </Button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: AUDIT_COLS, padding: "11px 22px", borderBottom: `1px solid ${color.bg}`, ...colHeadStyle }}>
        {["Timestamp", "Actor", "Action", "Subject", "Detail"].map((h) => <div key={h}>{h}</div>)}
      </div>
      {entries.length === 0 ? (
        <EmptyBlock message="No audit entries yet." />
      ) : entries.map((e, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: AUDIT_COLS, alignItems: "center", padding: "11px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, fontSize: 12.5 }}>
          <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint3 }}>{fmtAudit(e.at)}</div>
          <div style={{ color: color.text }}>
            <span style={{ fontWeight: 600 }}>{e.actor}</span>
            <span style={{ display: "block", fontSize: 11, color: color.faint3, textTransform: "capitalize" }}>{e.role}</span>
          </div>
          <div style={{ color: color.text }}>{e.action}</div>
          <div><span style={{ fontSize: 11.5, fontWeight: 600, color: color.primary, background: color.primaryTint, padding: "2px 9px", borderRadius: 20 }}>{e.category}</span></div>
          <div style={{ color: color.subtle, fontFamily: font.mono, fontSize: 11.5 }}>{e.target}</div>
        </div>
      ))}
    </Card>
  );
}

function fmtAudit(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ---- TEAMS (Entra groups → manager slots, roll-up hierarchy) --------------
interface TeamManager { key: string; label: string; parentKey: string; groupIds: string[]; memberCount: number; }
interface TeamGroup { id: string; displayName: string; managerKey: string; manual: boolean; lastSynced: string; memberCount: number; }
interface TeamsAdmin { canManage: boolean; graphConfigured: boolean; managers: TeamManager[]; groups: TeamGroup[]; }

function TeamsSection() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["teams-admin"], retry: false, staleTime: 15_000,
    queryFn: async (): Promise<TeamsAdmin> => (await api<TeamsAdmin>("/teams/admin")) ?? { canManage: false, graphConfigured: false, managers: [], groups: [] },
  });
  const d = data ?? { canManage: false, graphConfigured: false, managers: [], groups: [] };
  const invalidate = () => qc.invalidateQueries({ queryKey: ["teams-admin"] });
  const sync = useMutation({
    mutationFn: () => api<{ configured: boolean; synced: number; message?: string; error?: string }>("/teams/groups/sync", { method: "POST" }),
    onSuccess: (r) => { invalidate(); toast(r?.error ?? r?.message ?? `Synced ${r?.synced ?? 0} group(s) from Entra.`, r?.error ? "error" : "info"); },
    onError: (e) => toast((e as Error).message, "error"),
  });
  const addGroup = useMutation({
    mutationFn: (displayName: string) => api("/teams/groups", { method: "POST", body: JSON.stringify({ displayName }) }),
    onSuccess: invalidate, onError: (e) => toast((e as Error).message, "error"),
  });
  const mapGroup = useMutation({
    mutationFn: (v: { id: string; managerKey: string }) => api(`/teams/groups/${v.id}`, { method: "PATCH", body: JSON.stringify({ managerKey: v.managerKey }) }),
    onSuccess: invalidate, onError: (e) => toast((e as Error).message, "error"),
  });
  const delGroup = useMutation({
    mutationFn: (id: string) => api(`/teams/groups/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const setParent = useMutation({
    mutationFn: (v: { key: string; parentKey: string }) => api(`/teams/managers/${v.key}`, { method: "PATCH", body: JSON.stringify({ parentKey: v.parentKey }) }),
    onSuccess: invalidate, onError: (e) => toast((e as Error).message, "error"),
  });
  const [newGroup, setNewGroup] = useState("");
  const managerName = (k: string) => d.managers.find((m) => m.key === k)?.label ?? "—";

  return (
    <>
      <div style={{ background: GRADIENT, borderRadius: radius.xxl, padding: "20px 24px", marginBottom: 18, color: "#fff", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600 }}>Teams</div>
          <div style={{ fontSize: 13, color: "#C9D6EE", marginTop: 3 }}>
            Map Entra groups to their team manager. {d.graphConfigured ? "Groups sync from Microsoft Graph." : "Graph isn't configured — add groups manually below."}
          </div>
        </div>
        {d.canManage && (
          <button onClick={() => sync.mutate()} disabled={sync.isPending} title={d.graphConfigured ? "Sync groups & members from Entra" : "Graph not configured — this will report how to enable it"}
            style={{ display: "flex", alignItems: "center", gap: 8, background: color.surface, color: color.primary, border: "none", borderRadius: 10, padding: "11px 17px", fontSize: 13.5, fontWeight: 700, cursor: sync.isPending ? "default" : "pointer", fontFamily: "inherit", opacity: sync.isPending ? 0.7 : 1 }}>
            <Icon name="refresh" size={16} /> {sync.isPending ? "Syncing…" : "Sync from Entra"}
          </button>
        )}
      </div>

      {/* Group → manager mapping */}
      <Card padding={0} style={{ overflow: "hidden", marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 0.7fr 0.9fr 40px", padding: "13px 22px", borderBottom: `1px solid ${color.bg}`, ...colHeadStyle, letterSpacing: "0.04em" }}>
          <div>Entra group</div><div>Team manager</div><div>Members</div><div>Source</div><div />
        </div>
        {d.groups.length === 0 ? (
          <EmptyBlock message={d.graphConfigured ? "No groups synced yet — click “Sync from Entra”." : "No groups yet — add one below or configure Graph to sync."} />
        ) : d.groups.map((g) => (
          <div key={g.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 0.7fr 0.9fr 40px", alignItems: "center", padding: "12px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, fontSize: 12.5 }}>
            <div style={{ fontWeight: 600, color: color.text }}>{g.displayName}</div>
            <div>
              {d.canManage ? (
                <Select value={g.managerKey} onChange={(e) => mapGroup.mutate({ id: g.id, managerKey: e.target.value })} style={{ padding: "6px 9px", fontSize: 12.5 }}>
                  <option value="">— Unmapped —</option>
                  {d.managers.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </Select>
              ) : (g.managerKey ? managerName(g.managerKey) : "— Unmapped —")}
            </div>
            <div style={{ fontFamily: font.mono, color: color.textMuted }}>{g.memberCount}</div>
            <div><span style={{ fontSize: 11, fontWeight: 600, color: g.manual ? "#8A6300" : "#0C5798", background: g.manual ? color.warningTint : color.primaryTint2, padding: "3px 9px", borderRadius: 6 }}>{g.manual ? "Manual" : "Entra"}</span></div>
            <div style={{ textAlign: "right" }}>{d.canManage && <button onClick={() => delGroup.mutate(g.id)} title="Remove group" style={{ border: "none", background: "transparent", color: "#B0546A", cursor: "pointer", display: "flex", padding: 0, marginLeft: "auto" }}><Icon name="trash" size={14} /></button>}</div>
          </div>
        ))}
        {d.canManage && (
          <div style={{ display: "flex", gap: 9, padding: "13px 22px", borderTop: `1px solid ${color.bg}`, background: color.surfaceAlt }}>
            <Input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Add a group by name (manual)" style={{ maxWidth: 320 }} />
            <Button variant="secondary" onClick={() => { if (newGroup.trim()) { addGroup.mutate(newGroup.trim()); setNewGroup(""); } }} disabled={!newGroup.trim()}>Add group</Button>
          </div>
        )}
      </Card>

      {/* Manager roll-up hierarchy */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}`, ...sectionTitle }}>Management roll-up</div>
        <div style={{ padding: "6px 22px 14px" }}>
          <div style={{ fontSize: 12, color: color.faint2, margin: "10px 0 12px" }}>Set each manager's parent. A manager sees their own team plus every team beneath them.</div>
          {d.managers.map((m) => (
            <div key={m.key} style={{ display: "grid", gridTemplateColumns: "1.4fr auto 1.2fr 0.7fr", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: `1px solid ${color.surfaceAlt}`, fontSize: 12.5 }}>
              <div style={{ fontWeight: 600, color: color.text }}>{m.label}</div>
              <div style={{ fontSize: 11.5, color: color.faint3 }}>reports to</div>
              <div>
                {d.canManage ? (
                  <Select value={m.parentKey} onChange={(e) => setParent.mutate({ key: m.key, parentKey: e.target.value })} style={{ padding: "6px 9px", fontSize: 12.5 }}>
                    <option value="">— Top of tree —</option>
                    {d.managers.filter((p) => p.key !== m.key).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </Select>
                ) : (m.parentKey ? managerName(m.parentKey) : "— Top —")}
              </div>
              <div style={{ fontFamily: font.mono, color: color.faint3, textAlign: "right" }}>{m.memberCount} member{m.memberCount === 1 ? "" : "s"}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ---- BACKUPS & RESTORE ----------------------------------------------------
interface BackupComponent { name: string; schedule: string; retention: string; records: number; lastBackup: string; }
interface BackupRun { at: string; actor: string; role: string; size: string; records: number; status: string; }
interface BackupsData { canManage: boolean; autoBackups: boolean; lastBackup: string; lastSizeBytes: number; components: BackupComponent[]; runs: BackupRun[]; }

// ---- SECRET ROTATION (database password age + 90/180-day nudges) ----------
interface RotationStatus {
  rotatedAt: string | null; daysSince: number | null;
  status: "unknown" | "ok" | "warn" | "critical";
  warnDays: number; criticalDays: number; canManage: boolean;
}
const ROTATION_UI: Record<RotationStatus["status"], { label: string; fg: string; bg: string }> = {
  unknown:  { label: "Not recorded", fg: color.subtle, bg: color.bg },
  ok:       { label: "Healthy",      fg: "#15A34A", bg: color.successTint },
  warn:     { label: "Rotate soon",  fg: "#9A6800", bg: color.warningTint },
  critical: { label: "Change it now!", fg: "#A1282B", bg: color.dangerTint },
};

function SecretRotationCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["secret-rotation"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<RotationStatus | null> => {
      try { return await api<RotationStatus>("/admin/secret-rotation"); } catch { return null; }
    },
  });
  const mark = useMutation({
    mutationFn: () => api("/admin/secret-rotation/mark", { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["secret-rotation"] }); toast("Recorded — database password marked rotated today.", "info"); },
    onError: (e) => toast(`Couldn’t record rotation: ${(e as Error).message}`, "error"),
  });
  if (!data) return null;
  const ui = ROTATION_UI[data.status];
  const age = data.daysSince == null ? "—" : `${data.daysSince} day${data.daysSince === 1 ? "" : "s"} ago`;

  return (
    <div style={{ marginBottom: 18 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={sectionTitle}>Database password rotation</div>
            <div style={sectionSub}>
              Last changed: <b style={{ color: color.text }}>{data.rotatedAt ?? "not recorded yet"}</b>
              {data.daysSince != null && <> · {age}</>} · warn at {data.warnDays}d, critical at {data.criticalDays}d
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: ui.fg, background: ui.bg, padding: "6px 12px", borderRadius: 20 }}>
            {ui.label}
          </span>
          {data.canManage && (
            <button onClick={() => mark.mutate()} disabled={mark.isPending}
              style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "9px 15px", borderRadius: 9, cursor: mark.isPending ? "default" : "pointer", fontFamily: "inherit", opacity: mark.isPending ? 0.7 : 1 }}>
              Mark as rotated today
            </button>
          )}
        </div>
        {data.status !== "ok" && data.status !== "unknown" && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: ui.fg, background: ui.bg, borderRadius: 8, padding: "9px 12px" }}>
            {data.status === "critical"
              ? "This password is overdue for rotation. Rotate it, then mark it here."
              : "This password is approaching its rotation window. Plan to rotate it soon."}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---- DATA PRIVACY (GDPR) --------------------------------------------------
// Platform-Admin surface for the data-subject rights already implemented on the
// API: portability/access (DSAR export), erasure (anonymise a subject), and an
// on-demand run of the age-based retention pass. All three are Platform-Admin
// gated and audited server-side; this just wires them up.
interface Subject { name: string; email: string; }

function PrivacySection() {
  const [subject, setSubject] = useState("");
  const [confirmErase, setConfirmErase] = useState(false);

  const { data: subjects } = useQuery({
    queryKey: ["gdpr-subjects"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Subject[]> => (await api<Subject[]>("/gdpr/subjects")) ?? [],
  });

  // A subject may be picked from the directory or typed (name, email or key).
  const options = subjects ?? [];
  const s = subject.trim();

  const exporting = useMutation({
    mutationFn: () => apiDownload(`/gdpr/export?subject=${encodeURIComponent(s)}`, `atlas-dsar-${slugify(s)}.json`),
    onSuccess: () => toast("Data-subject export downloaded"),
    onError: (e) => toastError(e),
  });
  const erasing = useMutation({
    mutationFn: () => api<{ subject: string; anonymised: number }>(`/gdpr/erase?subject=${encodeURIComponent(s)}`, { method: "POST" }),
    onSuccess: (r) => { setConfirmErase(false); toast(`Erased ${s} — ${r?.anonymised ?? 0} record(s) anonymised`); },
    onError: (e) => toastError(e),
  });
  const retention = useMutation({
    mutationFn: () => api<{ anonymised: number; cutoff: string }>(`/admin/retention/run`, { method: "POST" }),
    onSuccess: (r) => toast(`Retention pass complete — ${r?.anonymised ?? 0} record(s) anonymised`),
    onError: (e) => toastError(e),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Data-subject requests */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <div style={sectionTitle}>Data-subject requests (GDPR Art. 15, 17 & 20)</div>
          <div style={sectionSub}>Export or erase everything Atlas holds about one person. Matching is exact (case-insensitive) on name, email or user key. Every action is audited.</div>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px", minWidth: 220 }}>
              <label style={{ ...colHeadStyle, display: "block", marginBottom: 6 }}>Subject</label>
              {options.length > 0 && (
                <Select value={options.some((o) => (o.email || o.name) === subject) ? subject : ""} onChange={(e) => setSubject(e.target.value)} style={{ marginBottom: 8 }}>
                  <option value="">Pick from directory…</option>
                  {options.map((o) => {
                    const val = o.email || o.name;
                    return <option key={val} value={val}>{o.name}{o.email ? ` · ${o.email}` : ""}</option>;
                  })}
                </Select>
              )}
              <Input value={subject} onChange={(e) => { setSubject(e.target.value); setConfirmErase(false); }} placeholder="Name, email or user key" />
            </div>
            <Button variant="secondary" disabled={!s || exporting.isPending} onClick={() => exporting.mutate()}>
              <Icon name="download" size={15} /> {exporting.isPending ? "Exporting…" : "Export data (DSAR)"}
            </Button>
          </div>

          <div style={{ marginTop: 16, borderTop: `1px solid ${color.bg}`, paddingTop: 14 }}>
            {!confirmErase ? (
              <button onClick={() => setConfirmErase(true)} disabled={!s} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: s ? "#A1282B" : color.faint3, background: "none", border: "none", cursor: s ? "pointer" : "not-allowed", fontFamily: "inherit", padding: "4px 0" }}>
                <Icon name="trash" size={15} /> Erase this subject (right to be forgotten)
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: color.dangerInk, fontWeight: 600 }}>Anonymise every record referencing “{s}”? Rows are kept but identifiers are irreversibly pseudonymised.</span>
                <Button onClick={() => erasing.mutate()} disabled={erasing.isPending} style={{ background: "#D13438", borderColor: color.danger }}>{erasing.isPending ? "Erasing…" : "Confirm erasure"}</Button>
                <Button variant="secondary" onClick={() => setConfirmErase(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Retention */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <div style={sectionTitle}>Data retention</div>
          <div style={sectionSub}>Records past the retention window (default 10 years) have their personal identifiers anonymised. A background pass runs daily; you can also run it on demand.</div>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 14 }}>
          <Button variant="secondary" disabled={retention.isPending} onClick={() => retention.mutate()}>
            <Icon name="refresh" size={15} /> {retention.isPending ? "Running…" : "Run retention now"}
          </Button>
          <span style={{ fontSize: 12, color: color.faint2 }}>Anonymises expired audit actors and notification keys. Safe to run anytime — nothing within the window is touched.</span>
        </div>
      </Card>
    </div>
  );
}

function slugify(s: string): string {
  const out = s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return out || "subject";
}

function BackupsSection() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["backups"], retry: false, staleTime: 15_000,
    queryFn: async (): Promise<BackupsData> => (await api<BackupsData>("/backups")) ?? { canManage: false, autoBackups: true, lastBackup: "Never", lastSizeBytes: 0, components: [], runs: [] },
  });
  const d = data ?? { canManage: false, autoBackups: true, lastBackup: "Never", lastSizeBytes: 0, components: [], runs: [] };
  const runBackup = useMutation({
    mutationFn: () => api<{ size?: string; records?: number }>("/backups/run", { method: "POST" }),
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: ["backups"] });
      const detail = res?.records != null ? ` — ${res.records.toLocaleString()} records${res.size ? `, ${res.size}` : ""}` : "";
      toast(`Backup complete${detail}. Downloading snapshot…`, "info");
      try { await apiDownload("/backups/snapshot.json", "atlas-backup.json"); }
      catch (e) { toast(`Backup ran, but the download failed: ${(e as Error).message}`, "error"); }
    },
    onError: (e) => toast(`Backup failed: ${(e as Error).message}`, "error"),
  });
  const toggleAuto = useMutation({
    mutationFn: (on: boolean) => api("/settings/backups.auto", { method: "PATCH", body: JSON.stringify({ value: on ? "true" : "false" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }),
  });
  const restore = useMutation({
    mutationFn: (text: string) => api<{ ok: boolean; restored: Record<string, number> }>("/backups/restore", { method: "POST", body: text }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["backups"] });
      const n = Object.values(res?.restored ?? {}).reduce((a, b) => a + b, 0);
      toast(`Restored ${n} record${n === 1 ? "" : "s"} (merge). Reload to see changes.`, "info");
    },
    onError: (e) => toast(`Restore failed: ${(e as Error).message}`, "error"),
  });
  const onRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";   // allow re-selecting the same file
    if (!file) return;
    if (!confirm("Restore from this backup? This MERGES the file into the current data (upsert by id) — it updates and re-creates rows but never deletes. Child rows and attachments are not restored (use a database dump for full recovery).")) return;
    file.text().then((t) => restore.mutate(t));
  };

  return (
    <>
      <SecretRotationCard />
      <div style={{ background: GRADIENT, borderRadius: radius.xxl, padding: "20px 24px", marginBottom: 18, color: "#fff", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600 }}>Backups & restore</div>
          <div style={{ fontSize: 13, color: "#C9D6EE", marginTop: 3 }}>Last backup: <b style={{ color: "#fff" }}>{d.lastBackup}</b>{d.runs.length ? ` · ${d.runs[0].size} · ${d.runs[0].records} records` : ""}</div>
        </div>
        <button onClick={() => d.canManage && toggleAuto.mutate(!d.autoBackups)} disabled={!d.canManage} title={d.canManage ? "Toggle automatic nightly backups" : "Platform Admin only"}
          style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 13px", border: "none", cursor: d.canManage ? "pointer" : "default", fontFamily: "inherit" }}>
          <span style={{ fontSize: 12.5, color: "#fff" }}>Automatic backups</span>
          <span style={{ position: "relative", width: 40, height: 22, display: "inline-block" }}>
            <span style={{ position: "absolute", inset: 0, background: d.autoBackups ? "#3BD17A" : "rgba(255,255,255,0.25)", borderRadius: 20 }} />
            <span style={{ position: "absolute", top: 3, [d.autoBackups ? "right" : "left"]: 3, width: 16, height: 16, background: color.surface, borderRadius: "50%" } as React.CSSProperties} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: d.autoBackups ? "#3BD17A" : "#C9D6EE" }}>{d.autoBackups ? "ON" : "OFF"}</span>
        </button>
        {d.canManage && (
          <>
            <button onClick={() => runBackup.mutate()} disabled={runBackup.isPending} style={{ display: "flex", alignItems: "center", gap: 8, background: color.surface, color: color.primary, border: "none", borderRadius: 10, padding: "11px 17px", fontSize: 13.5, fontWeight: 700, cursor: runBackup.isPending ? "default" : "pointer", fontFamily: "inherit", opacity: runBackup.isPending ? 0.7 : 1 }}>
              <Icon name="download" size={16} /> {runBackup.isPending ? "Backing up…" : "Back up all now"}
            </button>
            <label title="Restore (merge) from a downloaded Atlas backup file"
              style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: "11px 17px", fontSize: 13.5, fontWeight: 700, cursor: restore.isPending ? "default" : "pointer", fontFamily: "inherit", opacity: restore.isPending ? 0.7 : 1 }}>
              <Icon name="refresh" size={16} /> {restore.isPending ? "Restoring…" : "Restore…"}
              <input type="file" accept="application/json,.json" onChange={onRestoreFile} disabled={restore.isPending} style={{ display: "none" }} />
            </label>
          </>
        )}
      </div>
      <div style={{ marginBottom: 18 }}>
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: BACKUP_COLS, padding: "13px 22px", borderBottom: `1px solid ${color.bg}`, ...colHeadStyle, letterSpacing: "0.04em" }}>
            <div>Component</div><div>Schedule</div><div>Retention</div><div>Records</div><div>Last backup</div><div style={{ textAlign: "right" }}>Actions</div>
          </div>
          {d.components.length === 0 ? (
            <EmptyBlock message="No backup components." />
          ) : d.components.map((c) => (
            <div key={c.name} style={{ display: "grid", gridTemplateColumns: BACKUP_COLS, alignItems: "center", padding: "13px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, fontSize: 12.5 }}>
              <div style={{ fontWeight: 600, color: color.text }}>{c.name}</div>
              <div style={{ color: color.subtle }}>{c.schedule}</div>
              <div style={{ color: color.subtle }}>{c.retention}</div>
              <div style={{ fontFamily: font.mono, color: color.textMuted }}>{c.records.toLocaleString()}</div>
              <div style={{ color: color.subtle }}>{c.lastBackup}</div>
              <div style={{ textAlign: "right" }}>
                {d.canManage && <button onClick={() => apiDownload("/backups/snapshot.json", "atlas-backup.json")} style={{ fontSize: 11.5, fontWeight: 600, color: color.primary, background: color.primaryTint, border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}>Download</button>}
              </div>
            </div>
          ))}
        </Card>
      </div>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}`, ...sectionTitle }}>Recent backup runs</div>
        {d.runs.length === 0 ? (
          <EmptyBlock message="No backup runs recorded yet — click “Back up all now”." />
        ) : d.runs.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, fontSize: 12.5 }}>
            <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint3, minWidth: 168 }}>{r.at}</span>
            <span style={{ flex: 1, color: color.text }}>{r.actor} <span style={{ color: color.faint3 }}>({r.role})</span></span>
            <span style={{ fontFamily: font.mono, color: color.textMuted }}>{r.records.toLocaleString()} records</span>
            <span style={{ fontFamily: font.mono, color: color.textMuted, minWidth: 70, textAlign: "right" }}>{r.size}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: color.successInk, background: color.successTint, padding: "3px 9px", borderRadius: 6 }}>{r.status}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

// ---- INSTALLATION / INTEGRATION GUIDES (structural documentation) ---------
function GuidesSection({ kind, openGuide, setOpenGuide }: {
  kind: "install" | "int"; openGuide: string | null; setOpenGuide: (id: string | null) => void;
}) {
  const guides = kind === "install" ? INSTALL_GUIDES : INTEGRATION_GUIDES;
  const banner = kind === "install"
    ? { icon: "server", title: "Step-by-step installation", sub: "Deploy and configure every component of the Atlas platform. Expand a section for instructions." }
    : { icon: "plug", title: "Integration setup guides", sub: "Connect Atlas to your delivery and service-management tools. Admin-only." };
  return (
    <>
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 13 }}>
        <span style={{ width: 40, height: 40, borderRadius: radius.lg, background: color.border3, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name={banner.icon} size={20} /></span>
        <div><div style={sectionTitle}>{banner.title}</div><div style={{ fontSize: 12.5, color: color.faint2 }}>{banner.sub}</div></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {guides.map((g) => {
          const id = (kind === "int" ? "int-" : "") + g.id;
          const open = openGuide === id;
          return (
            <div key={id} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 13, overflow: "hidden" }}>
              <div onClick={() => setOpenGuide(open ? null : id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", cursor: "pointer" }}>
                {g.brand ? (
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: g.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontFamily: font.head, fontSize: 12.5, fontWeight: 700 }}>{g.initials}</span>
                ) : (
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: color.primaryTint, color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name={g.icon ?? "gear"} size={20} /></span>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: color.ink }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: color.faint3 }}>{g.sub}</div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: color.subtle, background: color.bg, padding: "3px 10px", borderRadius: 20 }}>{g.steps.length} steps</span>
                {g.time && <span style={{ fontSize: 12, color: color.faint3 }}>{g.time}</span>}
                <span style={{ color: "#C2C8D4", display: "flex", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}><Icon name="chevronDown" size={18} /></span>
              </div>
              {open && (
                <div style={{ padding: "6px 22px 20px 70px" }}>
                  {g.steps.map((text, i) => (
                    <div key={i} style={{ display: "flex", gap: 13, padding: "8px 0" }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: color.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, flex: "none", fontFamily: font.head }}>{i + 1}</span>
                      <span style={{ fontSize: 13.5, lineHeight: 1.55, color: color.textMuted, paddingTop: 2 }}>{text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---- Security posture (structured docs, from @/data/adminDocs) -------------
function SecurityPostureSection() {
  const s = SECURITY_POSTURE;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <div style={sectionTitle}>Application security posture</div>
        <div style={{ fontSize: 12.5, color: color.textMuted, lineHeight: 1.6, marginTop: 8 }}>{s.intro}</div>
      </Card>

      <Card padding={0}>
        <div style={{ padding: "14px 20px 8px" }}><div style={sectionTitle}>Automated scanners</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 2.6fr 1.4fr", gap: 0, padding: "0 20px 6px", ...colHeadStyle }}>
          <div>Tool</div><div>Type</div><div>Covers</div><div>Enforcement</div>
        </div>
        {s.scanners.map((sc) => (
          <div key={sc.name} style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 2.6fr 1.4fr", gap: 0, padding: "10px 20px", borderTop: `1px solid ${color.bg}`, alignItems: "start" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{sc.name}</div>
            <div style={{ fontSize: 12, color: color.textMuted }}>{sc.kind}</div>
            <div style={{ fontSize: 12, color: color.textMuted, lineHeight: 1.5 }}>{sc.covers}</div>
            <div style={{ fontSize: 12, color: color.textMuted }}>{sc.gating}</div>
          </div>
        ))}
      </Card>

      <Card>
        <div style={sectionTitle}>How it's run</div>
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 7 }}>
          {s.howToRun.map((t, i) => <li key={i} style={{ fontSize: 12.5, color: color.textMuted, lineHeight: 1.55 }}>{t}</li>)}
        </ul>
      </Card>

      <Card padding={0}>
        <div style={{ padding: "14px 20px 8px" }}><div style={sectionTitle}>Accepted exceptions (documented risk acceptances)</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 3fr", gap: 0, padding: "0 20px 6px", ...colHeadStyle }}>
          <div>Item</div><div>Why</div>
        </div>
        {s.exceptions.map((x, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 3fr", gap: 0, padding: "10px 20px", borderTop: `1px solid ${color.bg}`, alignItems: "start" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: color.text }}>{x.item}</div>
            <div style={{ fontSize: 12, color: color.textMuted, lineHeight: 1.5 }}>{x.why}</div>
          </div>
        ))}
      </Card>

      <Card>
        <div style={sectionTitle}>Manual penetration test</div>
        <div style={{ fontSize: 12.5, color: color.textMuted, lineHeight: 1.6, marginTop: 8 }}>{s.manual}</div>
      </Card>
    </div>
  );
}

// ---- Application Evaluation (structured docs, from @/data/adminDocs) -------
function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} of 5`} style={{ color: "#C98A00", letterSpacing: 1, fontSize: 13, whiteSpace: "nowrap" }}>
      {"★".repeat(n)}<span style={{ color: color.border3 }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

const RISK_TINT: Record<string, { ink: string; bg: string }> = {
  High: { ink: color.dangerInk, bg: color.dangerTint },
  Medium: { ink: color.warningInk, bg: color.warningTint },
  Low: { ink: color.subtle, bg: color.neutralTint },
};

function EvaluationSection() {
  const e = EVALUATION;
  const excellent = e.scorecard.filter((d: EvalDimension) => d.stars === 5).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={sectionTitle}>Application evaluation</div>
            <div style={sectionSub}>Evidence-based assessment against engineering & product quality dimensions · reviewed {e.lastReviewed}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: color.primary }}>{e.overall}</div>
            <div style={{ fontSize: 11.5, color: color.faint2 }}>{excellent} of {e.scorecard.length} dimensions at ★★★★★</div>
          </div>
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ padding: "14px 20px 8px" }}><div style={sectionTitle}>Scorecard</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "30px 1.6fr 0.9fr 2.2fr 1.6fr", gap: 0, padding: "0 20px 6px", ...colHeadStyle }}>
          <div>#</div><div>Dimension</div><div>Rating</div><div>Evidence</div><div>Gaps / next</div>
        </div>
        {e.scorecard.map((d: EvalDimension) => (
          <div key={d.n} style={{ display: "grid", gridTemplateColumns: "30px 1.6fr 0.9fr 2.2fr 1.6fr", gap: 0, padding: "10px 20px", borderTop: `1px solid ${color.bg}`, alignItems: "start" }}>
            <div style={{ fontSize: 12, color: color.faint3 }}>{d.n}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{d.name}</div>
            <div><Stars n={d.stars} /></div>
            <div style={{ fontSize: 12, color: color.textMuted, lineHeight: 1.5 }}>{d.evidence}</div>
            <div style={{ fontSize: 12, color: d.gaps === "—" ? color.faint3 : color.textMuted, lineHeight: 1.5 }}>{d.gaps}</div>
          </div>
        ))}
      </Card>

      <Card>
        <div style={sectionTitle}>Dimension notes</div>
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 7 }}>
          {e.notes.map((t, i) => <li key={i} style={{ fontSize: 12.5, color: color.textMuted, lineHeight: 1.55 }}>{t}</li>)}
        </ul>
      </Card>

      <Card padding={0}>
        <div style={{ padding: "14px 20px 8px" }}><div style={sectionTitle}>Top risks & recommended next steps</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "0.7fr 2fr 3fr", gap: 0, padding: "0 20px 6px", ...colHeadStyle }}>
          <div>Priority</div><div>Item</div><div>Why</div>
        </div>
        {e.risks.map((r, i) => {
          const t = RISK_TINT[r.priority] ?? RISK_TINT.Low;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "0.7fr 2fr 3fr", gap: 0, padding: "10px 20px", borderTop: `1px solid ${color.bg}`, alignItems: "center" }}>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: t.ink, background: t.bg, borderRadius: 6, padding: "2px 8px" }}>{r.priority}</span></div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: color.text }}>{r.item}</div>
              <div style={{ fontSize: 12, color: color.textMuted }}>{r.why}</div>
            </div>
          );
        })}
      </Card>

      <Card>
        <div style={sectionTitle}>Overall</div>
        <div style={{ fontSize: 13, color: color.textMuted, lineHeight: 1.6, marginTop: 8 }}>{e.verdict}</div>
      </Card>
    </div>
  );
}

// ---- User Stories (structured docs, from @/data/adminDocs) -----------------
function UserStoriesSection() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const total = USER_STORY_SECTIONS.reduce((n, s) => n + s.stories.length, 0);
  const sections = USER_STORY_SECTIONS
    .map((s) => ({
      ...s,
      stories: query
        ? s.stories.filter((st) => `${st.id} ${st.role} ${st.want} ${st.benefit} ${st.acceptance ?? ""} ${s.title}`.toLowerCase().includes(query))
        : s.stories,
    }))
    .filter((s) => s.stories.length > 0);
  const shown = sections.reduce((n, s) => n + s.stories.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={sectionTitle}>User stories</div>
            <div style={{ ...sectionSub, maxWidth: 820, lineHeight: 1.5 }}>{USER_STORY_INTRO}</div>
          </div>
          <div style={{ minWidth: 220 }}>
            <Input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Filter stories (role, module, text)…" aria-label="Filter user stories" />
            <div style={{ fontSize: 11, color: color.faint3, marginTop: 5, textAlign: "right" }}>{query ? `${shown} of ${total}` : `${total} stories · ${USER_STORY_SECTIONS.length} modules`}</div>
          </div>
        </div>
      </Card>

      {sections.length === 0 ? (
        <Card><EmptyBlock message="No stories match your filter." minHeight={100} /></Card>
      ) : sections.map((s) => (
        <Card key={s.title} padding={0}>
          <div style={{ padding: "13px 20px", borderBottom: `1px solid ${color.bg}`, ...sectionTitle }}>{s.title}</div>
          {s.stories.map((st) => (
            <div key={st.id} style={{ padding: "12px 20px", borderTop: `1px solid ${color.bg}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3 }}>US-{st.id}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: color.primaryDark, background: color.primaryTint, borderRadius: 6, padding: "2px 8px" }}>{st.role}</span>
              </div>
              <div style={{ fontSize: 13, color: color.text, lineHeight: 1.55 }}>
                As a <strong>{st.role}</strong>, I want {st.want}, so that {st.benefit}.
              </div>
              {st.acceptance && <div style={{ fontSize: 12, color: color.faint2, marginTop: 3, lineHeight: 1.5 }}><strong style={{ color: color.textMuted }}>Acceptance:</strong> {st.acceptance}</div>}
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
