// Shared review-gate (SecurityReviewGate) type + display constants, used by the
// Security tab's review-gates card, its modal, and the Governance tab's
// checkpoints card. Kept out of the component file so both can import them
// without a non-component export.
import { color } from "@/theme";

export interface SecReviewGate { id: number; name: string; type: string; reviewer: string; status: string; date: string; note: string; }

export const SRG_TYPES = ["Security", "Architecture", "Privacy", "Threat model", "Data protection"];
export const SRG_STATUSES = ["Scheduled", "Passed", "Failed", "Waived", "Not required"];
export const SRG_STATUS: Record<string, { ink: string; tint: string }> = {
  Passed:         { ink: color.successInk, tint: color.successTint },
  Scheduled:      { ink: color.primaryDark, tint: color.primaryTint2 },
  Failed:         { ink: color.dangerInk, tint: color.dangerTint },
  Waived:         { ink: color.warningInk, tint: color.warningTint },
  "Not required": { ink: color.subtle, tint: color.bg },
};
