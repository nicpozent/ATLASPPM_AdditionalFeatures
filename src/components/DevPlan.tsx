import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Button, Textarea, Field, Modal } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { toast, toastError } from "@/components/Toast";

// A manager's development note for one team member. Development-focused framing
// (strengths / growth areas / goals — no "weaknesses/threats"). Manager-scoped
// and manager-visible only; never shown to the individual (ADR-0062).
export interface DevPlan {
  strengths: string; growthAreas: string; goals: string; updatedAt: string; updatedBy: string;
}

export function DevPlanModal({ person, plan, onClose, onSaved }: {
  person: string; plan?: DevPlan; onClose: () => void; onSaved: () => void;
}) {
  const [strengths, setStrengths] = useState(plan?.strengths ?? "");
  const [growthAreas, setGrowthAreas] = useState(plan?.growthAreas ?? "");
  const [goals, setGoals] = useState(plan?.goals ?? "");

  const save = useMutation({
    mutationFn: () => api("/devplans", { method: "PUT", body: JSON.stringify({ person, strengths, growthAreas, goals }) }),
    onSuccess: () => { toast("Development plan saved.", "info"); onSaved(); },
    onError: toastError,
  });

  return (
    <Modal onClose={onClose} width={520} label={`Development plan — ${person}`}>
      <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>Development plan</div>
      <div style={{ fontSize: 12.5, color: color.faint2 }}>{person}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: color.subtle, background: color.bg, borderRadius: 8, padding: "7px 10px", margin: "11px 0 16px" }}>
        <Icon name="shield" size={13} /> Visible to managers only — not shown to the team member.
      </div>
      <Field label="Strengths">{(id) => <Textarea id={id} value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} placeholder="What they do well" />}</Field>
      <Field label="Growth areas" style={{ marginTop: 12 }}>{(id) => <Textarea id={id} value={growthAreas} onChange={(e) => setGrowthAreas(e.target.value)} rows={3} placeholder="Where to develop next" />}</Field>
      <Field label="Goals" style={{ marginTop: 12 }}>{(id) => <Textarea id={id} value={goals} onChange={(e) => setGoals(e.target.value)} rows={3} placeholder="Agreed development goals" />}</Field>
      {plan?.updatedBy && <div style={{ fontSize: 11, color: color.faint3, marginTop: 10 }}>Last updated by {plan.updatedBy}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </Modal>
  );
}
