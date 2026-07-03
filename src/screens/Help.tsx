import { useState } from "react";
import { color, font, radius } from "@/theme";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/ui";

// ---------------------------------------------------------------------------
// Help & Support — built 1:1 from the prototype (design/Atlas PPM.dc.html,
// lines 2431-2479). The role-based guide topics and popular-article lists are
// STRUCTURAL chrome (a fixed help catalogue, not backend data) and render in
// full; only live search / ticketing are wired to the API later.
// ---------------------------------------------------------------------------

type HelpRole = "admin" | "pmo" | "pm" | "team" | "exec";

const ROLE_TABS: { id: HelpRole; label: string }[] = [
  { id: "admin", label: "Platform Admin" },
  { id: "pmo", label: "PMO" },
  { id: "pm", label: "Project Manager" },
  { id: "team", label: "Team Member" },
  { id: "exec", label: "Executive" },
];

type RoleHelp = { intro: string; topics: [string, string, number][]; articles: string[] };

const HELP_DATA: Record<HelpRole, RoleHelp> = {
  admin: {
    intro: "Install, configure and operate the platform.",
    topics: [["Installation & deployment", "server", 9], ["SSO & identity (Entra ID)", "key", 7], ["Email via Exchange Online", "mail", 5], ["AD users & groups sync", "users", 6], ["Integrations setup", "plug", 12], ["Connector write-back (Jira/ADO)", "plug", 4], ["Backups & restore", "database", 8], ["Roles & permissions", "shieldUser", 7], ["Stakeholder assignment", "userCheck", 3], ["Audit & security", "lock", 5]],
    articles: ["Step-by-step: install the application tier", "Configure Entra ID SSO and enforce MFA", "Schedule and test platform backups", "Map AD groups to Atlas roles", "Connecting Jira & Azure DevOps (2-way + write-back)", "Assign people as project stakeholders", "Pull branded reports in PPTX/PDF/Excel/HTML"],
  },
  pmo: {
    intro: "Govern the portfolio and demand pipeline.",
    topics: [["Portfolio dashboards", "grid", 8], ["Build a custom dashboard", "barChart", 6], ["Demand intake, scoring & editing", "inbox", 8], ["Approvals & stage gates", "check", 5], ["Methodology templates", "template", 6], ["Risk → control mapping", "shield", 5], ["Delivery status (weekly→yearly)", "trendUp", 5], ["Weekly Updates / News Wall", "megaphone", 5], ["Branded exports & reporting", "download", 6], ["Monthly project reports", "barChart", 4], ["Resource capacity & allocation", "users", 5]],
    articles: ["How traffic-light health is calculated (incl. dependency rollup)", "Build your own dashboard with 25 drag-and-drop widgets", "Run a portfolio review export (PPTX/PDF/Excel/HTML)", "Configure the demand scoring model & edit demand fields", "Map a risk to a control (framework → control → sub-control)", "Build the Weekly Updates news wall (themes, widgets, uploads)", "Generate a monthly project report"],
  },
  pm: {
    intro: "Plan and deliver your projects.",
    topics: [["Gantt: schedule, resources & sprints", "gantt", 10], ["Project & sprint Gantt filters", "filter", 4], ["Build a custom dashboard", "barChart", 6], ["Tasks, epics & sprints", "list", 8], ["Create project from template", "template", 5], ["Push a task to Jira / Azure DevOps", "plug", 4], ["Velocity, capacity & backlog health", "trendUp", 5], ["Managing artifacts", "sheet", 6], ["Dependencies & aggregated status", "link", 5], ["RAID, blockers & control mapping", "alert", 6], ["Comments & collaboration", "message", 3]],
    articles: ["Create a project from a methodology template (auto-scaffold tasks)", "Push a scaffolded task to Jira or Azure DevOps", "Read velocity/capacity/backlog by source (Jira/ADO/SDP/API)", "Use Resource & Sprint Gantt views and filters", "Track dependencies; how dependency risk rolls up to status", "Raise and resolve a blocker; map it to a control"],
  },
  team: {
    intro: "Get your day-to-day work done.",
    topics: [["My tasks & sprint board", "grid", 6], ["Build a custom dashboard", "barChart", 6], ["Delivery status dashboard", "trendUp", 4], ["Weekly Updates wall", "megaphone", 3], ["Updating progress", "check", 4], ["Commenting & mentions", "message", 4], ["Raising a blocker", "alert", 3], ["Notifications", "bell", 3]],
    articles: ["Update task status and log progress", "Build your own dashboard with drag-and-drop widgets", "Read the delivery status dashboard for your period", "@mention a teammate in a comment", "Raise a blocker on your task"],
  },
  exec: {
    intro: "Oversight, approvals and board reporting.",
    topics: [["Executive dashboard", "trendUp", 5], ["Build a custom dashboard", "barChart", 6], ["Delivery status (weekly→yearly)", "trendUp", 5], ["Weekly Updates wall", "megaphone", 3], ["Approving demands & gates", "check", 4], ["Reading portfolio & aggregated health", "shield", 4], ["Board-ready exports", "building", 4]],
    articles: ["Read the executive dashboard", "Read delivery status across reporting periods", "Approve a demand or stage gate", "How dependency risk affects portfolio health", "Export an organisation status deck (branded)"],
  },
};

export default function Help() {
  const [role, setRole] = useState<HelpRole>("admin");
  const hd = HELP_DATA[role];

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      {/* hero */}
      <div style={{ background: "linear-gradient(115deg,#11163A,#0F6CBD)", borderRadius: 18, padding: "34px 32px", marginBottom: 24, color: "#fff", textAlign: "center" }}>
        <div style={{ fontFamily: font.head, fontSize: 25, fontWeight: 600, marginBottom: 7 }}>How can we help?</div>
        <div style={{ fontSize: 14, color: "#C9D6EE", marginBottom: 20 }}>Search guides, articles and release notes — or reach the PMO support team.</div>
        <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 11, padding: "12px 16px" }}>
          <span style={{ color: color.faint3, display: "flex" }}><Icon name="search" size={18} /></span>
          <span style={{ fontSize: 14, color: color.faint3 }}>Search the help centre…</span>
        </div>
      </div>

      {/* role selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#56607A" }}>Help for my role:</span>
        <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2, flexWrap: "wrap" }}>
          {ROLE_TABS.map((rt) => {
            const active = role === rt.id;
            return (
              <button key={rt.id} onClick={() => setRole(rt.id)} style={{
                padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
                background: active ? "#fff" : "transparent", color: active ? color.primary : "#6A7488",
                boxShadow: active ? "0 1px 3px rgba(20,26,60,0.12)" : "none",
              }}>{rt.label}</button>
            );
          })}
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: color.faint, marginBottom: 18 }}>{hd.intro}</div>

      {/* topic categories */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
        {hd.topics.map(([name, icon, count]) => (
          <div key={name} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: 19, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: radius.lg, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name={icon} size={20} /></div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: color.ink, lineHeight: 1.25 }}>{name}</div>
              <div style={{ fontSize: 12, color: color.faint3 }}>{count} articles</div>
            </div>
          </div>
        ))}
      </div>

      {/* popular articles + contact */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}`, fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Popular articles</div>
          {hd.articles.map((art) => (
            <div key={art} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 22px", borderBottom: "1px solid #F2F4F9", cursor: "pointer" }}>
              <span style={{ color: color.primary, display: "flex" }}><Icon name="book" size={18} /></span>
              <span style={{ flex: 1, fontSize: 14, color: color.text }}>{art}</span>
              <span style={{ color: "#C2C8D4", display: "flex" }}><Icon name="chevronRight" size={16} /></span>
            </div>
          ))}
        </Card>
        <Card padding={22}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "#E7F4EC", color: "#0B6B37", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Icon name="message" size={20} /></div>
          <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, marginBottom: 6 }}>Contact the PMO</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: color.subtle, marginBottom: 16 }}>Can't find an answer? Raise a ticket and the Atlas support team will respond within one business day.</div>
          <button style={{ width: "100%", fontSize: 13.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: 11, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", marginBottom: 9 }}>Open a support ticket</button>
          <button style={{ width: "100%", fontSize: 13.5, fontWeight: 600, color: color.textMuted, background: "#fff", border: `1px solid ${color.border2}`, padding: 11, borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>Chat with us</button>
        </Card>
      </div>
    </div>
  );
}
