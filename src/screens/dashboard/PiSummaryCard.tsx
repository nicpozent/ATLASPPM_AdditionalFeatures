import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { color, font, chart } from "@/theme";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/ui";
import { api } from "@/api";
import {
  type IncrementDetail, type IncrementSummary,
  objectiveRollup, iterationTotals, confColor,
} from "@/screens/pip/data";

// Executive dashboard widget — a read-only snapshot of the active Program
// Increment, linking the dashboard to PI Planning. Self-contained: it fetches
// its own data and reuses the PIP derivations. Empty/absent increments degrade
// to a tasteful prompt rather than a blank card.
export function PiSummaryCard() {
  const navigate = useNavigate();

  const list = useQuery({
    queryKey: ["increments"], retry: false, staleTime: 60_000,
    queryFn: async () => { try { return (await api<{ increments: IncrementSummary[] }>("/increments"))?.increments ?? []; } catch { return []; } },
  });
  // Prefer the Active increment; else the most recent (the list is newest-first).
  const active = list.data?.find((i) => i.state === "Active") ?? list.data?.[0] ?? null;

  const detail = useQuery({
    queryKey: ["increment", active?.id], enabled: active != null, retry: false, staleTime: 60_000,
    queryFn: async () => { try { return await api<IncrementDetail>(`/increments/${active!.id}`); } catch { return null; } },
  });

  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
      <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Program increment</div>
      <button onClick={() => navigate("/pi-planning")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: color.primary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        PI Planning <Icon name="arrowRight" size={13} />
      </button>
    </div>
  );

  if (!active) {
    return (
      <Card padding="18px 19px">
        {header}
        <div style={{ fontSize: 13, color: color.faint3, padding: "8px 0" }}>No active program increment yet.</div>
      </Card>
    );
  }

  const inc = detail.data;
  const { committed, meanConf } = inc ? objectiveRollup(inc.objectiveList) : { committed: [], meanConf: 0 };
  const overIters = inc ? inc.iterationList.filter((it) => iterationTotals([it]).over).length : 0;
  const blockedDeps = inc ? inc.dependencyList.filter((d) => d.status === "Blocked").length : 0;
  const doneObj = committed.filter((o) => o.status === "Done").length;

  const metric = (label: string, value: string, tone?: string) => (
    <div style={{ background: color.surfaceAlt, border: `1px solid ${color.border}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontFamily: font.head, fontSize: 20, fontWeight: 700, color: tone ?? color.ink, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: color.faint2, marginTop: 4 }}>{label}</div>
    </div>
  );

  return (
    <Card padding="18px 19px">
      {header}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{active.name}</span>
        {active.key && <span style={{ fontFamily: font.mono, fontSize: 11, color: color.faint2 }}>{active.key}</span>}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: color.primaryDark, background: color.primaryTint2, padding: "2px 8px", borderRadius: 6 }}>{active.state}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        {metric(`Committed objectives${committed.length ? ` · ${doneObj} done` : ""}`, String(committed.length))}
        {metric("Mean confidence · of 5", meanConf ? meanConf.toFixed(1) : "—", meanConf ? confColor(Math.round(meanConf)) : undefined)}
        {metric("Over-allocated iterations", String(overIters), overIters > 0 ? color.danger : chart.onTrack)}
        {metric("Blocked dependencies", String(blockedDeps), blockedDeps > 0 ? color.danger : chart.onTrack)}
      </div>
    </Card>
  );
}
