import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api, apiUpload, apiDownload } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Input, Textarea, Modal as Overlay } from "@/components/ui";

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

interface NewDemand {
  title: string; description: string; dept: string;
  source: string; geoImpact: string[]; hasDeadline: boolean; deadline?: string;
  businessProblem: string; improvementExisting: boolean;
  criticality: number; risk: number; expectedBenefits: string; benefitValue: number;
  stakeholders: string[]; allStakeholders: boolean;
}

export default function Demands() {
  const { data: demands = [] } = useDemands();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const createDemand = useMutation({
    mutationFn: async ({ body, files }: { body: NewDemand; files: File[] }) => {
      const created = await api<Demand>("/demands", { method: "POST", body: JSON.stringify(body) });
      if (created && files.length) {
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        await apiUpload(`/demands/${created.id}/attachments`, fd);
      }
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demands"] }),
  });
  const advanceDemand = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api<Demand>(`/demands/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["demands"] }),
  });
  const dragId = useRef<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

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
          const over = overStage === s.key;
          return (
            <div key={s.key}
              onDragOver={(e) => { e.preventDefault(); if (overStage !== s.key) setOverStage(s.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null); }}
              onDrop={(e) => {
                e.preventDefault();
                const id = dragId.current; dragId.current = null; setOverStage(null);
                const dragged = demands.find((x) => x.id === id);
                if (id && dragged && dragged.stage !== s.key) advanceDemand.mutate({ id, stage: s.key });
              }}
              style={{ width: 280, flex: "none", background: over ? "#EAF2FB" : "#F4F6FA", border: `1px ${over ? "dashed" : "solid"} ${over ? color.primary : color.border}`, borderRadius: 14, padding: "13px 12px", transition: "background .1s" }}>
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
                    <div key={d.id}
                      draggable
                      onDragStart={(e) => { dragId.current = d.id; e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { dragId.current = null; setOverStage(null); }}
                      onClick={() => setDetailId(d.id)}
                      style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 11, padding: "13px 13px 11px", boxShadow: "0 1px 2px rgba(20,26,60,0.04)", cursor: "pointer" }}>
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

      {modal && <NewDemandModal submitting={createDemand.isPending} onClose={() => setModal(false)} onCreate={(body, files) => createDemand.mutate({ body, files }, { onSuccess: () => setModal(false) })} />}
      {detailId && <DemandDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

// ---- Demand detail (read-only view of the full intake record) --------------
interface Attachment { id: number; fileName: string; contentType: string; size: number }
interface DemandDetail {
  id: string; title: string; stage: string; priority: string; requester: string; dept: string; date: string;
  description: string; source: string; geoImpact: string[]; hasDeadline: boolean; deadline?: string;
  businessProblem: string; improvementExisting: boolean; criticality: number; risk: number;
  expectedBenefits: string; benefitValue: number; stakeholders: string[]; allStakeholders: boolean;
  attachments: Attachment[]; canDelete: boolean;
}

function DemandDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["demands", id], retry: false,
    queryFn: async (): Promise<DemandDetail | null> => { try { return await api<DemandDetail>(`/demands/${id}`); } catch { return null; } },
  });
  const del = useMutation({
    mutationFn: () => api(`/demands/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["demands"] }); onClose(); },
  });
  const fmt = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
  const scored = (opts: { value: number; icon: string; label: string }[], v: number) => opts.find((o) => o.value === v);
  const stageMeta = STAGES.find((s) => s.key === data?.stage);
  const src = SOURCES.find((s) => s.value === data?.source);

  return (
    <Overlay onClose={onClose} width={620}>
      {isLoading || !data ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: color.faint3 }}>{isLoading ? "Loading…" : "Demand not found."}</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint3, marginBottom: 3 }}>{data.id}</div>
              <div style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: color.ink, lineHeight: 1.25 }}>{data.title}</div>
            </div>
            {stageMeta && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: stageMeta.color, padding: "4px 11px", borderRadius: 20 }}>{stageMeta.label}</span>}
          </div>

          <Row label="Requester">{data.requester} · {data.dept}</Row>
          <Row label="Priority">{data.priority}</Row>
          {src && <Row label="Source"><span style={{ fontSize: 15 }}>{src.icon}</span> {src.label}</Row>}
          {data.geoImpact.length > 0 && <Row label="Geographic impact">{data.geoImpact.join(", ")}</Row>}
          <Row label="Deadline">{data.hasDeadline ? (data.deadline || "Yes") : "No"}</Row>
          <Row label="Improvement on existing">{data.improvementExisting ? "Yes" : "No"}</Row>
          {scored(CRITICALITY, data.criticality) && <Row label="Criticality"><span style={{ fontSize: 15 }}>{scored(CRITICALITY, data.criticality)!.icon}</span> {scored(CRITICALITY, data.criticality)!.label}</Row>}
          {scored(RISK, data.risk) && <Row label="Risk of not doing"><span style={{ fontSize: 15 }}>{scored(RISK, data.risk)!.icon}</span> {scored(RISK, data.risk)!.label}</Row>}
          {scored(BENEFIT, data.benefitValue) && <Row label="Benefit value"><span style={{ fontSize: 15 }}>{scored(BENEFIT, data.benefitValue)!.icon}</span> {scored(BENEFIT, data.benefitValue)!.label}</Row>}
          {data.stakeholders.length > 0 && <Row label="Stakeholders">{data.stakeholders.join(", ")}{data.allStakeholders ? " · complete" : ""}</Row>}

          {data.description && <Block label="Request description">{data.description}</Block>}
          {data.businessProblem && <Block label="Business problem / opportunity">{data.businessProblem}</Block>}
          {data.expectedBenefits && <Block label="Expected benefits">{data.expectedBenefits}</Block>}

          {data.attachments.length > 0 && (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: color.text, margin: "16px 0 7px" }}>Attachments</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.attachments.map((a) => (
                  <button key={a.id} type="button" onClick={() => apiDownload(`/attachments/${a.id}`, a.fileName)} style={{ display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer", fontSize: 12.5, color: color.text, background: color.surfaceAlt, border: `1px solid ${color.border}`, borderRadius: 8, padding: "7px 10px", fontFamily: "inherit" }}>
                    <Icon name="sheet" size={14} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fileName}</span>
                    <span style={{ color: color.faint3, fontFamily: font.mono, fontSize: 11 }}>{fmt(a.size)}</span>
                    <span style={{ color: color.primary, display: "flex" }}><Icon name="download" size={14} /></span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", marginTop: 20 }}>
            {data.canDelete && (
              <button type="button" onClick={() => del.mutate()} disabled={del.isPending} style={{
                display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                color: color.danger, background: color.dangerTint, border: "none", padding: "9px 14px", borderRadius: 9,
                cursor: del.isPending ? "not-allowed" : "pointer", opacity: del.isPending ? 0.6 : 1,
              }}><Icon name="x" size={15} /> {del.isPending ? "Deleting…" : "Delete initiative"}</button>
            )}
            <div style={{ flex: 1 }} />
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </>
      )}
    </Overlay>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: `1px solid ${color.surfaceAlt}`, fontSize: 13 }}>
      <span style={{ width: 170, flex: "none", color: color.faint2, fontWeight: 600 }}>{label}</span>
      <span style={{ color: color.text, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{children}</span>
    </div>
  );
}
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: color.text, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13, color: color.textMuted, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{children}</div>
    </div>
  );
}

// ---- IT Request & Innovation intake form options --------------------------
const SOURCES = [
  { value: "business",   icon: "🏢", label: "Business initiative" },
  { value: "regulatory", icon: "👮", label: "Regulatory demand" },
  { value: "internal",   icon: "👨‍💻", label: "Internal IT" },
];
const CRITICALITY = [
  { value: 1, icon: "🚦", label: "Just a Nice-to-Have" },
  { value: 2, icon: "🟡", label: "Helpful, but Not Urgent" },
  { value: 3, icon: "🟠", label: "Important for Progress" },
  { value: 4, icon: "🔴", label: "High Priority – Needs Attention" },
  { value: 5, icon: "🚨", label: "Mission Critical – Top Priority!" },
];
const RISK = [
  { value: 1, icon: "🚦", label: "Almost no impact; negligible consequences." },
  { value: 2, icon: "🟡", label: "Minor inconvenience; easily manageable." },
  { value: 3, icon: "🟠", label: "Noticeable impact; requires some mitigation." },
  { value: 4, icon: "🔴", label: "Significant consequences; serious disruption likely." },
  { value: 5, icon: "🚨", label: "Severe impact; major failure or loss expected." },
];
const BENEFIT = [
  { value: 1, icon: "💡", label: "Barely noticed" },
  { value: 2, icon: "👍", label: "Slightly helpful" },
  { value: 3, icon: "🌟", label: "Appreciated" },
  { value: 4, icon: "🚀", label: "Highly valuable" },
  { value: 5, icon: "❤️", label: "Game-changer" },
];
const GEO_OPTIONS = ["Group-wide", "Sweden", "Norway", "Finland", "Denmark", "Baltics", "Other"];

function NewDemandModal({ onClose, onCreate, submitting }: {
  onClose: () => void; onCreate: (d: NewDemand, files: File[]) => void; submitting?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [geoImpact, setGeoImpact] = useState<string[]>([]);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [businessProblem, setBusinessProblem] = useState("");
  const [improvementExisting, setImprovementExisting] = useState(false);
  const [criticality, setCriticality] = useState(0);
  const [risk, setRisk] = useState(0);
  const [expectedBenefits, setExpectedBenefits] = useState("");
  const [benefitValue, setBenefitValue] = useState(0);
  const [stakeholders, setStakeholders] = useState<string[]>([]);
  const [allStakeholders, setAllStakeholders] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const valid = title.trim() && description.trim() && source && geoImpact.length > 0 &&
    businessProblem.trim() && criticality > 0 && risk > 0 && expectedBenefits.trim() && benefitValue > 0;

  const submit = () => {
    if (!valid) return;
    onCreate({
      title: title.trim(), description: description.trim(), dept: "",
      source, geoImpact, hasDeadline, deadline: hasDeadline ? deadline : undefined,
      businessProblem: businessProblem.trim(), improvementExisting,
      criticality, risk, expectedBenefits: expectedBenefits.trim(), benefitValue,
      stakeholders, allStakeholders,
    }, files);
  };

  return (
    <Overlay onClose={onClose} width={640}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3 }}>
        <span style={{ fontSize: 20 }}>💡</span>
        <div style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: color.ink }}>IT Request &amp; Innovation Form</div>
      </div>
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 16 }}>Required fields are marked with an asterisk <span style={{ color: color.danger }}>*</span></div>

      <Lbl req>Title of request</Lbl>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short, clear title" />

      <Lbl req>Request Description</Lbl>
      <Hint>Briefly describe the purpose and scope of the request</Hint>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 80 }} />

      <Lbl req>Source of request</Lbl>
      <Hint>Where does it originate from</Hint>
      <IconChoice options={SOURCES} value={source} onChange={(v) => setSource(v as string)} />

      <Lbl>🌍 Geographic impact <Star /></Lbl>
      <Hint>Where does this request have an impact (multiple choice)</Hint>
      <ChipMulti options={GEO_OPTIONS} selected={geoImpact}
        onToggle={(g) => setGeoImpact((s) => s.includes(g) ? s.filter((x) => x !== g) : [...s, g])} />

      <Lbl>Is there a deadline?</Lbl>
      <YesNo value={hasDeadline} onChange={setHasDeadline} />
      {hasDeadline && <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ marginTop: 8, maxWidth: 220 }} />}

      <Lbl req>Business Problem and/or Opportunity</Lbl>
      <Hint>What problem does this solve, or what opportunity does it create?</Hint>
      <Textarea value={businessProblem} onChange={(e) => setBusinessProblem(e.target.value)} style={{ minHeight: 80 }} />

      <Lbl>Improvement on Existing system?</Lbl>
      <Hint>Improvements, adjustments, additions, etc.</Hint>
      <YesNo value={improvementExisting} onChange={setImprovementExisting} yesFirst={false} />

      <Lbl req>What&apos;s the criticality of solving this request?</Lbl>
      <IconChoice options={CRITICALITY} value={criticality} onChange={(v) => setCriticality(v as number)} />

      <Lbl req>What&apos;s the risk of NOT doing this request?</Lbl>
      <IconChoice options={RISK} value={risk} onChange={(v) => setRisk(v as number)} />

      <Lbl req>Expected Benefits</Lbl>
      <Hint>List key benefits such as cost savings, efficiency, revenue growth, compliance, etc.</Hint>
      <Textarea value={expectedBenefits} onChange={(e) => setExpectedBenefits(e.target.value)} style={{ minHeight: 80 }} />

      <Lbl req>Rank the value of the benefits</Lbl>
      <IconChoice options={BENEFIT} value={benefitValue} onChange={(v) => setBenefitValue(v as number)} />

      <Lbl>Key Stakeholders</Lbl>
      <Hint>List all individuals impacted by this request (don&apos;t forget yourself if you&apos;re one too)</Hint>
      <TagInput tags={stakeholders} onAdd={(t) => setStakeholders((s) => s.includes(t) ? s : [...s, t])}
        onRemove={(t) => setStakeholders((s) => s.filter((x) => x !== t))} placeholder="Type a name and press Enter" />

      <Lbl>All stakeholders added above?</Lbl>
      <YesNo value={allStakeholders} onChange={setAllStakeholders} />

      <Lbl>Attachments</Lbl>
      <Hint>If applicable — files and pictures</Hint>
      <Dropzone files={files} onAdd={(fl) => setFiles((s) => [...s, ...fl])} onRemove={(i) => setFiles((s) => s.filter((_, idx) => idx !== i))} />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22, borderTop: `1px solid ${color.border}`, paddingTop: 16 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={submitting || !valid}>{submitting ? "Sending…" : "Send"}</Button>
      </div>
    </Overlay>
  );
}

// ---- form primitives -------------------------------------------------------
function Star() { return <span style={{ color: color.danger }}>*</span>; }
function Lbl({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: color.text, margin: "16px 0 3px" }}>{children}{req && <> <Star /></>}</label>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, color: color.faint2, marginBottom: 7 }}>{children}</div>;
}

function IconChoice({ options, value, onChange }: {
  options: { value: string | number; icon: string; label: string }[];
  value: string | number; onChange: (v: string | number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={String(o.value)} type="button" onClick={() => onChange(o.value)} style={{
            display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13.5, color: color.text,
            background: on ? color.primaryTint : color.surface,
            border: `1px solid ${on ? color.primary : color.border2}`, borderRadius: 9, padding: "9px 12px",
          }}>
            <span style={{ width: 15, height: 15, borderRadius: "50%", flex: "none", border: `2px solid ${on ? color.primary : color.faint3}`, boxShadow: on ? `inset 0 0 0 3px ${color.surface}` : "none", background: on ? color.primary : "transparent" }} />
            <span style={{ fontSize: 16 }}>{o.icon}</span>
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ChipMulti({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (o: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)} style={{
            fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            color: on ? "#fff" : color.textMuted, background: on ? color.primary : color.surface,
            border: `1px solid ${on ? color.primary : color.border2}`, borderRadius: 20, padding: "6px 13px",
          }}>{on ? "✓ " : ""}{o}</button>
        );
      })}
    </div>
  );
}

function YesNo({ value, onChange, yesFirst = true }: { value: boolean; onChange: (v: boolean) => void; yesFirst?: boolean }) {
  const opts = yesFirst ? [true, false] : [false, true];
  return (
    <div style={{ display: "flex", gap: 18 }}>
      {opts.map((v) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)} style={{
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "inherit",
          fontSize: 13.5, color: color.text, background: "transparent", border: "none", padding: 0,
        }}>
          <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${value === v ? color.primary : color.faint3}`, boxShadow: value === v ? `inset 0 0 0 3px ${color.surface}` : "none", background: value === v ? color.primary : "transparent" }} />
          {v ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function TagInput({ tags, onAdd, onRemove, placeholder }: {
  tags: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void; placeholder?: string;
}) {
  const [text, setText] = useState("");
  const add = () => { const t = text.trim(); if (t) { onAdd(t); setText(""); } };
  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
          {tags.map((t) => (
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.primaryDark, background: color.primaryTint, borderRadius: 20, padding: "4px 6px 4px 11px" }}>
              {t}
              <button type="button" onClick={() => onRemove(t)} aria-label={`Remove ${t}`} style={{ display: "flex", cursor: "pointer", border: "none", background: "transparent", color: color.primaryDark, padding: 0 }}><Icon name="x" size={13} /></button>
            </span>
          ))}
        </div>
      )}
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
    </div>
  );
}

function Dropzone({ files, onAdd, onRemove }: { files: File[]; onAdd: (f: File[]) => void; onRemove: (i: number) => void }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fmt = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onAdd(Array.from(e.dataTransfer.files)); }}
        onClick={() => inputRef.current?.click()}
        style={{ cursor: "pointer", textAlign: "center", padding: "22px 16px", borderRadius: 10, fontSize: 13, color: color.subtle, background: over ? color.primaryTint : color.surfaceAlt, border: `1.5px dashed ${over ? color.primary : color.border2}` }}
      >
        <Icon name="download" size={18} />
        <div style={{ marginTop: 6 }}>Drop files to attach, or <span style={{ color: color.primary, fontWeight: 600 }}>browse</span></div>
        <input ref={inputRef} type="file" multiple style={{ display: "none" }}
          onChange={(e) => { if (e.target.files) onAdd(Array.from(e.target.files)); e.currentTarget.value = ""; }} />
      </div>
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: color.text, background: color.surfaceAlt, border: `1px solid ${color.border}`, borderRadius: 8, padding: "7px 10px" }}>
              <Icon name="sheet" size={14} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              <span style={{ color: color.faint3, fontFamily: font.mono, fontSize: 11 }}>{fmt(f.size)}</span>
              <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`} style={{ display: "flex", cursor: "pointer", border: "none", background: "transparent", color: color.faint2, padding: 0 }}><Icon name="x" size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
