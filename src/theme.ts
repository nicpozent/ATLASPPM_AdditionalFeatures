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

// ---------------------------------------------------------------------------
//  Theming — light + dark palettes surfaced through CSS custom properties.
//
//  The `color.*` tokens below are NOT literal hex: each is a `var(--atlas-<key>,
//  <light-hex>)` reference. Every screen already applies colours through the
//  React `style` prop (element.style → CSSOM), where `var()` resolves — so
//  flipping the palette re-skins the whole app with no per-component change and
//  no global stylesheet (CLAUDE.md §3). The light hex stays embedded as the
//  fallback, so the app renders correctly even before the theme is applied and
//  the light palette (the axe-gated one, ADR-0037) is unchanged.
//
//  Dark values are chosen for WCAG AA: body/heading text ≥ 4.5:1 on the dark
//  surfaces. `chart.*` stays literal hex (below) because charts write colours as
//  SVG *presentation attributes*, where `var()` does not resolve; the vivid
//  status hues read fine on either background. See ADR-0056.
// ---------------------------------------------------------------------------
export type ThemeMode = "light" | "dark";

// The light palette is the single source of truth for the token keys AND the
// var() fallbacks (the exact values the a11y contrast gate was tuned against).
const lightColors = {
  // Brand
  primary: "#0F6CBD", primaryDark: "#0C5798", navy: "#11163A", accent: "#7A3FB0",
  // Sidebar (dark in both themes)
  sidebarBg: "#11163A", sidebarText: "#AEB6D0", sidebarMuted: "#7E88AD", sidebarLabel: "#7C86AC",
  // Text (navy/ink are heading-text tokens; navy-as-background was repointed to sidebarBg)
  ink: "#11163A", text: "#1C2233", textMuted: "#3A4358", subtle: "#5A6478",
  faint: "#5B657B", faint2: "#616A81", faint3: "#636C83",
  // Surfaces
  bg: "#EEF1F6", surface: "#ffffff", surfaceAlt: "#F8FAFD", surfaceInput: "#F1F3F8",
  // Borders
  border: "#E7EBF2", border2: "#E0E5EE", border3: "#E4E8F0",
  // Status
  success: "#15A34A", successInk: "#0B6B37", warning: "#E0A100", warningAlt: "#C98A00",
  danger: "#D13438", dangerInk: "#A1282B",
  // Tints
  primaryTint: "#EAF2FB", primaryTint2: "#E6EFFB", accentTint: "#F0E8F7", dangerTint: "#FBE7E8",
} as const;

type ColorKey = keyof typeof lightColors;

// Dark palette — same keys, re-mapped for a dark surface. Text tokens flip
// light; surfaces/borders go dark; status hues brighten slightly; tints become
// low-luminance washes. Contrast for text on `surface`/`bg` is ≥ AA.
const darkColors: Record<ColorKey, string> = {
  primary: "#4C9DE0", primaryDark: "#7FB6E8", navy: "#E8EBF5", accent: "#B98AE0",
  sidebarBg: "#0C1024", sidebarText: "#AEB6D0", sidebarMuted: "#8891B0", sidebarLabel: "#9AA3C4",
  ink: "#EDEFF6", text: "#E6E9F2", textMuted: "#B7BECE", subtle: "#9AA2B4",
  faint: "#98A0B2", faint2: "#949CAF", faint3: "#9098AB",
  bg: "#0F1320", surface: "#1A1F30", surfaceAlt: "#202537", surfaceInput: "#252B3E",
  border: "#2C3247", border2: "#333A50", border3: "#2F3548",
  success: "#35C46B", successInk: "#7BE0A5", warning: "#F0B429", warningAlt: "#E0A100",
  danger: "#F0656A", dangerInk: "#F4A0A2",
  primaryTint: "#14233A", primaryTint2: "#17273F", accentTint: "#2A2140", dangerTint: "#3A2124",
};

export const colorPalettes: Record<ThemeMode, Record<ColorKey, string>> = {
  light: { ...lightColors },
  dark: darkColors,
};

// Public token map — every value is a themeable CSS variable with the light
// value as its fallback.
export const color = Object.fromEntries(
  (Object.keys(lightColors) as ColorKey[]).map((k) => [k, `var(--atlas-${k}, ${lightColors[k]})`]),
) as Record<ColorKey, string>;

// Write the active palette's variables onto :root. Called by ThemeContext on
// mount and whenever the selected profile's mode changes.
export function applyThemeVars(mode: ThemeMode) {
  const root = document.documentElement;
  const pal = colorPalettes[mode];
  for (const k of Object.keys(pal) as ColorKey[]) root.style.setProperty(`--atlas-${k}`, pal[k]);
  root.style.colorScheme = mode;
  root.dataset.theme = mode;
}

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
