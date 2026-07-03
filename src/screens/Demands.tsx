import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Input, Select, Modal as Overlay } from "@/components/ui";

export { Overlay };

const STAGES = [
  { key: "draft",    label: "Draft",       color: "#8A93A6" },
  { key: "backlog",  label: "Backlog",     color: "#0F6CBD" },
  { key: "approved", label: "Approved",    color: "#15A34A" },
  { key: "progress", label: "In Progress", color: "#7A3FB0" },
  { key: "hold",     label: "On Hold",     color: "#E0A100" },
] as const;
type StageKey = (typeof STAGES)[number]["key"];

const PRIORITY = {
  High:     { ink: "#8A6300", tint: "#FBF2D7" },
  Medium:   { ink: "#0C5798", tint: "#E6EFFB" },
  Critical: { ink: "#A1282B", tint: "#FBE7E8" },
  Low:      { ink: "#566077", tint: "#EEF0F4" },
} as const;

interface Demand {
  id: string; title: string; stage: StageKey; priority: keyof typeof PRIORITY;
  value: number; effort: number; requester: string; dept: string; date: string;
}

function useDemands() {
  return useQuery({
    queryKey: ["demands"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Demand[]> => { try { return (await api<Demand[]>("/demands")) ?? []; } catch { return []; } },
  });
}

function Meter({ n, color: c }: { n: number; color: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < n ? c : "#E4E8F0" }} />
      ))}
    </span>
  );
}

interface NewDemand { title: string; dept: string; priority: keyof typeof PRIORITY; value: number; effort: number; }

export default function Demands() {
  const { data: demands = [] } = useDemands();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const createDemand = useMutation({
    mutationFn: (body: NewDemand) => api<Demand>("/demands", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demands"] }),
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.subtle }}>Intake scored on <b style={{ color: color.primary }}>value</b> vs <b style={{ color: "#C98A00" }}>effort</b> · drag to advance through the funnel</div>
        <div style={{ flex: 1 }} />
        <Button variant="secondary"><Icon name="search" size={16} /> Filter</Button>
        <Button onClick={() => setModal(true)}><Icon name="plus" size={16} /> New demand</Button>
      </div>

      <div style={{ display: "flex", gap: 15, alignItems: "flex-start", overflowX: "auto", paddingBottom: 12 }}>
        {STAGES.map((s) => {
          const items = demands.filter((d) => d.stage === s.key);
          return (
            <div key={s.key} style={{ width: 280, flex: "none", background: "#F4F6FA", border: `1px solid ${color.border}`, borderRadius: 14, padding: "13px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13, padding: "0 3px" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: color.text }}>{s.label}</span>
                <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.faint, background: "#fff", border: `1px solid ${color.border}`, padding: "0 7px", borderRadius: 20 }}>{items.length}</span>
                <div style={{ flex: 1 }} />
                <span onClick={() => setModal(true)} style={{ color: color.faint3, display: "flex", cursor: "pointer" }}><Icon name="plus" size={16} /></span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.length === 0 ? (
                  <div style={{ fontSize: 12, color: color.faint3, textAlign: "center", padding: "20px 6px" }}>No demands</div>
                ) : items.map((d) => {
                  const pr = PRIORITY[d.priority];
                  return (
                    <div key={d.id} style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 11, padding: "13px 13px 11px", boxShadow: "0 1px 2px rgba(20,26,60,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                        <span style={{ fontFamily: font.mono, fontSize: 11, color: color.faint3 }}>{d.id}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: pr.ink, background: pr.tint, padding: "2px 8px", borderRadius: 20 }}>{d.priority}</span>
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text, lineHeight: 1.32, marginBottom: 10 }}>{d.title}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 10.5, color: color.faint3, textTransform: "uppercase" }}>Value</span><Meter n={d.value} color="#0F6CBD" /></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 10.5, color: color.faint3, textTransform: "uppercase" }}>Effort</span><Meter n={d.effort} color="#C98A00" /></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #F2F4F9", paddingTop: 9 }}>
                        <span style={{ fontSize: 11.5, color: color.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{d.requester} · {d.dept}</span>
                        <span style={{ fontSize: 11, color: color.faint3 }}>{d.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {modal && <NewDemandModal submitting={createDemand.isPending} onClose={() => setModal(false)} onCreate={(body) => createDemand.mutate(body, { onSuccess: () => setModal(false) })} />}
    </div>
  );
}

function NewDemandModal({ onClose, onCreate, submitting }: { onClose: () => void; onCreate: (d: NewDemand) => void; submitting?: boolean }) {
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState("");
  const [priority, setPriority] = useState<keyof typeof PRIORITY>("Medium");
  const [value, setValue] = useState(3);
  const [effort, setEffort] = useState(3);
  const submit = () => {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), dept: dept.trim(), priority, value, effort });
  };
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 4 }}>New demand</div>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>Score the request on value and effort; it enters the funnel as a draft.</div>
      <Lbl>Title</Lbl>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short description of the demand" />
      <Lbl>Department</Lbl>
      <Input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Requesting department" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><Lbl>Value (1–5)</Lbl><Input type="number" min={1} max={5} value={value} onChange={(e) => setValue(Math.max(1, Math.min(5, +e.target.value)))} /></div>
        <div><Lbl>Effort (1–5)</Lbl><Input type="number" min={1} max={5} value={effort} onChange={(e) => setEffort(Math.max(1, Math.min(5, +e.target.value)))} /></div>
      </div>
      <Lbl>Priority</Lbl>
      <Select value={priority} onChange={(e) => setPriority(e.target.value as keyof typeof PRIORITY)}>
        {Object.keys(PRIORITY).map((p) => <option key={p} value={p}>{p}</option>)}
      </Select>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={submitting}>{submitting ? "Creating…" : "Create demand"}</Button>
      </div>
    </Overlay>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", margin: "12px 0 5px" }}>{children}</label>;
}
