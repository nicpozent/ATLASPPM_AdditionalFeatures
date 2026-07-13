// Statement of Applicability (ISO 27001:2022 Annex A) — the ISMS's mandatory
// record of which controls apply to this project, why, and their implementation
// status. The full 93-control catalogue always renders (grouped by the four
// Annex A themes), so control coverage is complete by construction; governance
// (cap-approve) edits each decision. Approved extension — see CLAUDE.md §2 /
// ADR-0066. Built from the existing theme tokens + shared UI, no new deps.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Card, EmptyBlock, Select } from "@/components/ui";
import { toastError } from "@/components/Toast";
import { type SoaControl, summariseThemes } from "./soa";

interface SoaCoverage { total: number; applicable: number; excluded: number; implemented: number; reviewed: number; implementedPct: number; }
interface SoaData { canEdit: boolean; coverage: SoaCoverage; controls: SoaControl[]; }

const THEMES = ["Organizational", "People", "Physical", "Technological"] as const;
const STATUSES = ["Not started", "Planned", "Partial", "Implemented"] as const;
const STATUS_STYLE: Record<string, { ink: string; tint: string }> = {
  "Not started": { ink: color.faint2, tint: color.bg },
  Planned: { ink: color.warningInk, tint: color.warningTint },
  Partial: { ink: "#8A6300", tint: color.warningTint },
  Implemented: { ink: color.successInk, tint: color.successTint },
};
const SOA_COLS = "78px 1fr 118px 150px 130px";

export function SoaPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Record<string, boolean>>({ Organizational: true });
  const { data } = useQuery({
    queryKey: ["soa", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<SoaData | null> => (await api<SoaData>(`/projects/${projectId}/soa`)) ?? null,
  });

  const save = useMutation({
    mutationFn: (v: { ref: string; patch: Partial<Pick<SoaControl, "applicable" | "status" | "justification" | "owner">> }) =>
      api(`/projects/${projectId}/soa/${v.ref}`, { method: "PUT", body: JSON.stringify(v.patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["soa", projectId] }),
    onError: (e) => toastError(e as Error),
  });

  if (!data) return null;
  const { canEdit, coverage, controls } = data;

  return (
    <Card padding={0} style={{ overflow: "hidden", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 22px", borderBottom: `1px solid ${color.bg}`, flexWrap: "wrap" }}>
        <span style={{ flex: 1, fontFamily: font.head, fontSize: 14.5, fontWeight: 600, color: color.ink }}>Statement of Applicability
          <span style={{ fontSize: 11.5, fontWeight: 600, color: color.faint2, marginLeft: 8 }}>ISO/IEC 27001:2022 · Annex A</span>
        </span>
        <Kpi label="Applicable" value={`${coverage.applicable}/${coverage.total}`} />
        <Kpi label="Excluded" value={coverage.excluded} />
        <Kpi label="Reviewed" value={`${coverage.reviewed}/${coverage.total}`} />
        <Kpi label="Implemented" value={`${coverage.implementedPct}%`} tint={color.successTint} ink={color.successInk} />
      </div>

      {controls.length === 0 ? (
        <EmptyBlock message="No Annex A catalogue loaded." minHeight={120} />
      ) : summariseThemes(controls, THEMES).map(({ theme, controls: rows, applicable: appl, implemented: impl }) => {
        const isOpen = open[theme] ?? false;
        return (
          <div key={theme}>
            <button type="button" onClick={() => setOpen((s) => ({ ...s, [theme]: !isOpen }))}
              aria-expanded={isOpen}
              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "11px 22px", background: color.surfaceAlt, border: "none", borderBottom: `1px solid ${color.bg}`, cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ fontSize: 12, color: color.faint2, width: 12 }}>{isOpen ? "▾" : "▸"}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: color.text }}>{theme}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: color.faint, background: color.surface, border: `1px solid ${color.border}`, padding: "0 8px", borderRadius: 20 }}>{rows.length}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: color.faint2 }}>{impl}/{appl} implemented</span>
            </button>
            {isOpen && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: SOA_COLS, gap: 10, padding: "9px 22px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
                  <div>Ref</div><div>Control</div><div>Applicable</div><div>Status</div><div>Owner</div>
                </div>
                {rows.map((c) => (
                  <SoaRow key={c.ref} c={c} canEdit={canEdit} saving={save.isPending}
                    onSave={(patch) => save.mutate({ ref: c.ref, patch })} />
                ))}
              </>
            )}
          </div>
        );
      })}
    </Card>
  );
}

function SoaRow({ c, canEdit, saving, onSave }: {
  c: SoaControl; canEdit: boolean; saving: boolean;
  onSave: (patch: Partial<Pick<SoaControl, "applicable" | "status" | "justification" | "owner">>) => void;
}) {
  const ss = STATUS_STYLE[c.status] ?? STATUS_STYLE["Not started"];
  const dim = !c.applicable;
  return (
    <div style={{ display: "grid", gridTemplateColumns: SOA_COLS, gap: 10, alignItems: "center", padding: "10px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, opacity: dim ? 0.55 : 1 }}>
      <div style={{ fontFamily: font.mono, fontSize: 11, color: color.faint3 }}>{c.ref}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: color.text, fontWeight: 500 }}>{c.title}</div>
        {canEdit ? (
          <input
            key={c.justification} defaultValue={c.justification}
            onBlur={(e) => { const v = e.target.value.trim(); if (v !== c.justification) onSave({ justification: v }); }}
            placeholder={c.applicable ? "Justification / implementation note…" : "Reason for exclusion (required for audit)…"}
            style={{ width: "100%", marginTop: 4, fontSize: 11, fontFamily: "inherit", color: color.subtle, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 6, padding: "4px 7px" }}
          />
        ) : c.justification ? (
          <div style={{ fontSize: 10.5, color: color.faint3, fontStyle: "italic", marginTop: 2 }}>{c.justification}</div>
        ) : null}
      </div>
      <div>
        <button type="button" disabled={!canEdit || saving} onClick={() => onSave({ applicable: !c.applicable })}
          title={canEdit ? "Toggle applicability" : undefined}
          style={{ fontSize: 10.5, fontWeight: 700, color: c.applicable ? color.successInk : color.faint2, background: c.applicable ? color.successTint : color.bg, border: "none", padding: "5px 11px", borderRadius: 20, cursor: canEdit ? "pointer" : "default", fontFamily: "inherit" }}>
          {c.applicable ? "Applicable" : "Excluded"}
        </button>
      </div>
      <div>
        {canEdit && c.applicable ? (
          <Select value={c.status} onChange={(e) => onSave({ status: e.target.value })} style={{ fontSize: 11.5, padding: "5px 8px" }}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: ss.ink, background: ss.tint, padding: "4px 10px", borderRadius: 20 }}>{c.applicable ? c.status : "—"}</span>
        )}
      </div>
      <div>
        {canEdit ? (
          <input key={c.owner} defaultValue={c.owner}
            onBlur={(e) => { const v = e.target.value.trim(); if (v !== c.owner) onSave({ owner: v }); }}
            placeholder="—"
            style={{ width: "100%", fontSize: 11.5, fontFamily: "inherit", color: color.subtle, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 6, padding: "4px 7px" }}
          />
        ) : (
          <span style={{ fontSize: 11.5, color: color.subtle }}>{c.owner || "—"}</span>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tint, ink }: { label: string; value: string | number; tint?: string; ink?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: tint ?? color.bg, borderRadius: 8, padding: "5px 12px", minWidth: 66 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: ink ?? color.text, fontFamily: font.head }}>{value}</span>
      <span style={{ fontSize: 9.5, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
    </div>
  );
}
