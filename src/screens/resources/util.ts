// Non-component style helper for the Resources tabs.
import type React from "react";
import { color } from "@/theme";

export const selectStyle: React.CSSProperties = {
  border: `1px solid ${color.border2}`, borderRadius: 8, padding: "6px 10px", fontSize: 12.5,
  fontWeight: 600, fontFamily: "inherit", color: color.text, background: "#fff", cursor: "pointer",
};
