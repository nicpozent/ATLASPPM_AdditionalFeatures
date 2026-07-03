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
  sidebarLabel: "#5C6589",

  // Text
  ink: "#11163A",
  text: "#1C2233",
  textMuted: "#3A4358",
  subtle: "#5A6478",
  faint: "#7B849A",
  faint2: "#8A92A6",
  faint3: "#9AA2B4",

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

export const radius = { sm: 8, md: 9, lg: 11, xl: 14, xxl: 16 } as const;

export const layout = {
  sidebarWidth: 254,
  headerHeight: 66,
  contentMax: 1320,
} as const;
