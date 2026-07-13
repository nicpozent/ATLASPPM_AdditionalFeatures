// Pure helpers for the Statement of Applicability panel, extracted so the
// grouping/roll-up logic is unit-tested without rendering (ADR-0041 pattern).

export interface SoaControl {
  ref: string; title: string; theme: string;
  applicable: boolean; justification: string; status: string; owner: string;
}

export interface ThemeSummary {
  theme: string;
  controls: SoaControl[];
  count: number;
  applicable: number;
  implemented: number;
}

// Group controls by theme in the given theme order, dropping themes with no
// controls, and roll up per-theme applicable / implemented counts. Only
// applicable controls count toward "implemented".
export function summariseThemes(controls: SoaControl[], themes: readonly string[]): ThemeSummary[] {
  return themes
    .map((theme) => {
      const rows = controls.filter((c) => c.theme === theme);
      return {
        theme,
        controls: rows,
        count: rows.length,
        applicable: rows.filter((r) => r.applicable).length,
        implemented: rows.filter((r) => r.applicable && r.status === "Implemented").length,
      };
    })
    .filter((t) => t.count > 0);
}
