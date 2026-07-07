import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Card, Button, Input, Select, EmptyBlock } from "./ui";

interface Stakeholder { id: number; name: string; role: string; power: string; interest: string; }
type Level = "High" | "Low";

// Power/interest quadrant classification (Mendelow).
function quadrant(power: string, interest: string): { label: string; dot: string; tint: string } {
  if (power === "High" && interest === "High") return { label: "Manage closely", dot: "#D13438", tint: "#FBE7E8" };
  if (power === "High") return { label: "Keep satisfied", dot: "#C98A00", tint: "#FBF2D7" };
  if (interest === "High") return { label: "Keep informed", dot: "#0F6CBD", tint: "#E6EFFB" };
  return { label: "Monitor", dot: "#565F73", tint: "#EEF1F6" };
}

// Persisted power/interest stakeholder matrix for a project or program.
export function StakeholderMatrixCard({ scopeType, scopeId }: { scopeType: "project" | "program"; scopeId: string | null }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [power, setPower] = useState<Level>("High");
  const [interest, setInterest] = useState<Level>("High");
  const key = ["stakeholders", scopeType, scopeId];

  const { data } = useQuery({
    queryKey: key, enabled: !!scopeId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; stakeholders: Stakeholder[] }> =>
      (await api<{ canEdit: boolean; stakeholders: Stakeholder[] }>(`/stakeholder-matrix/${scopeType}/${scopeId}`)) ?? { canEdit: false, stakeholders: [] },
  });
  const stakeholders = data?.stakeholders ?? [];
  const canEdit = data?.canEdit ?? false;

  const add = useMutation({
    mutationFn: () => api(`/stakeholder-matrix/${scopeType}/${scopeId}`, { method: "POST", body: JSON.stringify({ name: name.trim(), role: role.trim(), power, interest }) }),
    onSuccess: () => { setName(""); setRole(""); qc.invalidateQueries({ queryKey: key }); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/stakeholder-matrix/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const cell = (p: Level, i: Level) => {
    const q = quadrant(p, i);
    const here = stakeholders.filter((s) => s.power === p && s.interest === i);
    return (
      <div style={{ background: q.tint, borderRadius: 10, padding: "10px 12px", minHeight: 78 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: q.dot, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{q.label}</div>
        {here.length === 0 ? <div style={{ fontSize: 11.5, color: color.faint3 }}>—</div> : here.map((s) => (
          <div key={s.id} style={{ fontSize: 12, color: color.text, fontWeight: 500 }}>{s.name}</div>
        ))}
      </div>
    );
  };

  return (
    <Card padding={22}>
      <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink, marginBottom: 14 }}>Stakeholder matrix · power / interest</div>
      {!scopeId ? (
        <EmptyBlock message="Select an item to map its stakeholders." minHeight={120} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* Top row = High power */}
            {cell("High", "Low")}
            {cell("High", "High")}
            {cell("Low", "Low")}
            {cell("Low", "High")}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: color.faint3, marginTop: 4 }}>
            <span>↑ Power · → Interest</span>
          </div>

          {stakeholders.length > 0 && (
            <div style={{ borderTop: `1px solid ${color.bg}`, marginTop: 14, paddingTop: 12 }}>
              {stakeholders.map((s) => {
                const q = quadrant(s.power, s.interest);
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", borderBottom: "1px solid #F4F6FA" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: q.dot, flex: "none" }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: color.text }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: color.faint2 }}>{s.role} · {q.label}</span>
                    {canEdit && (
                      <button onClick={() => remove.mutate(s.id)} disabled={remove.isPending} aria-label={`Remove ${s.name}`}
                        style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${color.border3}`, background: "#fff", color: color.faint3, cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {canEdit && (
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ flex: 2, minWidth: 120 }} />
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" style={{ flex: 1, minWidth: 90 }} />
              <Select value={power} onChange={(e) => setPower(e.target.value as Level)} title="Power" style={{ width: "auto" }}><option value="High">High power</option><option value="Low">Low power</option></Select>
              <Select value={interest} onChange={(e) => setInterest(e.target.value as Level)} title="Interest" style={{ width: "auto" }}><option value="High">High interest</option><option value="Low">Low interest</option></Select>
              <Button onClick={() => name.trim() && add.mutate()} disabled={add.isPending || !name.trim()}>Add</Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
