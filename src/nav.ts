// ============================================================================
//  Navigation, screen metadata, and roles — mirrors the prototype exactly.
//  Each screen id maps 1:1 to a section in design/Atlas PPM.dc.html.
// ============================================================================

export type ScreenId =
  | "dashboard" | "portfolio" | "programs" | "products" | "okrs" | "roadmap"
  | "demands" | "gantt" | "pip" | "project" | "resources" | "financials"
  | "delivery" | "releases" | "ops" | "news"
  | "teams" | "methodologies" | "integrations" | "reports" | "admin" | "help"
  | "myprojects" | "mydemands";

export interface ScreenMeta {
  id: ScreenId;
  path: string;
  label: string;      // sidebar label
  title: string;      // header title
  subtitle: string;   // header subtitle
  icon: string;       // Icon name (see components/Icon.tsx)
  badge?: string;     // e.g. Demand Pipeline "18"
}

// Full page catalogue (header title/subtitle taken from the prototype's titles map).
export const SCREENS: Record<ScreenId, ScreenMeta> = {
  dashboard:     { id: "dashboard",     path: "/",              label: "Dashboard",        title: "Dashboard",                    subtitle: "Executive, operational, compact & custom dashboards", icon: "grid" },
  portfolio:     { id: "portfolio",     path: "/portfolio",     label: "Portfolio",        title: "Portfolio",                    subtitle: "24 active projects across 7 divisions",              icon: "layers" },
  programs:      { id: "programs",      path: "/programs",      label: "Programs",         title: "Programs",                     subtitle: "Aggregate projects under strategic programs",        icon: "folders" },
  products:      { id: "products",      path: "/products",      label: "Products",         title: "Products",                     subtitle: "Product portfolio · Jira/ADO tasks mapped to releases", icon: "box" },
  okrs:          { id: "okrs",          path: "/okrs",          label: "OKRs",             title: "OKRs & Strategic Alignment",   subtitle: "Objectives linked to projects, programs & products", icon: "target" },
  roadmap:       { id: "roadmap",       path: "/roadmap",       label: "Roadmap",          title: "Strategic Roadmap",            subtitle: "Now / Next / Later horizons & time-based timeline",  icon: "route" },
  demands:       { id: "demands",       path: "/demands",       label: "Demand Pipeline",  title: "Demand Pipeline",              subtitle: "Open demands awaiting triage & approval",            icon: "inbox" },
  gantt:         { id: "gantt",         path: "/timeline",      label: "Timeline / Gantt", title: "Timeline / Gantt",             subtitle: "Schedule, phases, milestones & dependencies",        icon: "gantt" },
  pip:           { id: "pip",           path: "/pi-planning",   label: "PI Planning",      title: "Program Increment Planning",   subtitle: "Quarterly PI objectives, calendar, capacity & dependencies", icon: "calendar" },
  project:       { id: "project",       path: "/project",       label: "Project Detail",   title: "Project Detail",               subtitle: "Tasks, epics, artifacts, RAID & collaboration",      icon: "folder" },
  resources:     { id: "resources",     path: "/resources",     label: "Resources",        title: "Resources & Capacity",         subtitle: "People synced from Entra ID · allocation vs availability", icon: "users" },
  financials:    { id: "financials",    path: "/financials",    label: "Financials",       title: "Financials",                   subtitle: "Budget vs actual · CapEx/OpEx · benefits & ROI",     icon: "coins" },
  delivery:      { id: "delivery",      path: "/delivery",      label: "Delivery Status",  title: "Delivery Status",              subtitle: "Stakeholder delivery report · pick a reporting period", icon: "trendUp" },
  releases:      { id: "releases",      path: "/releases",      label: "Releases",         title: "Releases",                     subtitle: "Release calendar & deployment tracking",             icon: "rocket" },
  ops:           { id: "ops",           path: "/ops",           label: "Ops",              title: "Operational Work",             subtitle: "Run-the-business services & work · impact on projects", icon: "activity" },
  news:          { id: "news",          path: "/updates",       label: "Weekly Updates",   title: "Weekly Updates",               subtitle: "Portfolio news wall · curated by the PMO",           icon: "megaphone" },
  teams:         { id: "teams",         path: "/team",          label: "My Team",          title: "My Team",                      subtitle: "Your team members & their skills",                   icon: "users" },
  methodologies: { id: "methodologies", path: "/methodologies", label: "Methodologies",    title: "Methodology Library",          subtitle: "Waterfall, Agile, hybrid & SDLC templates",          icon: "template" },
  integrations:  { id: "integrations",  path: "/integrations",  label: "Integrations",     title: "Integrations & Settings",      subtitle: "Connectors, SSO, email & directory sync",            icon: "plug" },
  reports:       { id: "reports",       path: "/reports",       label: "Reports",          title: "Reports",                      subtitle: "Branded portfolio, demand, blocker & audit reports", icon: "barChart" },
  admin:         { id: "admin",         path: "/admin",         label: "Administration",   title: "Administration",               subtitle: "Platform management · roles, backups, guides",       icon: "shieldUser" },
  help:          { id: "help",          path: "/help",          label: "Help & Support",   title: "Help & Support",               subtitle: "Role-based guides, articles & contact",              icon: "help" },
  myprojects:    { id: "myprojects",    path: "/my-projects",   label: "My Projects",      title: "My Projects",                  subtitle: "Projects where you are a stakeholder",               icon: "layers" },
  mydemands:     { id: "mydemands",     path: "/my-demands",    label: "My Demands",       title: "My Demands",                   subtitle: "Submit a demand and track its status",               icon: "inbox" },
};

// Sidebar groups per role family (mirrors the prototype's navMain / navConfig).
export const NAV_MAIN: ScreenId[] = [
  "dashboard", "portfolio", "programs", "products", "okrs", "roadmap",
  "demands", "gantt", "pip", "project", "resources", "financials",
  "delivery", "releases", "ops", "news",
];
export const NAV_CONFIG: ScreenId[] = [
  "teams", "methodologies", "integrations", "reports", "admin", "help",
];

// Stakeholder sees a reduced set.
export const NAV_STAKEHOLDER_MAIN: ScreenId[] = ["myprojects", "mydemands", "delivery", "releases", "news"];
export const NAV_STAKEHOLDER_CONFIG: ScreenId[] = ["help"];

// Roles shown in the header switcher (cosmetic in the prototype; the API enforces
// the 6 canonical roles — see CLAUDE.md § Roles).
export interface RoleIdentity { value: string; label: string; name: string; roleLabel: string; initials: string; }
export const ROLES: RoleIdentity[] = [
  { value: "admin",       label: "Platform Administrator",   name: "Anders Lindgren",  roleLabel: "Platform Administrator", initials: "AL" },
  { value: "pmo",         label: "PMO Lead",                 name: "Astrid Holmqvist", roleLabel: "Head of PMO",            initials: "AH" },
  { value: "pm",          label: "Project Manager",          name: "Karin Sandberg",   roleLabel: "Project Manager",        initials: "KS" },
  { value: "pmlead",      label: "PM Lead",                  name: "Lars Møller",      roleLabel: "PM Lead",                initials: "LM" },
  { value: "teammgr",     label: "Global Engineering Manager", name: "Mette Sørensen", roleLabel: "Global Engineering Manager", initials: "MS" },
  { value: "svcmgr",      label: "Global Service Manager",   name: "Petter Haugen",    roleLabel: "Global Service Manager", initials: "PH" },
  { value: "devmgr",      label: "Developers Manager",       name: "Johan Virtanen",   roleLabel: "Developers Manager",     initials: "JV" },
  { value: "inframgr",    label: "Infrastructure Manager",   name: "Erik Lindqvist",   roleLabel: "Infrastructure Manager", initials: "EL" },
  { value: "architect",   label: "Chief Architect",          name: "Ingrid Aalto",     roleLabel: "Chief Architect",        initials: "IA" },
  { value: "cto",         label: "CTO",                      name: "Henrik Dahl",      roleLabel: "Chief Technology Officer", initials: "HD" },
  { value: "cio",         label: "CIO",                      name: "Ida Nyström",      roleLabel: "Chief Information Officer", initials: "IN" },
  { value: "qmgr",        label: "Quality Manager",          name: "Nina Koskinen",    roleLabel: "Quality Manager",        initials: "NK" },
  { value: "stakeholder", label: "Stakeholder",              name: "Sofia Berg",       roleLabel: "Business Stakeholder",   initials: "SB" },
];
