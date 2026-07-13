import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { color } from "@/theme";
import { api } from "@/api";
import { Button, Textarea } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { toast, toastError } from "@/components/Toast";

// A team's qualitative SWOT, owned by its manager (scoped server-side). Rendered
// as a section on the My Team screen. Text-only; no personnel/individual data.
export interface TeamSwot {
  strengths: string; weaknesses: string; opportunities: string; threats: string;
  updatedAt: string; updatedBy: string;
}

type Quad = "strengths" | "weaknesses" | "opportunities" | "threats";
const QUADRANTS: { key: Quad; label: string; tint: string; ink: string; hint: string }[] = [
  { key: "strengths",     label: "Strengths",     tint: color.successTint, ink: color.successInk, hint: "What the team does well" },
  { key: "weaknesses",    label: "Weaknesses",    tint: color.dangerTint,  ink: color.dangerInk,  hint: "Where the team is stretched or has gaps" },
  { key: "opportunities", label: "Opportunities", tint: color.primaryTint, ink: color.primaryDark, hint: "Where the team could grow or add value" },
  { key: "threats",       label: "Threats",       tint: color.warningTint, ink: color.warningAlt, hint: "External risks to delivery or capacity" },
];

const emptyDraft = (s?: TeamSwot) => ({
  strengths: s?.strengths ?? "", weaknesses: s?.weaknesses ?? "",
  opportunities: s?.opportunities ?? "", threats: s?.threats ?? "",
});

export function TeamSwotPanel({ teamKey, canEdit, swot, onSaved }: {
  teamKey: string; canEdit: boolean; swot?: TeamSwot; onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => emptyDraft(swot));

  const save = useMutation({
    mutationFn: () => api(`/teams/${teamKey}/swot`, { method: "PUT", body: JSON.stringify(draft) }),
    onSuccess: () => { toast("Team SWOT saved.", "info"); setEditing(false); onSaved(); },
    onError: toastError,
  });

  return (
    <div style={{ padding: "16px 22px", borderTop: `1px solid ${color.bg}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: color.faint, letterSpacing: "0.06em", textTransform: "uppercase" }}>Team SWOT</span>
        <div style={{ flex: 1 }} />
        {swot?.updatedBy && !editing && <span style={{ fontSize: 11, color: color.faint3 }}>Updated by {swot.updatedBy}</span>}
        {canEdit && !editing && (
          <Button variant="secondary" onClick={() => { setDraft(emptyDraft(swot)); setEditing(true); }} style={{ padding: "6px 12px" }}>
            <Icon name="edit" size={14} /> Edit
          </Button>
        )}
        {editing && (
          <>
            <Button variant="secondary" onClick={() => setEditing(false)} style={{ padding: "6px 12px" }}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} style={{ padding: "6px 12px" }}>{save.isPending ? "Saving…" : "Save"}</Button>
          </>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {QUADRANTS.map((q) => (
          <div key={q.key} style={{ background: q.tint, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: q.ink, marginBottom: 7 }}>{q.label}</div>
            {editing ? (
              <Textarea
                value={draft[q.key]}
                onChange={(e) => setDraft((d) => ({ ...d, [q.key]: e.target.value }))}
                placeholder={q.hint} rows={4}
                aria-label={q.label}
                style={{ width: "100%", background: color.surface }}
              />
            ) : (
              <div style={{ fontSize: 13, color: swot?.[q.key] ? color.text : color.faint3, whiteSpace: "pre-wrap", lineHeight: 1.5, minHeight: 20 }}>
                {swot?.[q.key] || `— ${q.hint}`}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
