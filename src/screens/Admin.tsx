import { useState } from "react";
import { color, font, radius } from "@/theme";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, Input, Select } from "@/components/ui";

// ---------------------------------------------------------------------------
// Administration — built 1:1 from the prototype (design/Atlas PPM.dc.html,
// lines 2129-2430). The roles & permissions matrix and the install/integration
// setup guides are STRUCTURAL chrome (fixed platform documentation, not backend
// data) and are rendered in full. Everything that is genuinely data — provisioned
// users, stakeholder assignments, audit entries, deletion requests, archive,
// backup history — renders as the real layout with tasteful empty states.
// ---------------------------------------------------------------------------

const GRADIENT = "linear-gradient(115deg,#11163A,#0F6CBD)";

const ADMIN_TABS: { id: string; label: string }[] = [
  { id: "roles", label: "Roles & Permissions" },
  { id: "users", label: "Users & Groups" },
  { id: "stakeholders", label: "Stakeholders" },
  { id: "archive", label: "Archive & Deletions" },
  { id: "audit", label: "Audit Log" },
  { id: "backups", label: "Backups & Restore" },
  { id: "install", label: "Installation Guides" },
  { id: "integrations", label: "Integration Setup" },
];

// Canonical role definitions that head the permission matrix (structural chrome).
const ROLE_CARDS = [
  { name: "Platform Administrator", who: "IT / Platform team", icon: "shieldUser", color: "#11163A", tint: "#E6EAF5", desc: "Full control of the platform — configuration, integrations, users, roles, backups & restore." },
  { name: "PMO Lead", who: "Portfolio office", icon: "shield", color: "#0F6CBD", tint: "#E6EFFB", desc: "Governs the portfolio: methodologies, demand approvals, cross-project reporting." },
  { name: "Project Manager", who: "Delivery", icon: "folder", color: "#7A3FB0", tint: "#F0E8F7", desc: "Plans and runs projects: schedule, tasks, artifacts, RAID, status reporting." },
  { name: "Team Member", who: "Squads & contributors", icon: "users", color: "#15A34A", tint: "#E7F4EC", desc: "Works assigned tasks, updates progress, comments and raises blockers." },
  { name: "Executive / Sponsor", who: "Leadership", icon: "trendUp", color: "#C98A00", tint: "#FBF2D7", desc: "Read-only dashboards, approves gates and funding, exports board reports." },
  { name: "Stakeholder", who: "Business / requesters", icon: "userCheck", color: "#0E7C7B", tint: "#DEF2F1", desc: "Sees only projects where they are a stakeholder; can submit demands and track their status." },
];

// Permission legend — tinted cells per code (F Full, E Edit, V View, N None).
const PERM_LEGEND: Record<string, { label: string; cell: string; ink: string; tint: string }> = {
  F: { label: "F", cell: "#15A34A", ink: "#0B6B37", tint: "#E7F4EC" },
  E: { label: "E", cell: "#0F6CBD", ink: "#0C5798", tint: "#E6EFFB" },
  V: { label: "V", cell: "#C98A00", ink: "#8A6300", tint: "#FBF2D7" },
  N: { label: "—", cell: "#D7DCE5", ink: "#9AA2B4", tint: "#F1F3F8" },
};
const PERM_ROLES = ["Admin", "PMO", "PM", "Team", "Exec", "Stkhldr"];
const PERM_ROWS: string[][] = [
  ["Dashboards & reports", "F", "F", "F", "V", "V", "N"],
  ["Pull / export reports", "F", "F", "E", "N", "V", "N"],
  ["Stakeholder projects", "F", "F", "F", "F", "V", "V"],
  ["Projects & tasks", "F", "F", "F", "E", "N", "N"],
  ["Submit a demand", "F", "F", "E", "E", "N", "E"],
  ["Track own demand status", "F", "F", "F", "F", "F", "V"],
  ["Edit demand fields", "F", "F", "E", "N", "N", "N"],
  ["Demand scoring", "F", "F", "E", "E", "N", "N"],
  ["Approve demands & gates", "F", "F", "N", "N", "F", "N"],
  ["Methodology templates", "F", "F", "N", "N", "N", "N"],
  ["Comments & artifacts", "F", "F", "F", "E", "V", "N"],
  ["Integrations & connectors", "F", "N", "N", "N", "N", "N"],
  ["Users, groups & roles", "F", "N", "N", "N", "N", "N"],
  ["Backups & restore", "F", "N", "N", "N", "N", "N"],
  ["Platform & SSO settings", "F", "N", "N", "N", "N", "N"],
  ["Audit & activity log", "F", "V", "N", "N", "N", "N"],
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

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${color.border3}`, marginBottom: 22, overflowX: "auto" }}>
        {ADMIN_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 4px", margin: "0 18px 0 0", border: "none",
              borderBottom: active ? "2.5px solid #0F6CBD" : "2.5px solid transparent",
              background: "none", cursor: "pointer", fontSize: 14, fontWeight: active ? 700 : 500,
              color: active ? color.primary : "#6A7488", fontFamily: "inherit", whiteSpace: "nowrap",
            }}>{t.label}</button>
          );
        })}
      </div>

      {tab === "roles" && <RolesSection />}
      {tab === "users" && <UsersSection />}
      {tab === "stakeholders" && <StakeholdersSection />}
      {tab === "archive" && <ArchiveSection />}
      {tab === "audit" && <AuditSection />}
      {tab === "backups" && <BackupsSection />}
      {tab === "install" && <GuidesSection kind="install" openGuide={openGuide} setOpenGuide={setOpenGuide} />}
      {tab === "integrations" && <GuidesSection kind="int" openGuide={openGuide} setOpenGuide={setOpenGuide} />}
    </div>
  );
}

// ---- shared bits ----------------------------------------------------------
const sectionTitle: React.CSSProperties = { fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink };
const sectionSub: React.CSSProperties = { fontSize: 12, color: color.faint2, marginTop: 2 };
const colHeadStyle: React.CSSProperties = { fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 };

function TableCard({ title, subtitle, cols, headers, empty }: {
  title: string; subtitle?: string; cols: string; headers: string[]; empty: string;
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
      <EmptyBlock message={empty} />
    </Card>
  );
}

// ---- ROLES & PERMISSIONS --------------------------------------------------
function RolesSection() {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 13, marginBottom: 22 }}>
        {ROLE_CARDS.map((r) => (
          <div key={r.name} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: 17 }}>
            <div style={{ width: 40, height: 40, borderRadius: radius.lg, background: r.tint, color: r.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Icon name={r.icon} size={20} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: color.ink, lineHeight: 1.25, marginBottom: 3 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: color.faint3, marginBottom: 9 }}>{r.who}</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: color.subtle }}>{r.desc}</div>
          </div>
        ))}
      </div>

      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "17px 22px 14px", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={sectionTitle}>Permission matrix</div>
            <div style={{ fontSize: 12, color: color.faint2 }}>What each role can do across the platform</div>
          </div>
          <div style={{ display: "flex", gap: 13, fontSize: 11.5, color: color.faint }}>
            {[["Full", "#15A34A"], ["Edit", "#0F6CBD"], ["View", "#C98A00"], ["None", "#D7DCE5"]].map(([label, c]) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: c }} />{label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(6,1fr)", padding: "0 22px 11px", borderBottom: `1px solid ${color.bg}`, ...colHeadStyle, letterSpacing: "0.04em" }}>
          <div>Capability</div>
          {PERM_ROLES.map((rn) => <div key={rn} style={{ textAlign: "center" }}>{rn}</div>)}
        </div>
        {PERM_ROWS.map((row) => (
          <div key={row[0]} style={{ display: "grid", gridTemplateColumns: "2fr repeat(6,1fr)", alignItems: "center", padding: "11px 22px", borderBottom: "1px solid #F4F6FA" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: color.text }}>{row[0]}</div>
            {row.slice(1).map((code, i) => {
              const p = PERM_LEGEND[code];
              return (
                <div key={i} style={{ display: "flex", justifyContent: "center" }}>
                  <span style={{ minWidth: 46, textAlign: "center", fontSize: 11.5, fontWeight: 700, color: p.ink, background: p.tint, padding: "4px 0", borderRadius: 8 }}>{p.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </Card>
    </>
  );
}

// ---- USERS & GROUPS -------------------------------------------------------
function UsersSection() {
  return (
    <>
      <div style={{ background: GRADIENT, borderRadius: radius.xl, padding: "16px 20px", marginBottom: 16, color: "#fff", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="users" size={18} /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600 }}>Microsoft Entra ID — directory sync</div>
          <div style={{ fontSize: 12.5, color: "#C9D6EE", marginTop: 2 }}>SCIM provisioning · roles derive from group membership · not yet connected</div>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", color: color.primary, border: "none", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Icon name="sync" size={16} /> Sync now</button>
      </div>
      <div style={{ marginBottom: 18 }}>
        <TableCard title="AD group → role mapping" subtitle="Map Entra security groups to Atlas role-groups. Membership & access follow automatically." cols="1.4fr 0.6fr 1.4fr 0.8fr" headers={["Entra group", "Members", "Mapped role", "Synced"]} empty="No group mappings yet — connect Entra ID to sync." />
      </div>
      <TableCard title="Provisioned users" subtitle="Synced from Entra ID · role derived from group membership" cols="1.3fr 1.6fr 1.2fr 1fr 0.7fr" headers={["User", "Email", "Group", "Role", "Status"]} empty="No users provisioned yet." />
    </>
  );
}

// ---- STAKEHOLDERS ---------------------------------------------------------
const labelStyle: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", marginBottom: 5 };

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
          <button style={{ width: "100%", fontSize: 13.5, fontWeight: 600, color: color.primary, background: color.primaryTint, border: "1px solid #CFE0F4", padding: 11, borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>Create contact</button>
        </Card>
      </div>
    </div>
  );
}

// ---- ARCHIVE & DELETIONS --------------------------------------------------
function ArchiveSection() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <div style={sectionTitle}>Deletion requests · PMO approval</div>
          <div style={sectionSub}>Approving archives the project (not deleted). Names starting with “test” are hard-deleted directly.</div>
        </div>
        <EmptyBlock message="No pending deletion requests." />
      </Card>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <div style={sectionTitle}>Archive</div>
          <div style={sectionSub}>Recoverable by Platform Admin & PMO Lead only.</div>
        </div>
        <EmptyBlock message="Archive is empty." />
      </Card>
    </div>
  );
}

// ---- AUDIT LOG ------------------------------------------------------------
function AuditSection() {
  return (
    <TableCard title="Audit log" subtitle="Immutable, hash-chained record of platform actions" cols="1.1fr 1.2fr 1.1fr 1fr 1.6fr" headers={["Timestamp", "Actor", "Action", "Subject", "Detail"]} empty="No audit entries yet." />
  );
}

// ---- BACKUPS & RESTORE ----------------------------------------------------
function BackupsSection() {
  return (
    <>
      <div style={{ background: GRADIENT, borderRadius: radius.xxl, padding: "20px 24px", marginBottom: 18, color: "#fff", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600 }}>Backups & restore</div>
          <div style={{ fontSize: 13, color: "#C9D6EE", marginTop: 3 }}>Automatic backups and restore points across platform components.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 13px" }}>
          <span style={{ fontSize: 12.5, color: "#fff" }}>Automatic backups</span>
          <span style={{ position: "relative", width: 40, height: 22, display: "inline-block" }}>
            <span style={{ position: "absolute", inset: 0, background: "#3BD17A", borderRadius: 20 }} />
            <span style={{ position: "absolute", top: 3, right: 3, width: 16, height: 16, background: "#fff", borderRadius: "50%" }} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#3BD17A" }}>ON</span>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", color: color.primary, border: "none", borderRadius: 10, padding: "11px 17px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Icon name="download" size={16} /> Back up all now</button>
      </div>
      <div style={{ marginBottom: 18 }}>
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: BACKUP_COLS, padding: "13px 22px", borderBottom: `1px solid ${color.bg}`, ...colHeadStyle, letterSpacing: "0.04em" }}>
            <div>Component</div><div>Schedule</div><div>Retention</div><div>Size</div><div>Last backup</div><div style={{ textAlign: "right" }}>Actions</div>
          </div>
          <EmptyBlock message="No backup components configured yet." />
        </Card>
      </div>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}`, ...sectionTitle }}>Recent backup runs</div>
        <EmptyBlock message="No backup runs recorded yet." />
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
        <span style={{ width: 40, height: 40, borderRadius: radius.lg, background: "#E6EAF5", color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name={banner.icon} size={20} /></span>
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
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name={g.icon ?? "gear"} size={20} /></span>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: color.ink }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: color.faint3 }}>{g.sub}</div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#566077", background: color.bg, padding: "3px 10px", borderRadius: 20 }}>{g.steps.length} steps</span>
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
