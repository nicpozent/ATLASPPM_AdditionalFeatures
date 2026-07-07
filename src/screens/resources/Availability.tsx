// Extracted from Resources.tsx — the availability finder tab.
import React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { EmptyPanel } from "./shared";
import { selectStyle } from "./util";

interface AvailSlice { type: string; entityId: string; entityName: string; pct: number }
interface AvailRow { name: string; title: string; dept: string; initials: string; color: string; allocated: number; free: number; onLeave: boolean; leaveNote: string; slices: AvailSlice[] }
interface AvailData { on: string; from: string; to: string; people: AvailRow[] }

const SLICE_COLOR: Record<string, string> = {
  project: "#0F6CBD", program: "#7A3FB0", release: "#0E7C7B", product: "#C98A00", ops: "#15A34A",
};
const SLICE_LABEL: Record<string, string> = {
  project: "Projects", program: "Programs", release: "Releases", product: "Products", ops: "Ops",
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

export function AvailabilityTab() {
  const [mode, setMode] = useState<"day" | "range">("day");
  const [on, setOn] = useState(todayISO());
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [minFree, setMinFree] = useState(0);

  const qs = mode === "day" ? `on=${on}` : `from=${from}&to=${to}`;
  const { data } = useQuery({
    queryKey: ["availability", mode, on, from, to], retry: false, staleTime: 15_000,
    queryFn: async (): Promise<AvailData> =>
      (await api<AvailData>(`/resources/availability?${qs}`)) ?? { on: "", from: "", to: "", people: [] },
  });
  const people = (data?.people ?? []).filter((p) => p.free >= minFree);
  const freeCount = (data?.people ?? []).filter((p) => p.free >= 50 && !p.onLeave).length;

  const pill = (active: boolean): React.CSSProperties => ({
    padding: "6px 13px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
    fontFamily: "inherit", background: active ? color.primary : "transparent", color: active ? "#fff" : "#565F73",
  });
  const dateBox: React.CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 8, padding: "6px 9px", fontSize: 12.5, fontFamily: "inherit", color: color.text };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${color.border3}`, borderRadius: 10, padding: 3, gap: 2 }}>
          <button onClick={() => setMode("day")} style={pill(mode === "day")}>On a date</button>
          <button onClick={() => setMode("range")} style={pill(mode === "range")}>Across a window</button>
        </div>
        {mode === "day" ? (
          <input type="date" value={on} onChange={(e) => setOn(e.target.value)} style={dateBox} />
        ) : (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateBox} />
            <span style={{ fontSize: 12, color: color.faint3 }}>→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateBox} />
          </>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#56607A" }}>Min. free</span>
        <select value={minFree} onChange={(e) => setMinFree(Number(e.target.value))} aria-label="Minimum free capacity" style={selectStyle}>
          {[0, 20, 50, 80, 100].map((v) => <option key={v} value={v}>{v === 0 ? "Any" : `≥ ${v}%`}</option>)}
        </select>
      </div>

      <div style={{ fontSize: 12, color: color.faint2, marginBottom: 12 }}>
        {mode === "range"
          ? "Free = capacity free across the whole window (100% − peak load). Booked time-off marks a person unavailable."
          : "Free = 100% − load on that day. Booked time-off marks a person unavailable."}
        {" "}{freeCount} with ≥50% free.
        <span style={{ marginLeft: 12 }}>
          {Object.keys(SLICE_LABEL).map((k) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginRight: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: SLICE_COLOR[k], display: "inline-block" }} />
              <span style={{ fontSize: 11, color: color.faint2 }}>{SLICE_LABEL[k]}</span>
            </span>
          ))}
        </span>
      </div>

      {people.length === 0 ? (
        <EmptyPanel icon="users" title="No one matches" message="Try a lower minimum-free threshold or a different date." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {people.map((p) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1px solid ${color.border}`, borderRadius: 12, padding: "12px 16px" }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: p.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>{p.initials}</span>
              <div style={{ width: 170, flex: "none", minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: color.faint3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
              </div>
              {/* stacked allocation bar */}
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ display: "flex", height: 16, borderRadius: 5, overflow: "hidden", background: "#EEF1F6", border: `1px solid ${color.border3}` }} title={p.slices.map((s) => `${s.entityName} ${s.pct}%`).join(" · ")}>
                  {p.slices.map((s, i) => (
                    <div key={i} style={{ width: `${Math.min(100, s.pct)}%`, background: SLICE_COLOR[s.type] ?? color.faint2 }} title={`${SLICE_LABEL[s.type] ?? s.type}: ${s.entityName} — ${s.pct}%`} />
                  ))}
                </div>
                {p.slices.length > 0 && (
                  <div style={{ fontSize: 10.5, color: color.faint3, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.slices.map((s) => `${s.entityName} ${s.pct}%`).join(" · ")}
                  </div>
                )}
              </div>
              <div style={{ width: 96, flex: "none", textAlign: "right" }}>
                {p.onLeave ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#A1282B", background: "#FBE7E8", borderRadius: 6, padding: "3px 8px" }}>On leave{p.leaveNote ? ` · ${p.leaveNote}` : ""}</span>
                ) : (
                  <>
                    <span style={{ fontFamily: font.head, fontSize: 18, fontWeight: 700, color: p.free >= 50 ? "#0B6B37" : p.free > 0 ? color.warningAlt : color.faint2 }}>{p.free}%</span>
                    <div style={{ fontSize: 10, color: color.faint3 }}>free</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
