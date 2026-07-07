// Non-component helpers for the Project tabs (kept out of shared.tsx so that
// file only exports components — clean React fast-refresh).
import type React from "react";
import { color, font } from "@/theme";

export const sectionTitleS: React.CSSProperties = { fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink };

export const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;
