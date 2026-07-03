import { color, font, radius } from "@/theme";
import { Icon } from "./Icon";

// Placeholder shown on every not-yet-built screen. No demo data by design —
// Claude Code replaces each screen's body with the exact layout from the
// prototype (see CLAUDE.md). Empty states are intentional.
export function EmptyState({ title, subtitle, icon = "layers" }: {
  title: string; subtitle: string; icon?: string;
}) {
  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      <div
        style={{
          background: color.surface, border: `1px dashed ${color.border2}`,
          borderRadius: radius.xxl, padding: "72px 32px", textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 18px",
            background: color.primaryTint, color: color.primary,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name={icon} size={26} />
        </div>
        <div style={{ fontFamily: font.head, fontSize: 20, fontWeight: 600, color: color.ink, marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: color.subtle, maxWidth: 460, margin: "0 auto", lineHeight: 1.5 }}>
          {subtitle}
        </div>
        <div style={{ marginTop: 18, fontFamily: font.mono, fontSize: 12, color: color.faint3 }}>
          Build this screen 1:1 from design/Atlas&nbsp;PPM.dc.html
        </div>
      </div>
    </div>
  );
}
