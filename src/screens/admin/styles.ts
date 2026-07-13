// Shared Admin section styles, factored out so Admin.tsx and the extracted
// section modules (ADR-0041) use one source of truth instead of duplicating.
import type React from "react";
import { color, font } from "@/theme";

export const GRADIENT = "linear-gradient(115deg,#11163A,#0F6CBD)";
export const sectionTitle: React.CSSProperties = { fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink };
export const sectionSub: React.CSSProperties = { fontSize: 12, color: color.faint2, marginTop: 2 };
export const colHeadStyle: React.CSSProperties = { fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 };
