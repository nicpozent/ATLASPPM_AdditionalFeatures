import { color } from "@/theme";
import { Icon } from "./Icon";
import { useI18n, LOCALES, type LocaleCode } from "@/i18n";

// Topbar language selector — mirrors the role switcher's styling. Choosing a
// language re-renders the UI chrome instantly and persists the choice.
export function LanguagePicker() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: color.surfaceInput, border: `1px solid ${color.border3}`,
      borderRadius: 9, padding: "8px 12px",
    }}>
      <span style={{ color: color.primary, display: "flex" }}><Icon name="globe" size={16} /></span>
      <span style={{ fontSize: 11, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {t("common.language", "Language")}
      </span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as LocaleCode)}
        aria-label={t("common.language", "Language")}
        style={{
          border: "none", background: "transparent", fontSize: 13, fontWeight: 600,
          color: color.ink, fontFamily: "inherit", cursor: "pointer", outline: "none",
        }}
      >
        {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </div>
  );
}
