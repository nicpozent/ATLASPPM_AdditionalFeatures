// Extracted from Project.tsx — the Security tab and its modals/types.
// No behaviour change; shared presentational helpers come from ./shared.
import React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, EmptyBlock, Button, Modal, Input, Select, Textarea } from "@/components/ui";
import { toastError } from "@/components/Toast";
import { SectionTitle, DecLabel } from "./shared";
import { SoaPanel } from "./SoaPanel";
import { type SecReviewGate, SRG_TYPES, SRG_STATUSES, SRG_STATUS } from "./reviewGates";

interface SecProfile {
  classification: string; residency: string; subjects: string; retention: string;
  personalData: boolean; specialCategory: boolean; automatedDecisions: boolean; cardholderData: boolean;
  gdpr: boolean; pci: boolean; iso: boolean; aiAct: boolean; soc2: boolean; nis2: boolean;
  dpp?: boolean; ppwr?: boolean; eudr?: boolean;
  // EU AI Act classification + ISO 42001 AI-management (ADR-0050)
  aiSystemName?: string; aiRiskTier?: string; aiAnnexIii?: boolean; aiHumanOversight?: boolean; aiTransparency?: boolean;
}
// EU AI Act risk tiers with the obligation headline each pulls in.
const AI_TIERS: { value: string; label: string; note: string }[] = [
  { value: "", label: "Unclassified", note: "Classify the system to derive its EU AI Act obligations." },
  { value: "minimal", label: "Minimal risk", note: "No mandatory obligations; voluntary codes of conduct apply." },
  { value: "limited", label: "Limited risk", note: "Transparency — users must be told they interact with AI (Art. 50)." },
  { value: "high", label: "High risk (Annex III)", note: "Risk management (Art. 9), data governance (Art. 10), human oversight (Art. 14), conformity assessment." },
  { value: "prohibited", label: "Prohibited (Art. 5)", note: "Must not be placed on the EU market." },
];
const AI_TIER_COLOR: Record<string, { ink: string; tint: string }> = {
  "": { ink: color.subtle, tint: color.bg }, minimal: { ink: color.successInk, tint: color.successTint },
  limited: { ink: color.warningInk, tint: color.warningTint }, high: { ink: color.dangerInk, tint: color.dangerTint },
  prohibited: { ink: color.dangerInk, tint: color.dangerTint },
};
interface SecControl { id: number; code: string; control: string; framework: string; evidence: string; owner: string; status: string; description: string; reason: string; }
interface SecData { canEdit: boolean; profile: SecProfile; controls: SecControl[]; reviewGates: SecReviewGate[]; }

const CLASS_OPTS = ["Public", "Internal", "Confidential", "Restricted"];
const RESIDENCY_OPTS = ["EU / EEA", "Global", "On-prem only"];
const FRAMEWORK_OPTS = ["ISO 27001", "ISO 42001", "GDPR", "PCI-DSS", "SOC 2", "NIS2", "NIST CSF 2.0", "EU AI Act", "Digital Product Passport (ESPR)", "Packaging (PPWR)", "EU Deforestation (EUDR)"];
const CTL_STATUSES = ["Planned", "Partial", "Implemented", "Archived"];
const CTL_STATUS: Record<string, { ink: string; tint: string }> = {
  Implemented: { ink: color.successInk, tint: color.successTint },
  Partial:     { ink: color.warningInk, tint: color.warningTint },
  Planned:     { ink: color.subtle, tint: color.bg },
  Archived:    { ink: "#5E2E89", tint: color.accentTint },
};
const SEC_FLAGS: { key: keyof SecProfile; label: string; desc: string }[] = [
  { key: "gdpr", label: "GDPR", desc: "Personal data of EU/EEA data subjects" },
  { key: "pci", label: "PCI-DSS", desc: "Cardholder data in scope" },
  { key: "iso", label: "ISO 27001", desc: "ISMS Annex A controls apply" },
  { key: "aiAct", label: "EU AI Act", desc: "Automated recommendation model" },
  { key: "soc2", label: "SOC 2", desc: "Vendor assurance for SaaS components" },
  { key: "nis2", label: "NIS2", desc: "Essential-entity operational resilience" },
  { key: "dpp", label: "Digital Product Passport", desc: "ESPR product data & data carrier" },
  { key: "ppwr", label: "Packaging (PPWR)", desc: "Packaging design, recyclability & EPR" },
  { key: "eudr", label: "EU Deforestation (EUDR)", desc: "Due diligence for listed commodities" },
];
// Reference facts for the product & sustainability regulations (static domain
// knowledge, verified against EU sources — not per-project data).
const REG_GUIDE: { key: keyof SecProfile; name: string; scope: string; obligations: string[]; deadlines: { date: string; what: string }[] }[] = [
  {
    key: "dpp", name: "Digital Product Passport — ESPR (EU) 2024/1781",
    scope: "A digital record of a product's sustainability data (materials, durability, repairability, recycled content, carbon footprint), reached via a data carrier (QR/RFID). Rolls out per product group through delegated acts.",
    obligations: ["Unique product identifier + data carrier on product/packaging", "Machine-readable sustainability & circularity data", "Data kept accessible to authorities, consumers & the value chain", "Battery passport for EV/industrial/LMT batteries > 2 kWh"],
    deadlines: [{ date: "18 Feb 2027", what: "Battery passport mandatory (Battery Reg. 2023/1542)" }, { date: "2027", what: "Textiles delegated act expected to be adopted" }, { date: "2027–2030", what: "First ESPR product groups (textiles, furniture, tyres, electronics) phase in" }],
  },
  {
    key: "ppwr", name: "Packaging & Packaging Waste Regulation — PPWR (EU) 2025/40",
    scope: "Directly-applicable EU regulation covering all packaging placed on the EU market: design, minimisation, recyclability, recycled content, reuse and producer responsibility.",
    obligations: ["Declaration of conformity + technical documentation per packaging unit", "Packaging minimisation — e-commerce empty space ≤ 40%", "Restrictions on substances of concern (incl. PFAS in food-contact)", "Producer registration & extended producer responsibility (EPR)"],
    deadlines: [{ date: "12 Aug 2026", what: "Most obligations apply (conformity, minimisation, substances)" }, { date: "2027", what: "Producer registers available per member state" }, { date: "1 Jan 2030", what: "Recyclability grades, recycled-content minima, reuse targets, SUP bans" }],
  },
  {
    key: "eudr", name: "EU Deforestation Regulation — EUDR (EU) 2023/1115",
    scope: "Due-diligence regime for cattle, cocoa, coffee, oil palm, rubber, soy and wood (and derived products) placed on or exported from the EU — must be deforestation-free (after 31 Dec 2020) and legal.",
    obligations: ["Due-diligence statement per consignment via the EU Information System", "Geolocation coordinates of all plots of production", "Risk assessment & mitigation to negligible risk", "Deforestation-free (post-2020 cut-off) + legality evidence"],
    deadlines: [{ date: "30 Dec 2026", what: "Application for large & medium operators/traders (Reg. 2025/2650)" }, { date: "30 Jun 2027", what: "Application for micro & small enterprises" }],
  },
];
const DPIA_COLOR: Record<string, { ink: string; tint: string }> = {
  Required:      { ink: color.dangerInk, tint: color.dangerTint },
  Recommended:   { ink: color.warningInk, tint: color.warningTint },
  "Not required":{ ink: color.successInk, tint: color.successTint },
};
// Each in-scope factor contributes its own obligation, so when several toggles
// are on the banner lists them all (not just the single highest-precedence one).
// The overall level is still the strongest trigger present.
function dpiaVerdict(p: SecProfile): { level: string; reasons: string[] } {
  const reasons: string[] = [];
  if (p.specialCategory) reasons.push("Special-category data (GDPR Art. 9) — an explicit Art. 9(2) condition is required and a DPIA is mandatory (Art. 35).");
  if (p.automatedDecisions) reasons.push("Automated decision-making / profiling (Art. 22) — needs a lawful basis, safeguards and meaningful human oversight; a DPIA is mandatory.");
  if (p.classification === "Restricted") reasons.push("Restricted classification — a DPIA plus heightened access, encryption and logging controls are mandatory for this initiative.");
  if (p.personalData) reasons.push("Personal data is processed — GDPR applies: a lawful basis, data-subject rights, and an entry in the Records of Processing (Art. 30).");
  if (p.cardholderData) reasons.push("Cardholder data is in scope — PCI-DSS applies: SAQ/ROC scoping, network segmentation and key management.");
  const level = p.specialCategory || p.automatedDecisions || p.classification === "Restricted"
    ? "Required"
    : p.personalData || p.cardholderData ? "Recommended" : "Not required";
  if (reasons.length === 0) reasons.push("No personal, special-category or cardholder data identified in scope.");
  return { level, reasons };
}
const SEC_COLS = "0.6fr 1.9fr 0.9fr 1.9fr 1.1fr 0.9fr";

export function Security({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [openCtl, setOpenCtl] = useState<SecControl | null>(null);
  const [gateModal, setGateModal] = useState(false);
  const [openGate, setOpenGate] = useState<SecReviewGate | null>(null);
  const { data } = useQuery({
    queryKey: ["security", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<SecData | null> => await api<SecData>(`/projects/${projectId}/security`),
  });
  const patch = useMutation({
    mutationFn: (body: Partial<SecProfile>) => api(`/projects/${projectId}/security`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security", projectId] }),
  });
  const cycle = useMutation({
    mutationFn: (v: { id: number; status: string }) => api(`/security/controls/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: v.status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security", projectId] }),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its security posture." /></Card>;
  if (!data) return <Card><EmptyBlock minHeight={220} message="Loading security profile…" /></Card>;

  const { profile: p, controls, canEdit } = data;
  const dpia = dpiaVerdict(p);
  const dc = DPIA_COLOR[dpia.level];
  const toggles: { key: keyof SecProfile; label: string }[] = [
    { key: "personalData", label: "Personal data processed" },
    { key: "specialCategory", label: "Special-category data" },
    { key: "automatedDecisions", label: "Automated decision-making" },
    { key: "cardholderData", label: "Cardholder data" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: color.ink }}>Security, privacy &amp; compliance</div>
        {canEdit && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: color.successInk, background: color.successTint, padding: "4px 11px", borderRadius: 20 }}>● Security governance enabled</span>}
      </div>

      {/* data classification & privacy profile */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Data classification &amp; privacy profile</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "14px 26px" }}>
          <SecField label="Data classification">
            <Select value={p.classification} disabled={!canEdit} onChange={(e) => patch.mutate({ classification: e.target.value })}>
              {CLASS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </SecField>
          <SecField label="Data residency">
            <Select value={p.residency} disabled={!canEdit} onChange={(e) => patch.mutate({ residency: e.target.value })}>
              {RESIDENCY_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </SecField>
          <SecField label="Data subjects">
            <SecTextField value={p.subjects} disabled={!canEdit} placeholder="e.g. ~4.8M shoppers (Nordic)" onCommit={(v) => patch.mutate({ subjects: v })} />
          </SecField>
          <SecField label="Retention">
            <SecTextField value={p.retention} disabled={!canEdit} placeholder="e.g. 7 years (financial)" onCommit={(v) => patch.mutate({ retention: v })} />
          </SecField>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          {toggles.map((t) => (
            <Toggle key={t.key} on={!!p[t.key]} label={t.label} disabled={!canEdit} onClick={() => patch.mutate({ [t.key]: !p[t.key] } as Partial<SecProfile>)} />
          ))}
        </div>
      </Card>

      {/* DPIA banner — lists every in-scope obligation when several toggles are on */}
      <div style={{ border: `1px solid ${dc.ink}`, background: dc.tint, borderRadius: 16, padding: "18px 22px", marginBottom: 16 }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 700, color: dc.ink }}>DPIA / PIA — {dpia.level}</div>
        {dpia.reasons.length === 1 ? (
          <div style={{ fontSize: 13, color: color.textMuted, lineHeight: 1.55, marginTop: 8 }}>{dpia.reasons[0]}</div>
        ) : (
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, listStyle: "disc" }}>
            {dpia.reasons.map((r, i) => (
              <li key={i} style={{ fontSize: 13, color: color.textMuted, lineHeight: 1.55, marginTop: i ? 5 : 0 }}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      {/* compliance flags */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Applicable frameworks &amp; regulations</SectionTitle>
        <div style={{ fontSize: 12, color: color.faint2, marginTop: -6, marginBottom: 14 }}>Toggle the regimes in scope for this initiative — these drive the required controls and gates.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {SEC_FLAGS.map((f) => {
            const on = !!p[f.key];
            return (
              <div key={f.key} onClick={() => canEdit && patch.mutate({ [f.key]: !on } as Partial<SecProfile>)} style={{ minWidth: 150, borderRadius: 11, border: `1px solid ${color.border}`, overflow: "hidden", cursor: canEdit ? "pointer" : "default" }}>
                <div style={{ background: on ? color.primary : color.neutralTint, color: on ? "#fff" : "#7B849A", fontSize: 13, fontWeight: 700, padding: "9px 13px" }}>{f.label}</div>
                <div style={{ fontSize: 11, color: "#7B849A", padding: "8px 13px", lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* EU AI Act classification + ISO 42001 AI management — shown when AI is in scope */}
      {p.aiAct && (() => {
        const tier = p.aiRiskTier ?? "";
        const tc = AI_TIER_COLOR[tier] ?? AI_TIER_COLOR[""];
        const meta = AI_TIERS.find((t) => t.value === tier) ?? AI_TIERS[0];
        const aiToggles: { key: keyof SecProfile; label: string }[] = [
          { key: "aiAnnexIii", label: "Annex III high-risk use case" },
          { key: "aiHumanOversight", label: "Human oversight in place (Art. 14)" },
          { key: "aiTransparency", label: "Users informed it's AI (Art. 50)" },
        ];
        return (
          <Card style={{ marginBottom: 16 }}>
            <SectionTitle>AI system classification — EU AI Act &amp; ISO 42001</SectionTitle>
            <div style={{ fontSize: 12, color: color.faint2, marginTop: -6, marginBottom: 14 }}>Set the risk tier and oversight measures — the risk engine derives the AI Act / ISO 42001 obligations from these.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "14px 26px", marginBottom: 14 }}>
              <SecField label="AI system / model">
                <SecTextField value={p.aiSystemName ?? ""} disabled={!canEdit} placeholder="e.g. Product recommender v2" onCommit={(v) => patch.mutate({ aiSystemName: v })} />
              </SecField>
              <SecField label="EU AI Act risk tier">
                <Select value={tier} disabled={!canEdit} onChange={(e) => patch.mutate({ aiRiskTier: e.target.value })}>
                  {AI_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </SecField>
            </div>
            <div style={{ border: `1px solid ${tc.ink}`, background: tc.tint, borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: tc.ink }}>{meta.label}</span>
              <span style={{ fontSize: 12.5, color: color.textMuted, marginLeft: 8 }}>{meta.note}</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {aiToggles.map((t) => (
                <Toggle key={t.key} on={!!p[t.key]} label={t.label} disabled={!canEdit} onClick={() => patch.mutate({ [t.key]: !p[t.key] } as Partial<SecProfile>)} />
              ))}
            </div>
          </Card>
        );
      })()}

      {/* product & sustainability regulation reference — obligations + deadlines */}
      {(() => {
        const active = REG_GUIDE.filter((r) => !!p[r.key]);
        const shown = active.length > 0 ? active : REG_GUIDE;   // guidance even before a toggle is on
        return (
          <Card padding={22} style={{ marginBottom: 16 }}>
            <SectionTitle>Product &amp; sustainability regulations</SectionTitle>
            <div style={{ fontSize: 12, color: color.faint2, margin: "3px 0 14px" }}>
              {active.length > 0 ? "Obligations & key dates for the regulations enabled above." : "Reference for EU product & sustainability regulations. Toggle one on above when it applies to this project."}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {shown.map((r) => (
                <div key={r.key} style={{ border: `1px solid ${color.border}`, borderRadius: 12, padding: "15px 17px", opacity: active.length > 0 || !!p[r.key] ? 1 : 0.92 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: color.ink }}>{r.name}</span>
                    {!!p[r.key] && <span style={{ fontSize: 10, fontWeight: 700, color: color.successInk, background: color.successTint, padding: "2px 8px", borderRadius: 20 }}>Applies</span>}
                  </div>
                  <div style={{ fontSize: 12, color: color.subtle, lineHeight: 1.5, marginBottom: 11 }}>{r.scope}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>Key obligations</div>
                      <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                        {r.obligations.map((o, i) => <li key={i} style={{ fontSize: 12, color: color.text, lineHeight: 1.4 }}>{o}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>Milestones</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {r.deadlines.map((d, i) => (
                          <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                            <span style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 700, color: color.primary, flex: "none", minWidth: 78 }}>{d.date}</span>
                            <span style={{ fontSize: 11.5, color: color.subtle, lineHeight: 1.4 }}>{d.what}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* security review gates */}
      <Card padding={0} style={{ overflow: "hidden", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "15px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <span style={{ flex: 1, fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>Security review gates</span>
          {canEdit && <button onClick={() => setGateModal(true)} style={{ fontSize: 12.5, fontWeight: 600, color: color.primary, background: color.primaryTint, border: "none", padding: "8px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>+ Add gate</button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.1fr 0.9fr 0.9fr", padding: "11px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Gate</div><div>Type</div><div>Reviewer</div><div>Date</div><div>Status</div>
        </div>
        {(data.reviewGates ?? []).length === 0 ? (
          <EmptyBlock message="No security review gates scheduled yet." minHeight={110} />
        ) : data.reviewGates.map((g) => {
          const gs = SRG_STATUS[g.status] ?? SRG_STATUS.Scheduled;
          return (
            <div key={g.id} onClick={() => canEdit && setOpenGate(g)} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.1fr 0.9fr 0.9fr", alignItems: "center", padding: "12px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, cursor: canEdit ? "pointer" : "default" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: canEdit ? color.primary : color.text }}>{g.name}{g.note && <div style={{ fontSize: 11, color: color.faint3, fontWeight: 400, marginTop: 2 }}>{g.note}</div>}</div>
              <div style={{ fontSize: 11.5, color: color.subtle }}>{g.type}</div>
              <div style={{ fontSize: 11.5, color: color.subtle }}>{g.reviewer || "—"}</div>
              <div style={{ fontSize: 11.5, color: color.faint, fontFamily: font.mono }}>{g.date || "—"}</div>
              <div><span style={{ fontSize: 11, fontWeight: 700, color: gs.ink, background: gs.tint, padding: "3px 9px", borderRadius: 6 }}>{g.status}</span></div>
            </div>
          );
        })}
      </Card>

      {/* control evidence register */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "15px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <span style={{ flex: 1, fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>Control evidence register</span>
          {canEdit && <button onClick={() => setAddOpen(true)} style={{ fontSize: 12.5, fontWeight: 600, color: color.primary, background: color.primaryTint, border: "none", padding: "8px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>+ Add control</button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: SEC_COLS, padding: "11px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>ID</div><div>Control</div><div>Framework</div><div>Evidence</div><div>Owner</div><div>Status</div>
        </div>
        {controls.length === 0 ? (
          <EmptyBlock message="No controls logged yet." minHeight={120} />
        ) : controls.map((c) => {
          const sc = CTL_STATUS[c.status] ?? CTL_STATUS.Planned;
          const nextStatus = CTL_STATUSES[(CTL_STATUSES.indexOf(c.status) + 1) % CTL_STATUSES.length];
          return (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: SEC_COLS, alignItems: "center", padding: "12px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, opacity: c.status === "Archived" ? 0.6 : 1 }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, color: color.faint3 }}>{c.code}</div>
              <div style={{ minWidth: 0 }}>
                {canEdit ? (
                  <button onClick={() => setOpenCtl(c)} style={{ fontSize: 12.5, color: color.primary, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>{c.control}</button>
                ) : (
                  <span style={{ fontSize: 12.5, color: color.text, fontWeight: 600 }}>{c.control}</span>
                )}
                {c.reason && <div style={{ fontSize: 10.5, color: color.faint3, fontStyle: "italic", marginTop: 2 }}>{c.reason}</div>}
              </div>
              <div style={{ fontSize: 11.5, color: color.subtle }}>{c.framework}</div>
              <div style={{ fontSize: 11.5, color: "#7B849A", lineHeight: 1.4 }}>{c.evidence}</div>
              <div style={{ fontSize: 11.5, color: color.subtle }}>{c.owner}</div>
              <div>
                <button onClick={() => canEdit && cycle.mutate({ id: c.id, status: nextStatus })} disabled={!canEdit || cycle.isPending}
                  title={canEdit ? "Click to cycle status" : undefined}
                  style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "5px 10px", borderRadius: 20, border: "none", cursor: canEdit ? "pointer" : "default", fontFamily: "inherit" }}>{c.status}</button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Statement of Applicability — full Annex A coverage (ISO 27001) */}
      <SoaPanel projectId={projectId} />

      {addOpen && <AddControlModal projectId={projectId} onClose={() => setAddOpen(false)} />}
      {openCtl && <EditControlModal projectId={projectId} ctl={openCtl} onClose={() => setOpenCtl(null)} />}
      {gateModal && <SecReviewGateModal projectId={projectId} onClose={() => setGateModal(false)} />}
      {openGate && <SecReviewGateModal projectId={projectId} gate={openGate} onClose={() => setOpenGate(null)} />}
    </div>
  );
}

export function SecReviewGateModal({ projectId, gate, onClose }: { projectId: string; gate?: SecReviewGate; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(gate?.name ?? "");
  const [type, setType] = useState(gate?.type ?? "Security");
  const [reviewer, setReviewer] = useState(gate?.reviewer ?? "");
  const [status, setStatus] = useState(gate?.status ?? "Scheduled");
  const [date, setDate] = useState(gate?.date ?? "");
  const [note, setNote] = useState(gate?.note ?? "");
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["security", projectId] });
  const body = () => JSON.stringify({ name: name.trim(), type, reviewer: reviewer.trim(), status, date: date.trim(), note: note.trim() });
  const save = useMutation({
    mutationFn: () => gate
      ? api(`/security/review-gates/${gate.id}`, { method: "PATCH", body: body() })
      : api(`/projects/${projectId}/security/review-gates`, { method: "POST", body: body() }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/security/review-gates/${gate!.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  return (
    <Modal onClose={onClose} width={480} label={gate ? "Security review gate" : "New review gate"}>
      <DecLabel>Gate</DecLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. G2 Security review" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Type</DecLabel><Select value={type} onChange={(e) => setType(e.target.value)}>{SRG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{SRG_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Reviewer</DecLabel><Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Reviewer" /></div>
        <div style={{ flex: 1 }}><DecLabel>Date</DecLabel><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <DecLabel>Note</DecLabel>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Scope, findings, conditions…" style={{ minHeight: 56, resize: "vertical" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {gate && (confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: color.dangerInk, fontWeight: 600 }}>Delete this gate?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: color.danger }}>{del.isPending ? "Deleting…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.dangerInk, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Delete</button>
        ))}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (name.trim()) save.mutate(); }} disabled={save.isPending || !name.trim()}>{save.isPending ? "Saving…" : gate ? "Save changes" : "Add gate"}</Button>
      </div>
    </Modal>
  );
}

function EditControlModal({ projectId, ctl, onClose }: { projectId: string; ctl: SecControl; onClose: () => void }) {
  const qc = useQueryClient();
  const [control, setControl] = useState(ctl.control);
  const [framework, setFramework] = useState(ctl.framework);
  const [evidence, setEvidence] = useState(ctl.evidence === "—" ? "" : ctl.evidence);
  const [owner, setOwner] = useState(ctl.owner === "—" ? "" : ctl.owner);
  const [status, setStatus] = useState(ctl.status);
  const [description, setDescription] = useState(ctl.description);
  const [reason, setReason] = useState(ctl.reason);
  const [confirmDel, setConfirmDel] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["security", projectId] });

  const save = useMutation({
    mutationFn: () => api(`/security/controls/${ctl.id}`, { method: "PATCH", body: JSON.stringify({
      control: control.trim(), framework, evidence: evidence.trim(), owner: owner.trim(), status,
      description: description.trim(), reason: reason.trim(),
    }) }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });
  const del = useMutation({
    mutationFn: () => api(`/security/controls/${ctl.id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => toastError(e),
  });

  return (
    <Modal onClose={onClose} width={520} label={`${ctl.code} · Control`}>
      <DecLabel>Control</DecLabel>
      <Input value={control} onChange={(e) => setControl(e.target.value)} placeholder="e.g. A.8.24 Use of cryptography" style={{ marginBottom: 14 }} />
      <DecLabel>Description</DecLabel>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the control does and how it's met" style={{ minHeight: 60, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Framework</DecLabel><Select value={framework} onChange={(e) => setFramework(e.target.value)}>{FRAMEWORK_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}</Select></div>
        <div style={{ flex: 1 }}><DecLabel>Status</DecLabel><Select value={status} onChange={(e) => setStatus(e.target.value)}>{CTL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><DecLabel>Owner</DecLabel><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" /></div>
        <div style={{ flex: 1 }}><DecLabel>Evidence</DecLabel><Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Link / reference" /></div>
      </div>
      <DecLabel>Reason for change (e.g. why archived / modified)</DecLabel>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional rationale" />

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 20 }}>
        {confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: color.dangerInk, fontWeight: 600 }}>Remove this control?</span>
            <Button onClick={() => del.mutate()} disabled={del.isPending} style={{ background: "#D13438", borderColor: color.danger }}>{del.isPending ? "Removing…" : "Confirm"}</Button>
            <Button variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.dangerInk, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 4px" }}><Icon name="trash" size={15} /> Remove control</button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (control.trim()) save.mutate(); }} disabled={save.isPending || !control.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}

function SecField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function SecTextField({ value, disabled, placeholder, onCommit }: { value: string; disabled?: boolean; placeholder?: string; onCommit: (v: string) => void }) {
  // Uncontrolled + key ensures the field re-syncs when the server value changes,
  // while local typing stays uncommitted until blur (no effect-driven setState).
  return (
    <Input key={value} defaultValue={value} disabled={disabled} placeholder={placeholder}
      onBlur={(e) => { if (e.target.value !== value) onCommit(e.target.value); }} />
  );
}

function Toggle({ on, label, disabled, onClick }: { on: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <div onClick={() => !disabled && onClick()} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, padding: "9px 14px", borderRadius: 9, border: `1px solid ${color.border2}`, background: color.surfaceAlt, color: color.textMuted, cursor: disabled ? "default" : "pointer" }}>
      <span style={{ width: 34, height: 19, borderRadius: 20, background: on ? "#15A34A" : "#CBD2DE", position: "relative", flex: "none", transition: "background .15s" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: "50%", background: color.surface, transition: "left .15s" }} />
      </span>
      {label}
    </div>
  );
}

function AddControlModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [control, setControl] = useState("");
  const [framework, setFramework] = useState(FRAMEWORK_OPTS[0]);
  const [evidence, setEvidence] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState(CTL_STATUSES[0]);
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () => api(`/projects/${projectId}/security/controls`, { method: "POST", body: JSON.stringify({ control: control.trim(), framework, evidence: evidence.trim(), owner: owner.trim(), status, description: description.trim() }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security", projectId] }); onClose(); },
  });
  const submit = () => { if (control.trim()) create.mutate(); };

  return (
    <Modal onClose={onClose} width={500} label="Add a control">
      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 18 }}>Record a control and its evidence in the register.</div>
      <DecLabel>Control</DecLabel>
      <Input value={control} onChange={(e) => setControl(e.target.value)} placeholder="e.g. A.8.24 Use of cryptography" style={{ marginBottom: 14 }} />
      <DecLabel>Description</DecLabel>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the control does and how it's met" style={{ minHeight: 52, resize: "vertical", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <DecLabel>Framework</DecLabel>
          <Select value={framework} onChange={(e) => setFramework(e.target.value)}>
            {FRAMEWORK_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </div>
        <div style={{ flex: 1 }}>
          <DecLabel>Status</DecLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {CTL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>
      <DecLabel>Evidence</DecLabel>
      <Textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="What demonstrates this control is in place?" style={{ minHeight: 56, resize: "vertical", marginBottom: 14 }} />
      <DecLabel>Owner</DecLabel>
      <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Control owner" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending || !control.trim()}>{create.isPending ? "Adding…" : "Add control"}</Button>
      </div>
    </Modal>
  );
}

// ---- Epics -----------------------------------------------------------------
