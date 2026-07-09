// Extracted from Project.tsx — the Architecture tab and its modals/types.
// No behaviour change; shared presentational helpers come from ./shared.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Card, EmptyBlock, Select } from "@/components/ui";
import { sectionTitleS } from "./util";

interface AdmPhase { id: number; code: string; phase: string; focus: string; owner: string; artefact: string; status: string; }
interface ArchApproval { id: number; role: string; decision: string; decidedBy: string; decidedAt: string; note: string; }
interface ArchData { canEdit: boolean; changeType: string; phases: AdmPhase[]; approvals: ArchApproval[]; arbStatus: string; }

const CHANGE_TYPES: [string, string][] = [
  ["", "— Select change type —"], ["config", "Configuration change"], ["small-enhancement", "Small enhancement"],
  ["new-integration", "New integration"], ["new-saas", "New SaaS / vendor platform"], ["business-app", "New business application"],
  ["new-product", "New product / platform"], ["core-replacement", "Core system replacement"], ["payment", "Payment / cardholder data impact"],
  ["ai-solution", "AI solution"], ["cloud-platform", "Cloud landing zone / platform"],
];
const GOV_LEVEL: Record<string, string> = {
  config: "No formal ADM", "small-enhancement": "ADM-lite (impact assessment)", "new-integration": "Architecture review required",
  "new-saas": "Full multi-domain review (arch+security+data+vendor)", "business-app": "ADM-lite or full ADM (by criticality)",
  "new-product": "Full ADM", "core-replacement": "Full ADM (strongly recommended)", payment: "Full ADM + mandatory PCI/security review",
  "ai-solution": "Full ADM + AI/data/legal governance", "cloud-platform": "Full ADM (technology/security)",
};
const ADM_STATUSES = ["Not started", "Draft", "In progress", "In review", "Approved"];
const ADM_STATUS: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: color.successInk, tint: color.successTint }, "In review": { ink: color.warningInk, tint: color.warningTint },
  "In progress": { ink: color.primaryDark, tint: color.primaryTint2 }, Draft: { ink: "#5E2E89", tint: color.accentTint }, "Not started": { ink: color.subtle, tint: color.bg },
};
const ADM_COLS = "1.6fr 1.4fr 1.1fr 1.2fr 0.9fr";

// ARB decision → label + colour, and overall board status → colour.
const ARB_DECISION: Record<string, { label: string; ink: string; tint: string }> = {
  pending: { label: "Pending", ink: color.subtle, tint: color.bg },
  approved: { label: "Approved", ink: color.successInk, tint: color.successTint },
  conditions: { label: "With conditions", ink: color.primaryDark, tint: color.primaryTint2 },
  rejected: { label: "Rejected", ink: color.dangerInk, tint: color.dangerTint },
};
const ARB_OVERALL: Record<string, { ink: string; tint: string }> = {
  Approved: { ink: color.successInk, tint: color.successTint }, "Approved with conditions": { ink: color.primaryDark, tint: color.primaryTint2 },
  Rejected: { ink: color.dangerInk, tint: color.dangerTint }, "In review": { ink: color.warningInk, tint: color.warningTint },
  Pending: { ink: color.subtle, tint: color.bg }, "Not started": { ink: color.subtle, tint: color.bg },
};

export function Architecture({ projectId }: { projectId: string | null }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["architecture", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<ArchData | null> => await api<ArchData>(`/projects/${projectId}/architecture`),
  });
  const setType = useMutation({
    mutationFn: (changeType: string) => api(`/projects/${projectId}/architecture`, { method: "PATCH", body: JSON.stringify({ changeType }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["architecture", projectId] }),
  });
  const cycle = useMutation({
    mutationFn: (v: { id: number; status: string }) => api(`/adm-phases/${v.id}`, { method: "PATCH", body: JSON.stringify({ status: v.status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["architecture", projectId] }),
  });
  const decide = useMutation({
    mutationFn: (v: { id: number; decision: string; note?: string }) => api(`/arch-approvals/${v.id}`, { method: "PATCH", body: JSON.stringify({ decision: v.decision, note: v.note ?? "" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["architecture", projectId] }),
  });

  if (!projectId) return <Card><EmptyBlock minHeight={220} message="Select a project from the Portfolio to view its architecture governance." /></Card>;
  if (!data) return <Card><EmptyBlock minHeight={220} message="Loading architecture governance…" /></Card>;

  const { changeType, phases, canEdit, approvals = [], arbStatus = "Not started" } = data;
  const level = GOV_LEVEL[changeType] ?? "Architecture triage required";
  const full = level.startsWith("Full");
  const arbOverall = ARB_OVERALL[arbStatus] ?? ARB_OVERALL["Not started"];
  const signedOff = approvals.filter((a) => a.decision !== "pending").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.faint }}>Architecture triage, tailored TOGAF ADM &amp; phase governance.</div>
        <div style={{ flex: 1 }} />
        {canEdit && <span style={{ fontSize: 11, fontWeight: 600, color: "#5E2E89", background: color.accentTint, padding: "4px 10px", borderRadius: 6 }}>Chief Architect controls enabled</span>}
      </div>

      {/* triage / impact assessment */}
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={sectionTitleS}>Architecture impact assessment</div>
            <div style={{ fontSize: 12, color: color.faint2 }}>Every initiative is triaged; governance depth is tailored to change type.</div>
          </div>
          <div style={{ minWidth: 240 }}>
            <Select value={changeType} disabled={!canEdit} onChange={(e) => setType.mutate(e.target.value)}>
              {CHANGE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: color.accentTint, border: "1px solid #E4D7F0", borderRadius: 10, padding: "12px 15px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#5E2E89", textTransform: "uppercase", letterSpacing: "0.04em" }}>Required governance</span>
          <span style={{ fontFamily: font.head, fontSize: 14, fontWeight: 700, color: "#3B1A5C" }}>{level}</span>
          {full && <span style={{ fontSize: 10.5, fontWeight: 700, color: color.dangerInk, background: color.dangerTint, padding: "3px 9px", borderRadius: 6 }}>Architecture-significant</span>}
        </div>
      </Card>

      {/* ADM phase tracker */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px 13px", ...sectionTitleS }}>TOGAF ADM phase tracker</div>
        <div style={{ display: "grid", gridTemplateColumns: ADM_COLS, padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          <div>Phase</div><div>Focus</div><div>Owner</div><div>Key artefact</div><div>Status</div>
        </div>
        {phases.map((p) => {
          const sc = ADM_STATUS[p.status] ?? ADM_STATUS["Not started"];
          const next = ADM_STATUSES[(ADM_STATUSES.indexOf(p.status) + 1) % ADM_STATUSES.length];
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: ADM_COLS, alignItems: "center", padding: "12px 22px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
              <div style={{ fontSize: 13, color: color.text, fontWeight: 600 }}>{p.phase}</div>
              <div style={{ fontSize: 12, color: color.faint }}>{p.focus}</div>
              <div style={{ fontSize: 12, color: color.subtle }}>{p.owner}</div>
              <div style={{ fontSize: 12, color: color.faint }}>{p.artefact}</div>
              <div>
                <button onClick={() => canEdit && cycle.mutate({ id: p.id, status: next })} disabled={!canEdit || cycle.isPending}
                  title={canEdit ? "Click to advance status" : undefined}
                  style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "4px 10px", borderRadius: 6, border: "none", cursor: canEdit ? "pointer" : "default", fontFamily: "inherit" }}>{p.status}</button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Architecture Review Board — independent per-role sign-offs */}
      <Card padding={0} style={{ overflow: "hidden", marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px 6px" }}>
          <span style={{ ...sectionTitleS, flex: 1 }}>Architecture Review Board</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: arbOverall.ink, background: arbOverall.tint, padding: "5px 12px", borderRadius: 20 }}>{arbStatus}</span>
        </div>
        <div style={{ padding: "0 22px 12px", fontSize: 11.5, color: color.faint2, lineHeight: 1.45 }}>
          Each sign-off is an independent approval by an architecture role. ARB — not the PMO — owns architectural correctness; the overall verdict is the roll-up of every role's decision. <b style={{ color: color.text }}>{signedOff}/{approvals.length}</b> recorded.
        </div>
        {approvals.map((a) => {
          const dc = ARB_DECISION[a.decision] ?? ARB_DECISION.pending;
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderTop: `1px solid ${color.surfaceAlt}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{a.role}</div>
                <div style={{ fontSize: 11.5, color: color.faint3 }}>
                  {a.decision === "pending" ? "Awaiting sign-off" : `${a.decidedBy || "—"} · ${a.decidedAt || "—"}`}
                  {a.note ? ` · ${a.note}` : ""}
                </div>
              </div>
              {canEdit ? (
                <select value={a.decision} onChange={(e) => {
                  const decision = e.target.value;
                  const note = decision === "conditions" || decision === "rejected"
                    ? (window.prompt(decision === "rejected" ? "Reason for rejection (optional):" : "Conditions to attach (optional):", a.note) ?? "")
                    : "";
                  decide.mutate({ id: a.id, decision, note });
                }}
                  style={{ fontSize: 11.5, fontWeight: 700, color: dc.ink, background: dc.tint, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="conditions">With conditions</option>
                  <option value="rejected">Rejected</option>
                </select>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, color: dc.ink, background: dc.tint, padding: "4px 10px", borderRadius: 6 }}>{dc.label}</span>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ---- Detect Risks + Draft Status Report ------------------------------------
