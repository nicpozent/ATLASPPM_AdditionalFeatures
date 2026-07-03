// ============================================================================
//  Shared inline-styled primitives used across screens. These mirror the
//  recurring card / pill / progress / empty patterns in the prototype so
//  screens stay consistent without a CSS framework.
// ============================================================================
import React from "react";
import { color, font, radius, chart } from "@/theme";

export function Card({ children, style, padding = 20, onClick }: {
  children: React.ReactNode; style?: React.CSSProperties; padding?: number | string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      background: color.surface, border: `1px solid ${color.border}`,
      borderRadius: radius.xxl, padding, ...style,
    }}>{children}</div>
  );
}

export function CardHeader({ title, subtitle, right }: {
  title: string; subtitle?: string; right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: color.faint2, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function Chip({ label, ink = color.textMuted, tint = color.bg }: {
  label: string; ink?: string; tint?: string;
}) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, color: ink, background: tint,
      padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

export function ProgressBar({ pct, fill = color.primary, height = 6, track = chart.track }: {
  pct: number; fill?: string; height?: number; track?: string;
}) {
  return (
    <div style={{ flex: 1, height, background: track, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: fill, borderRadius: 4 }} />
    </div>
  );
}

// Small empty-state block shown inside a card body when there's no data.
export function EmptyBlock({ message, minHeight = 96 }: { message: string; minHeight?: number }) {
  return (
    <div style={{
      minHeight, display: "flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", color: color.faint3, fontSize: 13, padding: "18px 12px",
    }}>{message}</div>
  );
}

const HEALTH_COLORS: Record<string, { ink: string; tint: string }> = {
  green: { ink: "#0B6B37", tint: "#E7F4EC" },
  amber: { ink: "#8A6300", tint: "#FBF2D7" },
  red:   { ink: "#A1282B", tint: "#FBE7E8" },
  hold:  { ink: "#4A5266", tint: "#EEF1F6" },
};
export function HealthPill({ status, label }: { status: string; label: string }) {
  const c = HEALTH_COLORS[status] ?? HEALTH_COLORS.hold;
  return <Chip label={label} ink={c.ink} tint={c.tint} />;
}

export function statusDot(status: string): string {
  return { green: chart.onTrack, amber: chart.atRisk, red: chart.critical, hold: chart.onHold }[status] ?? chart.onHold;
}
