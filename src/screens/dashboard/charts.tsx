// ============================================================================
//  Dashboard chart primitives — ported from the prototype's SVG builders
//  (makeSpark, makeDonut, makeBudgetChart, makeGauge). Each renders an empty
//  variant when it has no data, so the layout holds its shape before data loads.
// ============================================================================
import { font, color, chart } from "@/theme";

// ---- Sparkline (makeSpark) -------------------------------------------------
export function Sparkline({ points, stroke, width = 92, height = 30 }: {
  points: number[]; stroke: string; width?: number; height?: number;
}) {
  if (!points.length) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <line x1={0} y1={height - 4} x2={width} y2={height - 4} style={{ stroke: color.neutralTint }} strokeWidth={2} strokeDasharray="3 3" strokeLinecap="round" />
      </svg>
    );
  }
  const max = Math.max(...points), min = Math.min(...points), r = max - min || 1;
  const X = (i: number) => (i / (points.length - 1)) * width;
  const Y = (v: number) => height - 3 - ((v - min) / r) * (height - 7);
  const d = points.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const area = `${d} L${width} ${height} L0 ${height} Z`;
  // Sanitise the gradient id: `stroke` may be a themeable `var(--…)` token, so
  // strip everything but alphanumerics to keep the SVG id (and its url(#…) ref)
  // valid. Colours are applied via `style` so var() resolves (SVG presentation
  // attributes don't substitute var()).
  const id = `sp-${stroke.replace(/[^a-zA-Z0-9]/g, "")}-${points.length}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0%" style={{ stopColor: stroke, stopOpacity: 0.24 }} />
          <stop offset="100%" style={{ stopColor: stroke, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" style={{ stroke }} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---- Health donut (makeDonut) ----------------------------------------------
export function HealthDonut({ segments, size = 158, thickness = 24 }: {
  segments: { value: number; color: string }[]; size?: number; thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const onTrackPct = total ? Math.round((segments[0]?.value ?? 0) / total * 100) : 0;
  let acc = 0;
  const stops = total
    ? segments.map((s) => { const a = acc / total * 360; acc += s.value; const b = acc / total * 360; return `${s.color} ${a}deg ${b}deg`; }).join(",")
    : `${color.neutralTint} 0deg 360deg`;
  const inner = size - thickness * 2;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `conic-gradient(${stops})`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <div style={{ width: inner, height: inner, borderRadius: "50%", background: color.surface, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: `inset 0 0 0 1px ${color.neutralTint}` }}>
        <div style={{ fontFamily: font.head, fontSize: 34, fontWeight: 700, color: total ? color.ink : color.faint3, lineHeight: 1 }}>{total ? `${onTrackPct}%` : "—"}</div>
        <div style={{ fontSize: 10.5, color: color.faint2, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>On track</div>
      </div>
    </div>
  );
}

// ---- Budget burn area chart (makeBudgetChart) ------------------------------
export function BudgetChart({ months, planned, actual, max, width = 300, height = 150 }: {
  months: string[]; planned: number[]; actual: number[]; max: number; width?: number; height?: number;
}) {
  const padL = 6, padR = 6, padT = 12, padB = 22;
  const iw = width - padL - padR, ih = height - padT - padB;
  const empty = !actual.length || !months.length;
  const grid = [0, 0.5, 1].map((f, i) => (
    <line key={i} x1={padL} x2={width - padR} y1={padT + f * ih} y2={padT + f * ih} style={{ stroke: color.neutralTint }} strokeWidth={1} />
  ));
  if (empty) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="Budget burn (no data)">
        {grid}
        <text x={width / 2} y={height / 2} fontSize={11} style={{ fill: color.faint3 }} textAnchor="middle" fontFamily="Public Sans">No spend data yet</text>
      </svg>
    );
  }
  const X = (i: number) => padL + (i / (months.length - 1)) * iw;
  const Y = (v: number) => padT + (1 - v / max) * ih;
  const line = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const area = `${line(actual)} L${X(actual.length - 1).toFixed(1)} ${(padT + ih).toFixed(1)} L${X(0).toFixed(1)} ${(padT + ih).toFixed(1)} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="bgrad" x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0%" style={{ stopColor: color.primary, stopOpacity: 0.2 }} />
          <stop offset="100%" style={{ stopColor: color.primary, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {grid}
      <path d={area} fill="url(#bgrad)" />
      <path d={line(planned)} fill="none" style={{ stroke: chart.planned }} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
      <path d={line(actual)} fill="none" style={{ stroke: color.primary }} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {actual.map((v, i) => (
        <circle key={i} cx={X(i)} cy={Y(v)} r={i === actual.length - 1 ? 3.5 : 2.4} style={{ fill: color.primary }} stroke="#fff" strokeWidth={1.4} />
      ))}
      {months.map((m, i) => (
        <text key={m} x={X(i)} y={height - 6} fontSize={9.5} style={{ fill: color.faint3 }} textAnchor="middle" fontFamily="Public Sans">{m}</text>
      ))}
    </svg>
  );
}

// ---- Radial gauge (makeGauge) ----------------------------------------------
export function Gauge({ pct, stroke, size = 96 }: { pct: number | null; stroke: string; size?: number }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r, val = pct ?? 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: color.neutralTint }} strokeWidth={8} />
      {pct != null && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke }} strokeWidth={8}
          strokeLinecap="round" strokeDasharray={`${(val / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      )}
      <text x={size / 2} y={size / 2 + 5} fontSize={19} fontWeight={700} style={{ fill: color.ink }} textAnchor="middle" fontFamily={font.head}>
        {pct != null ? `${pct}%` : "—"}
      </text>
    </svg>
  );
}
