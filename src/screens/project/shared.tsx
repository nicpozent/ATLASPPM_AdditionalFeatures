// Small presentational helpers shared across the Project detail tabs. Extracted
// from Project.tsx so the individual tab modules can live in their own files
// (see project/*.tsx). No behaviour change — these are the same components.
import React from "react";
import { color, font } from "@/theme";

export function PdField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

export function ChipRow({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: color.faint2, minWidth: 76 }}>{label}</span>
      {items.map((it) => (
        <span key={it} style={{ fontSize: 11.5, fontWeight: 600, color: color.textMuted, background: color.bg, border: `1px solid ${color.border2}`, borderRadius: 6, padding: "2px 8px" }}>{it}</span>
      ))}
    </div>
  );
}

export function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ fontSize: 11, color: color.faint2, minWidth: 76 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: color.text }}>{children}</span>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink, marginBottom: 12 }}>{children}</div>;
}

export function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}


export function DecLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>{children}</label>;
}

