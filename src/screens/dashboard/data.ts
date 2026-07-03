// ============================================================================
//  Dashboard data layer.
//  Structural constants (KPI set, pipeline stages, health segments, widget
//  catalogue) are chrome and live here. Actual values come from the API via
//  useDashboard(); with no backend the query resolves to an empty dataset and
//  every screen renders its empty state (see CLAUDE.md § "No data").
// ============================================================================
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";
import { color, chart } from "@/theme";

// ---- domain types ----------------------------------------------------------
export interface KpiValue { value: string; delta: string; good: boolean; spark: number[]; }
export interface ProjectRow {
  id: string; name: string; dept: string; owner: string; methodology: string;
  status: "green" | "amber" | "red" | "hold"; health: string; progress: number;
  budget: number; spent: number;
}
export interface PipelineStage { count: number; }
export interface HealthSegment { value: number; }
export interface AttentionItem { id: string; name: string; reason: string; severity: "red" | "amber"; }
export interface ActivityEvent { who: string; action: string; time: string; initials: string; color: string; }
export interface TaskRow { name: string; sprint: string; status: string; }
export interface ApprovalRow { id: string; title: string; requester: string; dept: string; value: number; }

export interface DashboardData {
  kpis: Record<string, KpiValue>;
  health: Record<string, HealthSegment>;
  budget: { allocated: string; spent: string; spentPct: number; months: string[]; planned: number[]; actual: number[]; max: number } | null;
  pipeline: Record<string, PipelineStage>;
  projects: ProjectRow[];
  attention: AttentionItem[];
  activity: ActivityEvent[];
  tasks: TaskRow[];
  approvals: ApprovalRow[];
}

// ---- structural constants (labels/colors are chrome, not data) -------------
export const KPI_DEFS = [
  { key: "active",  label: "Active Projects",     color: color.primary },
  { key: "ontrack", label: "On Track",            color: chart.onTrack },
  { key: "risk",    label: "At Risk / Critical",  color: chart.critical },
  { key: "demands", label: "Pending Demands",     color: color.accent },
  { key: "budget",  label: "Budget Utilised",     color: chart.atRisk },
] as const;

export const HEALTH_SEGMENTS = [
  { key: "ontrack",  label: "On track", color: chart.onTrack },
  { key: "atrisk",   label: "At risk",  color: chart.atRisk },
  { key: "critical", label: "Critical", color: chart.critical },
  { key: "onhold",   label: "On hold",  color: chart.onHold },
] as const;

export const PIPELINE_STAGES = [
  { key: "draft",      label: "Draft",       color: chart.pipeDraft },
  { key: "backlog",    label: "Backlog",     color: chart.pipeBacklog },
  { key: "approved",   label: "Approved",    color: chart.pipeApproved },
  { key: "inprogress", label: "In Progress", color: chart.pipeInProgress },
  { key: "onhold",     label: "On Hold",     color: chart.pipeOnHold },
] as const;

export const LAYOUT_TABS = [
  { id: "executive",   label: "Executive",   hint: "High-level health, budget & status for leadership." },
  { id: "operational", label: "Operational", hint: "Your priorities, tasks & approvals for delivery teams." },
  { id: "compact",     label: "Compact",     hint: "Dense, list-first view for power users." },
  { id: "custom",      label: "Custom",      hint: "Drag widgets from the palette to build your own view." },
] as const;
export type LayoutId = (typeof LAYOUT_TABS)[number]["id"];

// Widget catalogue for the custom-dashboard builder (from prototype widgetDefs()).
export interface WidgetDef { key: string; title: string; icon: string; span: 1 | 2; cat: string; desc: string; }
export const WIDGET_DEFS: WidgetDef[] = [
  { key: "health",       title: "Portfolio health",   icon: "layers",   span: 1, cat: "Portfolio & strategy", desc: "Traffic-light donut" },
  { key: "health-trend", title: "Health trend",       icon: "trendUp",  span: 1, cat: "Portfolio & strategy", desc: "On-track % over time" },
  { key: "ontime",       title: "On-time delivery",   icon: "check",    span: 1, cat: "Portfolio & strategy", desc: "Milestones hit rate" },
  { key: "by-method",    title: "Projects by method", icon: "template", span: 1, cat: "Portfolio & strategy", desc: "Methodology mix" },
  { key: "by-phase",     title: "Projects by phase",  icon: "gantt",    span: 1, cat: "Portfolio & strategy", desc: "Lifecycle stage" },
  { key: "risk",         title: "Risk exposure (RAID)", icon: "alert",  span: 1, cat: "Portfolio & strategy", desc: "Risks/issues/deps" },
  { key: "kpi-active",   title: "KPI · Active",       icon: "barChart", span: 1, cat: "KPI tiles", desc: "Active projects" },
  { key: "kpi-ontrack",  title: "KPI · On track",     icon: "barChart", span: 1, cat: "KPI tiles", desc: "On-track %" },
  { key: "kpi-risk",     title: "KPI · At risk",      icon: "barChart", span: 1, cat: "KPI tiles", desc: "At-risk count" },
  { key: "kpi-demands",  title: "KPI · Demands",      icon: "barChart", span: 1, cat: "KPI tiles", desc: "Pending demands" },
  { key: "kpi-budget",   title: "KPI · Budget used",  icon: "barChart", span: 1, cat: "KPI tiles", desc: "Utilisation %" },
  { key: "projects",     title: "Active projects",    icon: "grid",     span: 2, cat: "Projects", desc: "Status list" },
  { key: "attention",    title: "Needs attention",    icon: "alert",    span: 1, cat: "Projects", desc: "At-risk projects" },
  { key: "milestones",   title: "Upcoming milestones", icon: "flag",    span: 1, cat: "Projects", desc: "Next key dates" },
  { key: "deps",         title: "Dependency risk",    icon: "link",     span: 1, cat: "Projects", desc: "Inherited risk" },
  { key: "pipeline",     title: "Demand pipeline",    icon: "inbox",    span: 1, cat: "Delivery", desc: "Stage breakdown" },
  { key: "mytasks",      title: "My tasks",           icon: "list",     span: 1, cat: "Delivery", desc: "Assigned to me" },
  { key: "epics",        title: "Epic progress",      icon: "layers",   span: 1, cat: "Delivery", desc: "Stories done" },
  { key: "burndown",     title: "Sprint burndown",    icon: "trendUp",  span: 1, cat: "Delivery", desc: "Remaining work" },
  { key: "blockers",     title: "Blockers summary",   icon: "flag",     span: 1, cat: "Delivery", desc: "Active / resolved" },
  { key: "activity",     title: "Recent activity",    icon: "clock",    span: 1, cat: "Delivery", desc: "Latest events" },
  { key: "capacity",     title: "Resource utilisation", icon: "users",  span: 2, cat: "Resources", desc: "Allocation + over-alloc" },
  { key: "budget",       title: "Budget burn",        icon: "trendUp",  span: 2, cat: "Financial", desc: "Planned vs actual" },
  { key: "spend-div",    title: "Spend by division",  icon: "building", span: 1, cat: "Financial", desc: "Cost by unit" },
  { key: "budget-table", title: "Budget vs actual",   icon: "sheet",    span: 2, cat: "Financial", desc: "Per project" },
];
export const DEFAULT_WIDGETS = ["health", "kpi-active", "kpi-risk", "budget", "pipeline"];

export const EMPTY_DASHBOARD: DashboardData = {
  kpis: {}, health: {}, budget: null, pipeline: {},
  projects: [], attention: [], activity: [], tasks: [], approvals: [],
};

// ---- hook ------------------------------------------------------------------
// Fetches the dashboard rollup. Until the endpoint exists (no backend) the
// query resolves to the empty dataset rather than erroring, so the screen shows
// tasteful empty states by default (never fabricated seed data).
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<DashboardData> => {
      try {
        const data = await api<DashboardData>("/dashboard");
        return data ?? EMPTY_DASHBOARD;
      } catch {
        return EMPTY_DASHBOARD;
      }
    },
  });
}
