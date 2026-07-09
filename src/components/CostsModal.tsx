import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { color } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Modal, Button, Input, Select } from "@/components/ui";

// ============================================================================
//  Role-owned cost lines — shared across Project / Program / Product. Each owner
//  carries the same taxonomy (labour Dev/Arch/Infra, License, PaaS/IaaS/SaaS,
//  Vendor, Savings). A line's amount is editable only by the roles that own it
//  (plus PMO/Admin); PMO/Admin can add custom lines and remove custom ones.
//  Amounts shown in € thousands (stored in whole euros). The API is authoritative.
// ============================================================================
export type CostScope = "projects" | "programs" | "products";
const SCOPE_LABEL: Record<CostScope, string> = { projects: "Project", programs: "Program", products: "Product" };

interface CostLine { id: number; label: string; note: string; ownerRoles: string[]; amount: number; canEdit: boolean; isSystem: boolean; }
interface CostsData { canManage: boolean; total: number; savings: number; lines: CostLine[]; }

// Owner presets for custom lines (map a friendly choice to the UI roles that own it).
const OWNER_PRESETS: { label: string; roles: string[] }[] = [
  { label: "PMO / Admin only", roles: [] },
  { label: "Dev (Eng / Dev Manager)", roles: ["teammgr", "devmgr"] },
  { label: "Infra (Infra / Service Manager)", roles: ["inframgr", "svcmgr"] },
  { label: "Architecture (Chief Architect)", roles: ["architect"] },
];

const fmtK = (euros: number) => "€" + (euros / 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + "k";

type CostKind = "actual" | "forecast";

export function CostsModal({ scope, id, name, onClose }: { scope: CostScope; id: string; name: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<CostKind>("actual");
  const key = ["costs", scope, id, kind];
  const { data } = useQuery({
    queryKey: key, retry: false, staleTime: 15_000,
    queryFn: async (): Promise<CostsData> => (await api<CostsData>(`/${scope}/${id}/costs?kind=${kind}`)) ?? { canManage: false, total: 0, savings: 0, lines: [] },
  });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["costs", scope, id] }); qc.invalidateQueries({ queryKey: ["financials"] }); };
  const save = useMutation({
    mutationFn: (v: { lineId: number; amount: number }) => api(`/costs/${v.lineId}`, { method: "PATCH", body: JSON.stringify({ amount: v.amount }) }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (lineId: number) => api(`/costs/${lineId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const [adding, setAdding] = useState(false);

  const data0 = data ?? { canManage: false, total: 0, savings: 0, lines: [] };
  const lines = data0.lines;

  return (
    <Modal onClose={onClose} width={520} label={`${SCOPE_LABEL[scope]} costs · ${name}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: color.successTint, color: color.successInk, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="coins" size={18} /></span>
        <div style={{ fontSize: 12, color: color.faint2 }}>€ thousands · You can edit only the cost lines your role owns.</div>
      </div>
      {/* Spent to date vs Forecast at completion — same taxonomy, separate figures */}
      <div style={{ display: "inline-flex", background: color.border3, borderRadius: 9, padding: 3, gap: 2, marginBottom: 14 }}>
        {([["actual", "Spent to date"], ["forecast", "Forecast at completion"]] as [CostKind, string][]).map(([k, lbl]) => (
          <button key={k} onClick={() => setKind(k)} style={{ padding: "6px 13px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", background: kind === k ? color.surface : "transparent", color: kind === k ? color.primary : color.subtle, boxShadow: kind === k ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>{lbl}</button>
        ))}
      </div>

      {lines.map((ln) => (
        <div key={ln.id} style={{ marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>
            <span>{ln.label} <span style={{ color: color.faint3 }}>· {ln.note}</span></span>
            <div style={{ flex: 1 }} />
            {data0.canManage && !ln.isSystem && (
              <button onClick={() => remove.mutate(ln.id)} title="Remove custom line" style={{ border: "none", background: "transparent", color: "#B0546A", cursor: "pointer", display: "flex", padding: 0 }}><Icon name="trash" size={13} /></button>
            )}
          </label>
          <CostInput line={ln} onCommit={(amount) => save.mutate({ lineId: ln.id, amount })} />
        </div>
      ))}

      {/* Totals */}
      <div style={{ display: "flex", gap: 16, padding: "12px 0", borderTop: `1px solid ${color.bg}`, marginTop: 6 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: color.faint3 }}>Total cost</div><div style={{ fontSize: 16, fontWeight: 700, color: color.text }}>{fmtK(data0.total)}</div></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: color.faint3 }}>Savings / benefit</div><div style={{ fontSize: 16, fontWeight: 700, color: color.successInk }}>{fmtK(data0.savings)}</div></div>
      </div>

      {/* Add custom line (PMO / Admin) */}
      {data0.canManage && (adding
        ? <AddLineForm scope={scope} id={id} kind={kind} onDone={() => { setAdding(false); invalidate(); }} onCancel={() => setAdding(false)} />
        : <button onClick={() => setAdding(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.primary, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}><Icon name="plus" size={14} /> Add custom cost line</button>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}

function AddLineForm({ scope, id, kind, onDone, onCancel }: { scope: CostScope; id: string; kind: CostKind; onDone: () => void; onCancel: () => void }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [ownerIdx, setOwnerIdx] = useState(0);
  const create = useMutation({
    mutationFn: () => api(`/${scope}/${id}/costs?kind=${kind}`, {
      method: "POST",
      body: JSON.stringify({ label: label.trim(), ownerRoles: OWNER_PRESETS[ownerIdx].roles, amount: Math.round((parseFloat(amount) || 0) * 1000) }),
    }),
    onSuccess: onDone,
  });
  return (
    <div style={{ border: `1px solid ${color.border}`, borderRadius: 10, padding: 14, marginTop: 6, background: color.bg }}>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>New cost line</label>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. External audit · consultancy" style={{ marginBottom: 10 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr", gap: 10 }}>
        <Select value={String(ownerIdx)} onChange={(e) => setOwnerIdx(Number(e.target.value))}>
          {OWNER_PRESETS.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
        </Select>
        <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="€k" />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <Button variant="secondary" onClick={onCancel} style={{ padding: "8px 14px" }}>Cancel</Button>
        <Button onClick={() => label.trim() && create.mutate()} disabled={create.isPending || !label.trim()} style={{ padding: "8px 14px" }}>{create.isPending ? "Adding…" : "Add line"}</Button>
      </div>
    </div>
  );
}

// Uncontrolled + key so it re-syncs after save; edits commit on blur. € thousands.
function CostInput({ line, onCommit }: { line: CostLine; onCommit: (amountEuros: number) => void }) {
  const shown = (line.amount / 1000).toFixed(2);
  return (
    <Input key={shown} type="number" step="0.01" defaultValue={shown} disabled={!line.canEdit}
      title={line.canEdit ? undefined : "Owned by another role — read-only for you"}
      onBlur={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && (v * 1000) !== line.amount) onCommit(Math.round(v * 1000));
      }}
      style={line.canEdit ? undefined : { background: color.bg, color: color.faint2, cursor: "not-allowed" }} />
  );
}
