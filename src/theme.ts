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
// A theme id is either the two original Atlas modes (light/dark, ADR-0056) or one
// of the three Atlas brand themes (ADR-0074). Each id maps to a full palette below
// and to a light/dark `color-scheme` (drives form-control/scrollbar rendering).
export type ThemeMode = "light" | "dark";
export type ThemeId = ThemeMode | "atlas-command" | "atlas-daylight" | "atlas-carbon";

// Feature flag — dark mode is hidden for now (toggle removed from the top bar
// and the app pinned to light) while the feature is finished off later. All the
// theming machinery below stays intact; stored per-profile preferences are left
// untouched, so flipping this back to `true` restores the feature and each
// profile's saved choice. See ADR-0056.
export const DARK_MODE_ENABLED = false;

// The light palette is the single source of truth for the token keys AND the
// var() fallbacks (the exact values the a11y contrast gate was tuned against).
const lightColors = {
  // Brand. `primary` is the foreground/accent (text, icons, borders, meters);
  // `primaryFill` is the background for white-content buttons/badges/avatars.
  // They coincide on light grounds but diverge on dark themes, where the accent
  // must be light (readable text) while the button fill must stay dark enough for
  // white text (ADR-0075).
  primary: "#0F6CBD", primaryFill: "#0F6CBD", primaryDark: "#0C5798", navy: "#11163A", accent: "#7A3FB0",
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
  warningInk: "#8A6300", danger: "#D13438", dangerInk: "#A1282B",
  holdInk: "#4A5266", holdBorder: "#8A93A6",
  // Tints (badge/chip washes — paired with the *Ink tokens above)
  primaryTint: "#EAF2FB", primaryTint2: "#E6EFFB", accentTint: "#F0E8F7", dangerTint: "#FBE7E8",
  successTint: "#E7F4EC", warningTint: "#FBF2D7", neutralTint: "#EEF1F6",
  // Tint-chip hairline borders (paired with warningTint / dangerTint)
  warnBorder: "#F0E4B8", dangerBorder: "#F3C9CB",
} as const;

type ColorKey = keyof typeof lightColors;

// Dark palette — same keys, re-mapped for a dark surface. Text tokens flip
// light; surfaces/borders go dark; status hues brighten slightly; tints become
// low-luminance washes. Contrast for text on `surface`/`bg` is ≥ AA.
const darkColors: Record<ColorKey, string> = {
  primary: "#4C9DE0", primaryFill: "#2c6fce", primaryDark: "#7FB6E8", navy: "#E8EBF5", accent: "#B98AE0",
  sidebarBg: "#0C1024", sidebarText: "#AEB6D0", sidebarMuted: "#8891B0", sidebarLabel: "#9AA3C4",
  ink: "#EDEFF6", text: "#E6E9F2", textMuted: "#B7BECE", subtle: "#9AA2B4",
  faint: "#98A0B2", faint2: "#949CAF", faint3: "#9098AB",
  bg: "#0F1320", surface: "#1A1F30", surfaceAlt: "#202537", surfaceInput: "#252B3E",
  border: "#2C3247", border2: "#333A50", border3: "#2F3548",
  success: "#35C46B", successInk: "#7BE0A5", warning: "#F0B429", warningAlt: "#E0A100",
  warningInk: "#EBC15C", danger: "#F0656A", dangerInk: "#F4A0A2",
  holdInk: "#AEB6C6", holdBorder: "#6E778F",
  primaryTint: "#14233A", primaryTint2: "#17273F", accentTint: "#2A2140", dangerTint: "#3A2124",
  successTint: "#193024", warningTint: "#332B14", neutralTint: "#2A3145",
  warnBorder: "#5C4A1E", dangerBorder: "#5A2A2E",
};

// ---------------------------------------------------------------------------
//  Atlas brand palettes (ADR-0074) — product-owner-approved themes layered onto
//  the same var()-driven mechanism as light/dark. Each is the Atlas source
//  palette (zeusthemes.css: --panel/--brandA/--accent/--ok/…) translated into
//  the Atlas token keys, with the keys Atlas doesn't define (tint washes, the
//  *Ink text-on-tint pairs, sidebar tokens) derived. Every text pair was tuned
//  to WCAG AA against the axe contrast gate (ADR-0037); `primary` doubles as the
//  white-text button background used on every page, so it's held dark enough for
//  white ≥ AA rather than matching Atlas's brighter --brandA. Charts keep their
//  literal hues (SVG presentation attributes don't resolve var()); the vivid
//  status colours read on every ground.
// ---------------------------------------------------------------------------
const atlasCommand: Record<ColorKey, string> = {
  primary: "#6fa8ef", primaryFill: "#2c6fce", primaryDark: "#9fc2f2", navy: "#eef2ff", accent: "#b79bf0",
  sidebarBg: "#0b1330", sidebarText: "#aeb6d0", sidebarMuted: "#93a0c6", sidebarLabel: "#9aa6cc",
  ink: "#eef2ff", text: "#eef2ff", textMuted: "#c6d2f0", subtle: "#aab8e0",
  faint: "#9aa8d4", faint2: "#93a2cf", faint3: "#8c9cca",
  bg: "#0a1024", surface: "#111c42", surfaceAlt: "#0e1738", surfaceInput: "#16224e",
  border: "#26315e", border2: "#2c3768", border3: "#222c56",
  success: "#37d39b", successInk: "#63e3b2", warning: "#ffb020", warningAlt: "#f0a400",
  warningInk: "#f6c15a", danger: "#ff5c7e", dangerInk: "#ff90a7",
  holdInk: "#aeb6c6", holdBorder: "#6e778f",
  primaryTint: "#16233f", primaryTint2: "#182742", accentTint: "#241c3a", dangerTint: "#3a1a26",
  successTint: "#103026", warningTint: "#2e2410", neutralTint: "#1a2140",
  warnBorder: "#4a3c18", dangerBorder: "#55232f",
};

const atlasDaylight: Record<ColorKey, string> = {
  // Light theme: accent text and button fill coincide (a mid-blue clears AA for
  // both white-on-fill and text-on-surface/bg). Held a touch darker than Atlas's
  // --brandA (#117AC0). See ADR-0074/0075.
  primary: "#0e6ab0", primaryFill: "#0e6ab0", primaryDark: "#0f5f97", navy: "#111a3a", accent: "#6a45d0",
  sidebarBg: "#111f47", sidebarText: "#c2cbe6", sidebarMuted: "#9aa6c8", sidebarLabel: "#aab4d2",
  ink: "#111a3a", text: "#111a3a", textMuted: "#3d4c72", subtle: "#546086",
  faint: "#586688", faint2: "#586688", faint3: "#566285",
  bg: "#e8eef8", surface: "#ffffff", surfaceAlt: "#f4f7fd", surfaceInput: "#eef2fb",
  border: "#dbe2ee", border2: "#d3dbea", border3: "#e0e5f0",
  success: "#0f9d68", successInk: "#0b6b47", warning: "#c77700", warningAlt: "#b26a00",
  warningInk: "#8a5400", danger: "#DE0A45", dangerInk: "#a5082f",
  holdInk: "#4a5266", holdBorder: "#8a93a6",
  primaryTint: "#e7f0fb", primaryTint2: "#e0ecfb", accentTint: "#efe9fb", dangerTint: "#fce4ea",
  successTint: "#e5f4ee", warningTint: "#f9efdc", neutralTint: "#eef2f8",
  warnBorder: "#eadcba", dangerBorder: "#f3c9d3",
};

const atlasCarbon: Record<ColorKey, string> = {
  primary: "#6fb0f5", primaryFill: "#2f6fd0", primaryDark: "#8fc0f5", navy: "#f2f4f8", accent: "#b79bf0",
  sidebarBg: "#0b0d14", sidebarText: "#aeb6c6", sidebarMuted: "#909aac", sidebarLabel: "#99a3b4",
  ink: "#f2f4f8", text: "#f2f4f8", textMuted: "#cdd3de", subtle: "#aab2c0",
  faint: "#9aa3b4", faint2: "#949eaf", faint3: "#8f99aa",
  bg: "#08090d", surface: "#101319", surfaceAlt: "#0c0f15", surfaceInput: "#151922",
  border: "#20242e", border2: "#262b36", border3: "#1c1f28",
  success: "#2fd98a", successInk: "#5fe6a6", warning: "#ffb020", warningAlt: "#f0a400",
  warningInk: "#f6c15a", danger: "#ff4d6b", dangerInk: "#ff87a0",
  holdInk: "#aeb6c6", holdBorder: "#6e778f",
  primaryTint: "#13233c", primaryTint2: "#152740", accentTint: "#221c34", dangerTint: "#331a22",
  successTint: "#0f2a20", warningTint: "#2c230f", neutralTint: "#161a24",
  warnBorder: "#463916", dangerBorder: "#4e2028",
};

export const colorPalettes: Record<ThemeId, Record<ColorKey, string>> = {
  light: { ...lightColors },
  dark: darkColors,
  "atlas-command": atlasCommand,
  "atlas-daylight": atlasDaylight,
  "atlas-carbon": atlasCarbon,
};

// Theme catalogue for the picker: display label + the light/dark `color-scheme`
// each id renders as. Light stays the default (ADR-0074). Atlas Dark is only
// offered when DARK_MODE_ENABLED (ADR-0056).
export const THEMES: Record<ThemeId, { label: string; scheme: ThemeMode }> = {
  light: { label: "Atlas Light", scheme: "light" },
  dark: { label: "Atlas Dark", scheme: "dark" },
  "atlas-command": { label: "Atlas Command", scheme: "dark" },
  "atlas-daylight": { label: "Atlas Daylight", scheme: "light" },
  "atlas-carbon": { label: "Atlas Carbon", scheme: "dark" },
};

// Ids offered in the picker, in order. Atlas Dark is conditional on its flag.
export const THEME_IDS: ThemeId[] = [
  "light",
  ...(DARK_MODE_ENABLED ? (["dark"] as ThemeId[]) : []),
  "atlas-command",
  "atlas-daylight",
  "atlas-carbon",
];

export function isThemeId(v: string | null | undefined): v is ThemeId {
  return v != null && v in THEMES;
}

// Public token map — every value is a themeable CSS variable with the light
// value as its fallback.
export const color = Object.fromEntries(
  (Object.keys(lightColors) as ColorKey[]).map((k) => [k, `var(--atlas-${k}, ${lightColors[k]})`]),
) as Record<ColorKey, string>;

// Write the active palette's variables onto :root. Called by ThemeContext on
// mount and whenever the selected profile's theme changes.
export function applyThemeVars(id: ThemeId) {
  const root = document.documentElement;
  const pal = colorPalettes[id] ?? colorPalettes.light;
  for (const k of Object.keys(pal) as ColorKey[]) root.style.setProperty(`--atlas-${k}`, pal[k]);
  const cpal = chartPalettes[id] ?? chartPalettes.light;
  for (const k of Object.keys(cpal) as (keyof typeof cpal)[]) root.style.setProperty(`--atlas-chart-${k}`, cpal[k]);
  root.style.colorScheme = (THEMES[id] ?? THEMES.light).scheme;
  root.dataset.theme = id;
}

// Chart / status palette — exact values lifted from the prototype's chart
// builders (makeDonut, makeBudgetChart, pipeline, sparklines). Kept here so no
// screen invents its own hex; extend from the prototype only.
// Chart / status palette. Ported from the prototype's chart builders. Like
// `color.*`, each flat token is a themeable `var(--atlas-chart-<key>, <light-hex>)`
// reference so charts re-skin per theme — the chart primitives apply these via the
// `style` prop (CSSOM), where var() resolves (SVG presentation attributes don't).
// Chart hues are graphics, not text, so they're not contrast-gated; per-theme
// values are tuned for harmony on each ground. `method` stays literal (brand chip
// hues that read on every ground). See ADR-0074/0076.
const lightChart = {
  onTrack: "#15A34A", atRisk: "#E0A100", critical: "#D13438", onHold: "#8A93A6",
  planned: "#B6BECE", grid: "#EEF1F6", track: "#EEF1F6",
  // demand pipeline stages
  pipeDraft: "#8A93A6", pipeBacklog: "#0F6CBD", pipeApproved: "#15A34A",
  pipeInProgress: "#7A3FB0", pipeOnHold: "#E0A100",
} as const;
type ChartKey = keyof typeof lightChart;

const darkChart: Record<ChartKey, string> = {
  onTrack: "#35C46B", atRisk: "#F0B429", critical: "#F0656A", onHold: "#6E778F",
  planned: "#4E5A78", grid: "#2C3247", track: "#252B3E",
  pipeDraft: "#6E778F", pipeBacklog: "#4C9DE0", pipeApproved: "#35C46B",
  pipeInProgress: "#B98AE0", pipeOnHold: "#F0B429",
};
const commandChart: Record<ChartKey, string> = {
  onTrack: "#37d39b", atRisk: "#ffb020", critical: "#ff5c7e", onHold: "#6e778f",
  planned: "#566490", grid: "#22305c", track: "#16233f",
  pipeDraft: "#6e778f", pipeBacklog: "#6fa8ef", pipeApproved: "#37d39b",
  pipeInProgress: "#b79bf0", pipeOnHold: "#ffb020",
};
const carbonChart: Record<ChartKey, string> = {
  onTrack: "#2fd98a", atRisk: "#ffb020", critical: "#ff4d6b", onHold: "#6e778f",
  planned: "#5e6676", grid: "#20242e", track: "#151922",
  pipeDraft: "#6e778f", pipeBacklog: "#6fb0f5", pipeApproved: "#2fd98a",
  pipeInProgress: "#b79bf0", pipeOnHold: "#ffb020",
};

export const chartPalettes: Record<ThemeId, Record<ChartKey, string>> = {
  light: { ...lightChart },
  dark: darkChart,
  "atlas-command": commandChart,
  "atlas-daylight": { ...lightChart }, // light ground — same hues as Atlas Light
  "atlas-carbon": carbonChart,
};

export const chart: Record<ChartKey, string> & { method: Record<string, string> } = {
  ...(Object.fromEntries(
    (Object.keys(lightChart) as ChartKey[]).map((k) => [k, `var(--atlas-chart-${k}, ${lightChart[k]})`]),
  ) as Record<ChartKey, string>),
  // methodology chips — literal brand hues (read on every ground; not themed)
  method: {
    SAFe: "#0F6CBD", Waterfall: "#7A3FB0", Scrum: "#15A34A", "V-Model": "#E0A100",
    Kanban: "#0E7C7B", "Stage-Gate": "#C24A1F", Scrumban: "#5B8FCB",
  },
};

export const radius = { sm: 8, md: 9, lg: 11, xl: 14, xxl: 16 } as const;

export const layout = {
  sidebarWidth: 254,
  headerHeight: 66,
  contentMax: 1320,
} as const;
