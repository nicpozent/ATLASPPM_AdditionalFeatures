using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

// ============================================================================
//  Help centre — data-driven. Role-based guides and error-category
//  troubleshooting entries are served from the database, seeded with a curated
//  baseline (reference content, like the RBAC matrix) and editable by a Platform
//  Admin. Troubleshooting entries are keyed by the error-code prefix the request
//  logger stamps on failures (SRV/INT/…), so the error UI can deep-link to them.
// ============================================================================
public static class Help
{
    // The five error categories the app surfaces, with real remediation steps.
    static readonly (string Code, string Title, string Symptom, string Body)[] Troubleshooting =
    {
        ("NET", "Connection problem",
            "The app can’t reach the server — actions hang or fail with a network error.",
            "1. Check your internet connection and retry.\n2. If you’re on VPN, confirm it’s connected.\n3. Reload the page.\n4. If it persists across the whole app, the API may be down — quote the time to your administrator, who can check the service and gateway logs."),
        ("AUTH", "Sign-in or permission issue",
            "You’re signed out unexpectedly, or an action is refused because your role lacks access.",
            "1. If asked to sign in, complete the Entra sign-in and try again.\n2. If an action says your role can’t do it, that’s by design — ask a Platform Admin to grant the capability in Administration → Roles & permissions.\n3. Admins: verify the user’s Entra app role and the roles & permissions matrix."),
        ("VAL", "Something you entered wasn’t accepted",
            "A form was rejected with a message explaining what needs fixing.",
            "1. Read the message — it names the field or rule (e.g. a required name, a valid date, an item already on the list).\n2. Correct the input and submit again.\n3. This is not a bug; no error code is issued for these."),
        ("SRV", "Unexpected error on our end",
            "An action failed with a friendly message and an error code (SRV-…).",
            "1. Try the action again — many transient errors clear on retry.\n2. If it repeats, copy the error code (SRV-…) and give it to your administrator.\n3. Admins: search the application logs for that exact code to find the full exception, request path and role."),
        ("INT", "An integration didn’t respond",
            "A connected system (Jira, Azure DevOps, Microsoft Graph, email) failed or timed out; you’ll see an INT-… code.",
            "1. The integration, not Atlas, is likely unavailable — retry shortly.\n2. Copy the error code (INT-…) for your administrator.\n3. Admins: check the connector’s credentials/consent and status in Integrations, then search the logs for the code to see the upstream response."),
    };

    // Role-based guide catalogue: title, one-line summary, and a full step-by-step
    // body. Curated baseline — admins edit or add their own from Help & Support.
    // "all" guides orient everyone (shown under the Getting started tab).
    static readonly (string Audience, string Title, string Summary, string Body)[] Guides =
    {
        // ---- Getting started (everyone) --------------------------------------
        ("all", "What Atlas is, in one minute",
            "The single place to plan, run and report on the portfolio.",
            "Atlas is Birgma’s portfolio & project management platform. It brings demands, projects, programs, products, releases, resources, financials and governance into one place so everyone works from the same picture.\n\n• The left sidebar is your map — Workspace (day-to-day delivery) at the top, Configuration (setup & admin) below.\n• The top bar shows your name and role. Switching role changes what you can see and do.\n• Most screens start empty and fill as real data arrives from the API and connected tools (Jira, Entra ID). Empty is normal on a fresh tenant — it is not an error."),
        ("all", "Find your way around the sidebar",
            "What each Workspace and Configuration section is for.",
            "Workspace:\n• Dashboard — your at-a-glance view (Executive, Operational, Compact or a Custom layout you build).\n• Portfolio / Programs / Products — the things you deliver, grouped how leadership thinks about them.\n• OKRs — strategy: objectives and key results linked to the work that delivers them.\n• Demand Pipeline — new requests, scored on value vs effort, awaiting triage and approval.\n• Timeline/Gantt & PI Planning — scheduling: phases, milestones, sprints, and quarterly increment planning.\n• Resources & Financials — people/capacity and budget vs actual.\n• Delivery Status, Releases, Weekly Updates — reporting and communication.\n\nConfiguration:\n• My Team, Methodologies, Integrations, Reports, Administration, Help."),
        ("all", "Understand your role and what you can do",
            "Why some buttons are visible to others but not to you.",
            "Atlas enforces permissions on the server, per capability (projects, schedule, approvals, integrations, quality, and so on). If you don’t see an edit or approve button, your role doesn’t have that capability — this is by design, not a fault.\n\nThe header role switcher changes your identity and the menu you see. Your actual rights come from the roles & permissions matrix a Platform Admin manages in Administration. To request more access, contact your PMO or a Platform Admin and name the exact action you need."),
        ("all", "What the traffic lights and pills mean",
            "Green / amber / red, and the common status chips.",
            "Health: green = on track, amber = at risk, red = critical, grey = on hold. It reflects schedule, budget and rolled-up dependency/blocker risk.\n\nStatus chips vary by object: demands move Draft → Backlog → Approved → In progress → On hold; sprints are Planned/Started/Halted/Completed/Cancelled; gates run G0–G5. Hover a chip or open the item to see detail."),
        ("all", "Getting help fast",
            "Search here, use the error code, or contact the PMO.",
            "1. Search this help centre (box at the top) — it covers every guide and troubleshooting entry.\n2. If you hit an error, note the code (e.g. SRV-… or INT-…). The message links straight to the matching troubleshooting entry here.\n3. Still stuck? Use ‘Contact the PMO’ on this page and include the error code, the screen you were on, the time, and what you expected — that gets you a faster answer."),

        // ---- Install & Operations (detailed, step-by-step) --------------------
        ("install", "Overview: what you're installing",
            "The three containers, the database, and what talks to what.",
            "Atlas runs as three containers plus a database:\n\n• web — nginx serving the built React app and reverse-proxying /api to the API (so the browser is same-origin; no CORS).\n• api — the .NET 8 service; applies database migrations automatically on start.\n• db — PostgreSQL 16 (or a managed PostgreSQL you point at).\n\nOutbound, the API talks to Microsoft Entra ID (sign-in + directory + mail) and, optionally, Jira Cloud. TLS terminates at your load balancer/ingress (or in the web container).\n\nSupported hosts: any Linux VM with Docker, or Windows Server with Docker in Linux-container mode. Follow, in order: (1) install Docker on your host, (2) provision PostgreSQL, (3) configure .env, (4) bring Atlas up, (5) smoke-test. Each has its own guide below."),

        ("install", "Install Docker on Windows Server (step by step)",
            "Windows Server 2019/2022 with Docker in Linux-container mode.",
            "Atlas images are Linux containers, so you need Linux-container mode (via WSL2), not Windows containers.\n\nPrerequisites: Windows Server 2019 or 2022, fully patched; virtualization enabled in BIOS/hypervisor (nested virtualization if this is itself a VM); local administrator; internet or an internal mirror.\n\n1. Open PowerShell as Administrator.\n2. Install WSL2 (kernel + default distro):\n   wsl --install\n   Reboot when prompted, then set the default version:\n   wsl --set-default-version 2\n3. (If 'wsl --install' isn't available on older builds) enable the features manually, then reboot:\n   Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -All\n   Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All\n4. Install a Docker engine. Two supported options:\n   a) Docker Desktop for Windows (needs a commercial licence for large orgs): download the installer, run it, choose the WSL2 backend, finish, and sign in.\n   b) Docker Engine inside a WSL2 Ubuntu distro (no Desktop licence): run 'wsl --install -d Ubuntu', open the Ubuntu shell, then follow the Linux VM guide's apt steps inside it.\n5. Verify from an elevated PowerShell (Desktop) or the Ubuntu shell (engine):\n   docker version\n   docker run --rm hello-world\n   docker compose version\n6. Make Docker start on boot (Desktop: Settings → General → 'Start Docker Desktop when you log in', and set the service to run at startup; Engine-in-WSL: enable the docker service with 'sudo systemctl enable --now docker').\n7. Put the Docker data-root on a data disk with room to grow, and open inbound TCP 80/443 in Windows Firewall:\n   New-NetFirewallRule -DisplayName 'Atlas HTTP' -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow\n   New-NetFirewallRule -DisplayName 'Atlas HTTPS' -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow\n\nTroubleshooting: if containers fail to start with a virtualization error, confirm Hyper-V/VirtualMachinePlatform are enabled and (on a VM) nested virtualization is on. 'wsl --status' should report version 2."),

        ("install", "Install Docker on a Linux VM (step by step)",
            "Ubuntu/Debian and RHEL/Alma/Rocky, from the official repos.",
            "Prerequisites: a 64-bit Linux VM (2 vCPU / 4 GB RAM minimum, more for production), sudo access, outbound internet or an internal mirror.\n\n— Ubuntu 22.04/24.04 or Debian 12 —\n1. Refresh and add prerequisites:\n   sudo apt-get update\n   sudo apt-get install -y ca-certificates curl gnupg\n2. Add Docker's official GPG key:\n   sudo install -m 0755 -d /etc/apt/keyrings\n   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg\n   sudo chmod a+r /etc/apt/keyrings/docker.gpg\n3. Add the repository:\n   echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null\n4. Install engine + compose plugin:\n   sudo apt-get update\n   sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin\n5. Enable and start:\n   sudo systemctl enable --now docker\n6. Run docker without sudo (re-login after):\n   sudo usermod -aG docker $USER\n7. Verify:\n   docker run --rm hello-world\n   docker compose version\n\n— RHEL 9 / AlmaLinux / Rocky —\n1. sudo dnf -y install dnf-plugins-core\n2. sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo\n3. sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin\n4. sudo systemctl enable --now docker\n5. sudo usermod -aG docker $USER  (re-login)\n\nFirewall (Ubuntu ufw): sudo ufw allow 80/tcp && sudo ufw allow 443/tcp.\nFirewall (RHEL firewalld): sudo firewall-cmd --permanent --add-service=http --add-service=https && sudo firewall-cmd --reload.\nProduction: put Docker's data-root on a dedicated disk, enable log rotation (json-file max-size/max-file in /etc/docker/daemon.json), and keep the OS patched."),

        ("install", "Provision the PostgreSQL database",
            "Bundled container for simple installs, or managed PostgreSQL for production.",
            "Atlas uses PostgreSQL (via the Npgsql provider). If you're coming from SQL Server, note the connection-string format differs and the engine is PostgreSQL 16 — the app's schema is created and evolved automatically by EF Core migrations on API start.\n\nOption A — bundled container (simplest):\n• docker-compose.yml already defines a 'db' service on postgres:16-alpine with a named volume 'atlas_db'. Set POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB in .env. Good for pilots and small installs; back up the volume.\n\nOption B — managed PostgreSQL (recommended for production; e.g. Azure Database for PostgreSQL Flexible Server, AWS RDS/Aurora, or your DBA's cluster):\n1. Create a PostgreSQL 16 server in the same region/network as the app.\n2. Create the database and a dedicated login:\n   CREATE DATABASE atlas;\n   CREATE ROLE atlas_app LOGIN PASSWORD '<strong-secret>';\n   GRANT CONNECT ON DATABASE atlas TO atlas_app;\n3. Require TLS and restrict network access to the app subnet/security group only.\n4. Point Atlas at it (env or Docker secret), TLS on:\n   ConnectionStrings__Postgres=Host=<host>;Port=5432;Database=atlas;Username=atlas_app;Password=<strong-secret>;SSL Mode=Require;Trust Server Certificate=false\n5. Apply least privilege: after the first boot creates the schema, run deploy/postgres-least-privilege.sql to scope the app role to only what it needs (no superuser).\n6. Backups: enable the provider's automated backups + point-in-time restore, or schedule pg_dump (see 'Back up and restore PostgreSQL'). Test a restore quarterly.\n\nEither way, migrations run automatically when the API starts — no manual DDL. Watch 'docker compose logs api' on first boot to confirm they applied."),

        ("install", "Bring Atlas up with Docker Compose",
            "Configure .env, TLS and start the stack; then smoke-test.",
            "1. Put the release on the host (git clone or copy the build) and create your environment file:\n   cp .env.example .env\n2. Edit .env and set at minimum:\n   • POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB (bundled db), or ConnectionStrings__Postgres for a managed DB.\n   • Auth: Auth__Enabled=true, Auth__TenantId, Auth__Audience; and the SPA's VITE_AUTH_ENABLED=true + VITE_AUTH_* values (see 'Configure Entra ID SSO').\n   • Optional: Jira__BaseUrl/Email/ApiToken; Graph__* + Notifications__SenderUpn for email; OTEL_EXPORTER_OTLP_ENDPOINT for observability.\n3. TLS: terminate at your load balancer/ingress (recommended) and forward to the web container, or place a certificate for nginx. For a local trial, deploy/gen-dev-cert.sh creates a self-signed cert (the browser will warn — expected).\n4. Start the stack:\n   docker compose up -d --build\n   For production secrets via Docker secrets, add the overlay:\n   docker compose -f docker-compose.yml -f docker-compose.secrets.yml up -d\n5. The api container applies migrations on start; the web container serves the app behind nginx.\n6. Smoke-test:\n   curl -k https://<host>/api/v1/health        → healthy (liveness)\n   curl -k https://<host>/api/v1/health/ready  → healthy (database reachable)\n   Open https://<host>/ in a browser and complete sign-in.\n7. Leave Seed__Enabled unset/false in production — Atlas starts empty and fills from the API/Jira/Entra. Set it true only on a throwaway demo tenant.\n\nIf a container is unhealthy, 'docker compose logs api' and 'docker compose logs db' show why (most first-run issues are a wrong connection string or missing Auth values — the API deliberately fails fast if Auth is enabled but misconfigured)."),

        ("install", "Upgrade Atlas to a new release",
            "Roll forward safely; how to roll back.",
            "1. Read the release notes for any migration or config changes.\n2. Back up the database first (see 'Back up and restore PostgreSQL') — always, before an upgrade.\n3. Fetch the new version (git pull / new image tags) and redeploy:\n   docker compose up -d --build\n   The api applies any new EF migrations automatically on start.\n4. Verify /api/v1/health and /health/ready, then click through the key screens.\n5. Roll back: redeploy the previous image tag/commit. If a migration changed the schema in a breaking way, restore the pre-upgrade database backup as well — which is why step 2 matters. Always rehearse an upgrade in staging before production."),

        ("install", "Back up and restore PostgreSQL",
            "Dump, store, and rehearse a restore.",
            "Managed PostgreSQL: enable the provider's automated backups and point-in-time restore; that's your primary path. Still rehearse a restore.\n\nSelf-hosted / bundled container:\n1. Logical backup (portable):\n   docker compose exec -T db pg_dump -U <user> -Fc atlas > atlas-$(date +%F).dump\n   Store it off-host, encrypted, with a retention aligned to policy.\n2. Restore into a scratch database to verify the backup is usable (do NOT overwrite production to test):\n   createdb -U <user> atlas_restore\n   pg_restore -U <user> -d atlas_restore atlas-YYYY-MM-DD.dump\n   Boot an API instance against atlas_restore and confirm it starts and reads data.\n3. Volume snapshots (bundled db) are a coarser alternative: snapshot the 'atlas_db' volume/disk while quiesced.\n4. In Atlas, Administration → Backups → 'Back up all now' records a BackupRun marker and is a good operational checkpoint, but the database dump/snapshot above is the actual recoverable artifact.\n\nSchedule backups (cron or the provider), monitor that they succeed, and test a full restore at least quarterly."),

        // ---- Platform Admin ---------------------------------------------------
        ("admin", "Install the application tier",
            "Step-by-step deployment of the API and web front end.",
            "1. Provision PostgreSQL and set the connection string (Docker secret or env var) — see the deployment docs in the repo.\n2. Deploy the .NET API; it applies EF Core migrations automatically on start.\n3. Build the web front end (npm run build) and serve it behind nginx, same-origin with the API under /api.\n4. Confirm /health (liveness) and /health/ready (DB reachable) both return healthy.\n5. Set Seed:Enabled=true only for a demo/walkthrough tenant; leave it off in production so you start clean."),
        ("admin", "Configure Entra ID SSO and enforce MFA",
            "Wire single sign-on and require multi-factor authentication.",
            "1. Register the app in Entra ID; add the SPA redirect URI and expose the API scope.\n2. Set VITE_AUTH_ENABLED=true and the VITE_AUTH_* client/tenant/scope values for the front end.\n3. On the API, enable auth and validate the audience/issuer.\n4. Require MFA via a Conditional Access policy in Entra — Atlas honours it automatically through the sign-in.\n5. Sign in end-to-end with a test account before rolling out."),
        ("admin", "Schedule and test platform backups",
            "Set up snapshots and verify a restore.",
            "1. In Administration → Backups, run ‘Back up all now’ to confirm the job works and record a BackupRun.\n2. Schedule regular database snapshots at the infrastructure layer (managed Postgres or a cron’d pg_dump to secure storage).\n3. Quarterly, restore the latest snapshot into a scratch database and boot the API against it to prove the backup is usable.\n4. Keep retention aligned with the data-retention policy."),
        ("admin", "Map AD groups to Atlas roles",
            "Sync directory groups and assign the manager slots.",
            "1. In Administration → Teams, run ‘Sync now’ to pull Entra ID groups and members.\n2. Map each directory group to its manager slot (Engineering, Service, Developers, Infrastructure).\n3. Confirm the hierarchy roll-up looks right on My Team.\n4. People then appear as onboarded; unmapped assignees are flagged so you can spot gaps."),
        ("admin", "Connect Jira & Azure DevOps",
            "Discovery, import and board-optional sync.",
            "1. In Integrations, add the connector credentials (Jira: email + API token; ADO: PAT).\n2. Use ‘Test connection’ to confirm access.\n3. On a project, set its Jira project key. A board id is optional — with a board you also get sprints; without one, issues import by project key alone (a Jira ‘space’ maps fine).\n4. Run Discovery to preview what will import, then sync. Assignees not synced from Entra are flagged so you can onboard them."),
        ("admin", "Assign people as project stakeholders",
            "Give stakeholders their scoped view.",
            "1. Open a project and add the person as a stakeholder, or mark the project stakeholder-visible.\n2. Stakeholders get the reduced navigation — only their own projects/demands plus Delivery, Releases, Weekly Updates and Help.\n3. Verify by switching to the Stakeholder identity in the header."),
        ("admin", "Enable notification email",
            "Grant Mail.Send and set the sender mailbox.",
            "1. Grant the app the Microsoft Graph Mail.Send permission and admin-consent it.\n2. Set Graph:* credentials and Notifications:SenderUpn (the mailbox mail is sent from).\n3. Send a test notification and confirm delivery. Until this is configured, notifications still appear in-app; only email is skipped."),

        // ---- PMO --------------------------------------------------------------
        ("pmo", "How traffic-light health is calculated",
            "Status roll-up including dependency risk.",
            "Health combines schedule variance, budget burn vs plan, and rolled-up risk from open blockers and dependencies. A project with a blocked hard dependency is pulled toward amber/red even if its own tasks are on track. Programs and products roll up from their linked projects. You can set a manual RAG where judgement should override the formula (e.g. OKRs)."),
        ("pmo", "Build a custom dashboard",
            "Drag-and-drop widgets into your own layout.",
            "1. On Dashboard, choose the Custom layout from the segmented control.\n2. Drag widgets from the palette into the canvas; rearrange or remove them.\n3. Your layout is remembered. Use Reset to return to the default set."),
        ("pmo", "Run a portfolio review export",
            "Branded PPTX/PDF/Excel/HTML packs.",
            "1. Go to Reports and pick the report (portfolio, demand, blocker, audit).\n2. Choose the format — PowerPoint for a board pack, Excel for data, PDF/HTML for sharing.\n3. Generate and download. The pack is branded and reflects live data at export time."),
        ("pmo", "Configure demand scoring & edit fields",
            "Tune the value-vs-effort intake model.",
            "1. On Demand Pipeline, open a demand to see its value and effort scores that position it in the funnel.\n2. Edit the scoring fields to reflect business value, criticality, risk and expected benefit.\n3. Approvals are restricted to Platform Admin and PMO; comments can be added by Platform Admin, PMO and the Chief Architect."),
        ("pmo", "Map a risk to a control",
            "Framework → control → sub-control mapping.",
            "1. In the governance/security area, open the control framework (GDPR, ISO 27001, SOC 2, NIS2, EU AI Act, and the product regs DPP/PPWR/EUDR).\n2. Link the risk or RAID item to the relevant control and sub-control.\n3. Track the control’s lifecycle status so audit evidence stays current."),
        ("pmo", "Build the Weekly Updates news wall",
            "Themes, widgets and image uploads.",
            "1. Open Weekly Updates and switch on edit mode.\n2. Add blocks — headline, highlight metric, shout-out, image, milestone, document — and arrange the masonry layout.\n3. Pick a theme and publish. Stakeholders see the curated wall read-only."),

        // ---- Project Manager --------------------------------------------------
        ("pm", "Create a project from a template",
            "Auto-scaffold phases, gates, epics and tasks.",
            "1. Go to Methodologies and start the create-project wizard.\n2. Pick a methodology (Waterfall, Scrum, SAFe, Stage-Gate, Kanban, …); the template scaffolds the right phases, gates and starter structure.\n3. Set name, department and owner, then wire any integration.\n4. The new project opens with its methodology-specific tabs ready to fill."),
        ("pm", "Push a task to Jira or Azure DevOps",
            "Send a scaffolded task to your tracker.",
            "1. Ensure the project is connected (project key set in Integrations).\n2. Create or open a task and use the push action to send it to the tracker.\n3. Subsequent syncs reconcile status back into Atlas; assignees not onboarded from Entra are flagged."),
        ("pm", "Read velocity, capacity & backlog",
            "By source (Jira/ADO/SDP/API).",
            "On the project’s Tasks/Sprint tabs you’ll see per-sprint points, completion and spillover. Velocity is the delivered points trend; capacity comes from resource allocations. The backlog is everything not yet assigned to a sprint — attach items to a sprint or an epic from there."),
        ("pm", "Use the Resource & Sprint Gantt",
            "Views and filters for planning.",
            "1. Open Timeline/Gantt and choose the scope (Project or Program) and the view (Schedule, Resources, Sprints, category views).\n2. Sprints appear as a single duration bar you can expand to see their tasks.\n3. Add milestones and see dependency arrows across the month grid; export when you need a static copy."),
        ("pm", "Track dependencies & rolled-up risk",
            "How dependency risk affects status.",
            "Log dependencies on the project and, for cross-team ones, on PI Planning → Dependencies. A blocked or at-risk dependency rolls up into the dependent item’s health, so a red upstream item can turn a downstream project amber. Keep owners and due dates current so the roll-up is meaningful."),
        ("pm", "Raise and resolve a blocker",
            "Log it and map it to a control.",
            "1. On the project’s Blockers tab (or from a task), add the blocker with a clear title, description and owner.\n2. Move it through Active → In progress → Resolved; cancel or archive when appropriate.\n3. Blockers feed dashboards and delivery reports, so resolving them updates status automatically."),

        // ---- Team Member ------------------------------------------------------
        ("team", "Update task status and log progress",
            "Move work across the board.",
            "1. Open your project’s Tasks tab (board or list view).\n2. Drag a card between columns, or open it to change status, assignee, points, size and dates.\n3. Progress rolls up into the sprint, epic and project health automatically."),
        ("team", "@mention a teammate in a comment",
            "Collaborate and notify.",
            "1. Open the item (task, demand, blocker) and add a comment.\n2. Type @ and pick a teammate to notify them.\n3. They’ll get a notification (and email, if configured) and can reply in thread."),
        ("team", "Raise a blocker on your task",
            "Flag an impediment for help.",
            "1. From your task, raise a blocker describing what’s stopping you and who might help.\n2. It appears on the project’s Blockers tab and in reports so your PM can act.\n3. Update it as things change; mark it resolved when unblocked."),
        ("team", "Subscribe to notifications",
            "Follow the items you care about.",
            "1. Use the subscribe control on a project or item to follow it.\n2. Tune what you receive in notification preferences.\n3. The bell in the top bar shows your notification centre; email is sent too when the admin has enabled it."),

        // ---- Executive --------------------------------------------------------
        ("exec", "Read the executive dashboard",
            "High-level portfolio health and spend.",
            "The Executive layout shows the portfolio-health donut, budget burn, KPI cards with sparklines, the active-projects table, what needs attention, the demand pipeline and recent activity. Use it for a 30-second read of where the portfolio stands; click through any card to the detail."),
        ("exec", "Approve a demand or stage gate",
            "Record your governance decision.",
            "1. Open the demand awaiting approval, or the stage gate up for review.\n2. Review the scoring/criteria and the decision log.\n3. Record your decision — it’s captured in the audit log and moves the item forward. Demand approvals are limited to Platform Admin and PMO; gate reviews follow the governance model."),
        ("exec", "Read delivery status by period",
            "Weekly to yearly stakeholder reporting.",
            "On Delivery Status, pick a reporting period (weekly through yearly). You’ll see completed/in-progress/planned work, velocity, on-time %, cleared vs open blockers, milestones and budget burn — the stakeholder view without project-level noise."),
        ("exec", "Export a board-ready status deck",
            "Branded organisation report.",
            "1. Go to Reports and choose the portfolio or delivery report.\n2. Export as PowerPoint for a branded, board-ready deck (or PDF/HTML to share).\n3. It reflects live data at the moment you export."),

        // ---- Resourcing & allocation (PM / PMO) ------------------------------
        ("pm", "Allocate people with dates and hours",
            "Percent or hours, a start/end window, and extensions.",
            "On a project/program/product/release, open the Team panel.\n1. Attach a sub-team, or use ‘Assign individual’ to add one person (from the directory or typed).\n2. For each person set allocation as a % or as weekly hours — 40 h/week = 100%, and the % preview updates live.\n3. Set a start and end date so the allocation is time-phased: it only counts while it's live, so utilisation and availability are correct per date, not a flat lifetime sum.\n4. If the work runs long, click ‘Add extension’ to log extra hours over its own dates — tracked separately so the original plan stays intact.\nEverything rolls up into Resources (Project %) and the project's Team capacity."),
        ("pm", "Find who's free (availability finder)",
            "Plan staffing by date or window.",
            "Resources → Availability.\n1. Choose ‘On a date’ or ‘Across a window’ and pick the date(s).\n2. Each person shows a stacked bar of their load by project/program/release/product/ops, and their free %.\n3. Booked time-off (the vacation calendar) marks a person unavailable.\n4. In window mode, ‘free’ is the capacity free across the whole window (100% − peak load) — i.e. who you can staff for the entire period. Use the ‘min. free’ filter to shortlist.\n5. PI Planning → Capacity also shows team availability across the selected increment's dates, so you can plan staffing for the PI."),
        ("pmo", "Export the allocation histogram to Excel",
            "Colour-graded utilisation by period.",
            "Resources → pick a period (day/week/month/quarter/half/year) → ‘Export .xlsx’.\nYou get a colour-graded workbook: rows are people, columns are periods, each cell is the average % utilisation over that period (green→amber→red; over 100% is red), and the cell comment holds the underlying person-days. A ‘Total (days)’ column sums each person's effort. Use it for capacity planning and month/quarter reviews."),
        ("team", "Keep the team skills matrix",
            "Customizable competencies, 0–4, with Excel export.",
            "My Team → Skills & competency matrix.\n1. Add your own skill columns (there's no fixed list).\n2. Rate each team member 0–4 per skill.\n3. It covers the people you manage; Platform Admin/PMO see everyone.\n4. ‘Export’ downloads a colour-graded Excel (blue ramp by level). Ratings feed skills-based staffing views.\n5. Each project/program/product/release Overview also shows a read-only ‘Team skills’ panel with the ratings of the people assigned there."),

        // ---- Ops (run-the-business) ------------------------------------------
        ("pm", "Track operational (run-the-business) work",
            "Ops services and work items, and their drag on delivery.",
            "The Ops section is for run-the-business work that isn't project delivery (support, maintenance, monitoring, infrastructure).\n1. Create an Ops service, then add work items (type, priority, status, assignee, and an allocation %).\n2. A work item's allocation rolls up into that person's Ops% on Resources — so BAU load counts against their capacity.\n3. Tag an item with an ‘impact project’ to show, on that project's Overview, the operational load pulling capacity off its delivery. Editing Ops needs the Operational-work capability."),

        // ---- Roadmap ---------------------------------------------------------
        ("pmo", "Plan the strategic roadmap",
            "Now / Next / Later horizons and a time-based timeline.",
            "The Roadmap section is for strategic, portfolio-level planning above individual projects.\n1. Add an initiative and place it on a horizon — Now, Next or Later. Give it a theme (swimlane), owner, status, and a confidence %, plus value and effort (1–5) for prioritisation.\n2. Set start/end dates to also see it on the ‘Timeline’ view (toggle top-left): dated initiatives are laid out by month in theme swimlanes, with milestone diamonds; undated ones stay on the board.\n3. Add milestones, mark dependencies on other initiatives (the board shows what blocks what), and link the initiative to OKRs, projects, programs, products or releases.\n4. On the board you can drag a card between horizons to re-plan it. Editing the roadmap needs the Roadmap capability; everyone can read it."),

        // ---- Platform admin: privacy & Jira ----------------------------------
        ("admin", "Handle a GDPR data-subject request",
            "Export, erase, and run retention from Administration.",
            "Administration → Data Privacy (Platform Admin only).\n• Export (DSAR): pick a person (or type a name/email/user key) and download every record Atlas holds about them as portable JSON (GDPR Art. 15 & 20).\n• Erase (right to be forgotten): irreversibly anonymises every record referencing that subject (Art. 17) — confirm-gated.\n• Run retention now: anonymises records past the retention window on demand (a daily background pass also runs).\nMatching is exact (case-insensitive) on name/email/key, and every action is audited."),
        ("admin", "What syncs from Jira",
            "Full issue import, comments and attachments.",
            "Map a project to a Jira project key (and, for sprints, a board id) in the project's details. Sync pulls the full issue record — description, issue type, reporter, exact status, resolution, labels/components/fix-versions, parent & epic keys, logged time, timestamps and a deep link — plus comments and downloaded attachments, all shown in the task's ‘Jira details’ panel. Re-sync is idempotent (upserts by Jira id, never touches Atlas-created rows). Toggle comments/attachments and the file-size cap with the Jira import settings. Sprints (past & current) come across too — a board id gives the richest sprint metadata, but with just a project key Atlas now derives sprints from the issues themselves."),
    };

    public static async Task SeedAsync(AtlasDbContext db)
    {
        if (await db.HelpArticles.AnyAsync()) { await ReconcileAsync(db); return; }
        var ord = 0;
        foreach (var g in Guides)
            db.HelpArticles.Add(new HelpArticle { Kind = "guide", Audience = g.Audience, Title = g.Title, Summary = g.Summary, Body = g.Body, Ord = ord++ });
        ord = 0;
        foreach (var t in Troubleshooting)
            db.HelpArticles.Add(new HelpArticle { Kind = "troubleshooting", Code = t.Code, Title = t.Title, Summary = t.Symptom, Body = t.Body, Ord = ord++ });
        await db.SaveChangesAsync();
    }

    // Bring an already-seeded DB up to the current baseline after an upgrade:
    //  • add any troubleshooting category missing (keeps error-code links resolving);
    //  • add any new baseline guide missing (by audience + title);
    //  • fill in the full body for baseline guides still holding only the one-line
    //    summary (the old seed set Body = Summary) — WITHOUT touching a guide an
    //    admin has already expanded or edited.
    public static async Task ReconcileAsync(AtlasDbContext db)
    {
        var changed = false;

        var have = (await db.HelpArticles.Where(a => a.Kind == "troubleshooting").Select(a => a.Code).ToListAsync()).ToHashSet();
        var ord = 100;
        foreach (var t in Troubleshooting)
            if (!have.Contains(t.Code))
            {
                db.HelpArticles.Add(new HelpArticle { Kind = "troubleshooting", Code = t.Code, Title = t.Title, Summary = t.Symptom, Body = t.Body, Ord = ord++ });
                changed = true;
            }

        var guides = await db.HelpArticles.Where(a => a.Kind == "guide").ToListAsync();
        var byKey = guides.GroupBy(g => (g.Audience, g.Title)).ToDictionary(k => k.Key, k => k.First());
        var gOrd = 200;
        foreach (var g in Guides)
        {
            if (!byKey.TryGetValue((g.Audience, g.Title), out var existing))
            {
                db.HelpArticles.Add(new HelpArticle { Kind = "guide", Audience = g.Audience, Title = g.Title, Summary = g.Summary, Body = g.Body, Ord = gOrd++ });
                changed = true;
            }
            // Upgrade only untouched baseline rows (body never expanded past the summary).
            else if (existing.Body == existing.Summary && existing.Body != g.Body)
            {
                existing.Body = g.Body;
                changed = true;
            }
        }

        if (changed) await db.SaveChangesAsync();
    }

    static readonly string[] Kinds = { "guide", "troubleshooting" };

    static HelpArticleDto Dto(HelpArticle a) => new(a.Id, a.Kind, a.Audience, a.Code, a.Title, a.Summary, a.Body, a.Ord);

    public static void MapHelpEndpoints(this RouteGroupBuilder api)
    {
        // The whole catalogue, split by kind. Readable by anyone signed in.
        api.MapGet("/help", async (AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            var all = await db.HelpArticles.OrderBy(a => a.Ord).ThenBy(a => a.Id).ToListAsync();
            return Results.Ok(new HelpDto(
                Permissions.IsPlatformAdmin(http, cfg),
                all.Where(a => a.Kind == "guide").Select(Dto).ToList(),
                all.Where(a => a.Kind == "troubleshooting").Select(Dto).ToList()));
        });

        // The troubleshooting entry for an error code (accepts the full code or the
        // prefix — the error UI passes e.g. "SRV-3F9K2A").
        api.MapGet("/help/troubleshooting/{code}", async (string code, AtlasDbContext db) =>
        {
            var prefix = (code.Split('-')[0]).ToUpperInvariant();
            var a = await db.HelpArticles.FirstOrDefaultAsync(x => x.Kind == "troubleshooting" && x.Code == prefix);
            return a is null ? Results.NotFound() : Results.Ok(Dto(a));
        });

        // ---- Admin authoring (Platform Admin) -----------------------------
        api.MapPost("/help/articles", async (UpsertHelpReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!Permissions.IsPlatformAdmin(http, cfg)) return Results.Json(new { error = "Only a Platform Administrator can edit the help centre." }, statusCode: StatusCodes.Status403Forbidden);
            if (!Kinds.Contains(req.Kind)) return Results.BadRequest(new { error = "Kind must be ‘guide’ or ‘troubleshooting’." });
            if (string.IsNullOrWhiteSpace(req.Title)) return Results.BadRequest(new { error = "A title is required." });
            var a = new HelpArticle
            {
                Kind = req.Kind, Audience = req.Audience?.Trim() ?? "", Code = req.Code?.Trim().ToUpperInvariant() ?? "",
                Title = req.Title.Trim(), Summary = req.Summary?.Trim() ?? "", Body = req.Body?.Trim() ?? "",
                Ord = req.Ord ?? 999,
            };
            db.HelpArticles.Add(a);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Help", "Added article", a.Title));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/help/articles/{a.Id}", Dto(a));
        });

        api.MapPatch("/help/articles/{id:int}", async (int id, UpsertHelpReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!Permissions.IsPlatformAdmin(http, cfg)) return Results.Json(new { error = "Only a Platform Administrator can edit the help centre." }, statusCode: StatusCodes.Status403Forbidden);
            var a = await db.HelpArticles.FindAsync(id);
            if (a is null) return Results.NotFound();
            if (!string.IsNullOrWhiteSpace(req.Title)) a.Title = req.Title.Trim();
            if (req.Summary is not null) a.Summary = req.Summary.Trim();
            if (req.Body is not null) a.Body = req.Body.Trim();
            if (req.Audience is not null) a.Audience = req.Audience.Trim();
            if (req.Ord is int o) a.Ord = o;
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Help", "Edited article", a.Title));
            await db.SaveChangesAsync();
            return Results.Ok(Dto(a));
        });

        api.MapDelete("/help/articles/{id:int}", async (int id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!Permissions.IsPlatformAdmin(http, cfg)) return Results.Json(new { error = "Only a Platform Administrator can edit the help centre." }, statusCode: StatusCodes.Status403Forbidden);
            var a = await db.HelpArticles.FindAsync(id);
            if (a is null) return Results.NotFound();
            // Keep the troubleshooting categories intact — they back the error links.
            if (a.Kind == "troubleshooting") return Results.BadRequest(new { error = "Troubleshooting categories can be edited but not deleted." });
            db.HelpArticles.Remove(a);
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Help", "Deleted article", a.Title));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
