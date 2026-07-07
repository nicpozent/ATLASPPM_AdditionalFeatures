// Shared presentational helper for the Resources tabs.
import { color, font } from "@/theme";
import { Icon } from "@/components/Icon";

export function EmptyPanel({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, padding: "56px 24px", textAlign: "center" }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
        <Icon name={icon} size={22} />
      </div>
      <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>{title}</div>
      <div style={{ fontSize: 13, color: color.faint2, marginTop: 4, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>{message}</div>
    </div>
  );
}
