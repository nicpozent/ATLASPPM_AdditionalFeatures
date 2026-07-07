// ============================================================================
//  Atlas PPM — design tokens (extracted verbatim from the prototype).
//  The prototype (design/Atlas PPM.dc.html) is the single source of visual
//  truth. These tokens must match it exactly; do not invent new colors.
// ============================================================================

export const font = {
  head: "'Space Grotesk', sans-serif", // headings, numbers, titles
  body: "'Public Sans', -apple-system, sans-serif", // body copy, UI
  mono: "'Space Mono', monospace", // ids, metrics, code-ish values
} as const;

export const color = {
  // Brand
  primary: "#0F6CBD",
  primaryDark: "#0C5798",
  navy: "#11163A",
  accent: "#7A3FB0", // purple (milestones, demand pipeline)

  // Sidebar (dark)
  sidebarBg: "#11163A",
  sidebarText: "#AEB6D0",
  sidebarMuted: "#7E88AD",
  sidebarLabel: "#7C86AC", // AA on the navy sidebar/hero (#11163A); lifted from #5C6589 (ADR-0037)

  // Text
  // Muted greys lifted to WCAG AA (≥4.5:1 on white AND on the light input/alt
  // surfaces) so the browser axe contrast check can gate — see ADR-0037. The
  // prototype's airier greys (faint #7B849A / #8A92A6 / #9AA2B4) failed AA as
  // body text; these are the darkest values that stay visually close while
  // passing on #F1F3F8 / #F8FAFD.
  ink: "#11163A",
  text: "#1C2233",
  textMuted: "#3A4358",
  subtle: "#5A6478",
  faint: "#5B657B",
  faint2: "#616A81",
  faint3: "#636C83",

  // Surfaces
  bg: "#EEF1F6",
  surface: "#ffffff",
  surfaceAlt: "#F8FAFD",
  surfaceInput: "#F1F3F8",

  // Borders
  border: "#E7EBF2",
  border2: "#E0E5EE",
  border3: "#E4E8F0",

  // Status
  success: "#15A34A",
  successInk: "#0B6B37",
  warning: "#E0A100",
  warningAlt: "#C98A00",
  danger: "#D13438",
  dangerInk: "#A1282B",

  // Tints
  primaryTint: "#EAF2FB",
  primaryTint2: "#E6EFFB",
  accentTint: "#F0E8F7",
  dangerTint: "#FBE7E8",
} as const;

// Chart / status palette — exact values lifted from the prototype's chart
// builders (makeDonut, makeBudgetChart, pipeline, sparklines). Kept here so no
// screen invents its own hex; extend from the prototype only.
export const chart = {
  onTrack: "#15A34A",
  atRisk: "#E0A100",
  critical: "#D13438",
  onHold: "#8A93A6",
  planned: "#B6BECE",
  grid: "#EEF1F6",
  track: "#EEF1F6", // empty progress/bar track
  // demand pipeline stages
  pipeDraft: "#8A93A6",
  pipeBacklog: "#0F6CBD",
  pipeApproved: "#15A34A",
  pipeInProgress: "#7A3FB0",
  pipeOnHold: "#E0A100",
  // methodology chips
  method: {
    SAFe: "#0F6CBD", Waterfall: "#7A3FB0", Scrum: "#15A34A", "V-Model": "#E0A100",
    Kanban: "#0E7C7B", "Stage-Gate": "#C24A1F", Scrumban: "#5B8FCB",
  } as Record<string, string>,
} as const;

export const radius = { sm: 8, md: 9, lg: 11, xl: 14, xxl: 16 } as const;

export const layout = {
  sidebarWidth: 254,
  headerHeight: 66,
  contentMax: 1320,
} as const;
