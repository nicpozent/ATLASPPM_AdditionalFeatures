import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";

type StageKey = "draft" | "backlog" | "approved" | "progress" | "hold";
const STAGE_META: Record<StageKey, { label: string; tint: string; ink: string }> = {
  draft:    { label: "Draft",       tint: "#EEF0F4", ink: "#566077" },
  backlog:  { label: "Backlog",     tint: "#E6EFFB", ink: "#0C5798" },
  approved: { label: "Approved",    tint: "#E7F4EC", ink: "#0B6B37" },
  progress: { label: "In Progress", tint: "#F0E8F7", ink: "#5E2E89" },
  hold:     { label: "On Hold",     tint: "#FBF2D7", ink: "#8A6300" },
};
const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
type Priority = (typeof PRIORITIES)[number];

interface MyDemand {
  id: string; title: string; dept: string; priority: Priority; date: string; stage: StageKey;
}

function useMyDemands() {
  return useQuery({
    queryKey: ["demands", "my"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<MyDemand[]> => {
      try { return (await api<MyDemand[]>("/demands/my")) ?? []; } catch { return []; }
    },
  });
}

interface NewDemand { title: string; dept: string; priority: Priority; }

export default function MyDemands() {
  const { data: demands = [] } = useMyDemands();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const maySubmit = can("cap-submit-demand", "E");
  const [modal, setModal] = useState(false);
  const submitDemand = useMutation({
    mutationFn: (body: NewDemand) => api("/demands", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demands", "my"] }),
  });
  const deleteDemand = useMutation({
    mutationFn: (id: string) => api(`/demands/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demands", "my"] }),
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 13.5, color: color.subtle }}>Submit a new demand and track where it is in the intake funnel.</div>
        <div style={{ flex: 1 }} />
        <Button onClick={() => setModal(true)} disabled={!maySubmit} title={maySubmit ? undefined : "Your role can't submit demands"}><Icon name="plus" size={16} /> Submit a demand</Button>
      </div>

      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.7fr 2.4fr 0.9fr 1fr auto", padding: "13px 20px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: "1px solid #EEF1F6" }}>
          <div>ID</div><div>Demand</div><div>Submitted</div><div>Status</div><div></div>
        </div>
        {demands.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>
            You have not submitted any demands yet. Submit one to track it through the funnel.
          </div>
        ) : demands.map((d) => {
          const sm = STAGE_META[d.stage] ?? STAGE_META.draft;
          return (
            <div key={d.id} style={{ display: "grid", gridTemplateColumns: "0.7fr 2.4fr 0.9fr 1fr auto", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #F2F4F9" }}>
              <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint3 }}>{d.id}</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{d.title}</div>
                <div style={{ fontSize: 11.5, color: color.faint3 }}>{d.dept} · {d.priority} priority</div>
              </div>
              <div style={{ fontSize: 12, color: color.subtle }}>{d.date}</div>
              <div>
                <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 600, color: sm.ink, background: sm.tint, padding: "3px 11px", borderRadius: 20 }}>{sm.label}</span>
              </div>
              <button type="button" title="Delete this demand" aria-label={`Delete ${d.title}`} disabled={deleteDemand.isPending}
                onClick={() => deleteDemand.mutate(d.id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, marginLeft: 8, border: "none", background: "transparent", color: color.faint2, cursor: "pointer", borderRadius: 7 }}>
                <Icon name="x" size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {modal && (
        <SubmitDemandModal
          onClose={() => setModal(false)}
          submitting={submitDemand.isPending}
          onSubmit={(body) => submitDemand.mutate(body, { onSuccess: () => setModal(false) })}
        />
      )}
    </div>
  );
}

function SubmitDemandModal({ onClose, onSubmit, submitting }: { onClose: () => void; onSubmit: (d: NewDemand) => void; submitting?: boolean }) {
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [description, setDescription] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), dept: dept.trim(), priority });
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(17,22,58,0.42)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: color.surface, borderRadius: 16, padding: 24, boxShadow: "0 24px 60px rgba(17,22,58,0.3)" }}>
        <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 4 }}>Submit a demand</div>
        <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>Describe what you need; it enters the intake funnel as a draft for review.</div>
        <Lbl>Title</Lbl>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short description of the demand" />
        <Lbl>Department</Lbl>
        <Input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Requesting department" />
        <Lbl>Priority</Lbl>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Lbl>Description</Lbl>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is needed and why?" style={{ minHeight: 72, resize: "vertical" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit demand"}</Button>
        </div>
      </div>
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, margin: "12px 0 5px" }}>{children}</label>;
}
