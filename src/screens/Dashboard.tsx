import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { color, font } from "@/theme";
import { Icon } from "@/components/Icon";
import { useRole } from "@/components/RoleContext";
import { SCREENS } from "@/nav";
import { LAYOUT_TABS, type LayoutId, useDashboard, EMPTY_DASHBOARD } from "./dashboard/data";
import { Executive } from "./dashboard/Executive";
import { Operational } from "./dashboard/Operational";
import { Compact } from "./dashboard/Compact";
import { Custom } from "./dashboard/Custom";

const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

export default function Dashboard() {
  const [layout, setLayout] = useState<LayoutId>("executive");
  const navigate = useNavigate();
  const { identity } = useRole();
  const { data, isLoading } = useDashboard();
  const d = data ?? EMPTY_DASHBOARD;

  const openProject = (id: string) => navigate(`${SCREENS.project.path}?id=${id}`);
  const firstName = (identity?.name || "").trim().split(" ")[0] || "there";

  const attentionCount = d.attention.length;
  const approvalCount = d.approvals.length;

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* hero */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 13, color: color.faint, marginBottom: 4 }}>{today}</div>
          <h1 style={{ fontFamily: font.head, fontSize: 30, fontWeight: 600, color: color.ink, margin: 0, letterSpacing: "-0.02em" }}>Welcome back, {firstName}</h1>
          <p style={{ margin: "7px 0 0", fontSize: 14.5, color: color.subtle }}>
            You have <b style={{ color: color.primary }}>{approvalCount} approval{approvalCount === 1 ? "" : "s"}</b> waiting and{" "}
            <b style={{ color: color.dangerInk }}>{attentionCount} project{attentionCount === 1 ? "" : "s"}</b> need attention across the Biltema portfolio.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate(SCREENS.demands.path)} style={heroBtn}><Icon name="inbox" size={16} /> Review demands</button>
          <button onClick={() => navigate(SCREENS.gantt.path)} style={heroBtn}><Icon name="gantt" size={16} /> Open timeline</button>
        </div>
      </div>

      {/* layout switcher */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2 }}>
          {LAYOUT_TABS.map((t) => {
            const active = layout === t.id;
            return (
              <button key={t.id} onClick={() => setLayout(t.id)} style={{
                padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                background: active ? "#fff" : "transparent", color: active ? color.primary : "#565F73",
                boxShadow: active ? "0 1px 3px rgba(20,26,60,0.12)" : "none",
              }}>{t.label}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 12.5, color: color.faint2 }}>{LAYOUT_TABS.find((t) => t.id === layout)?.hint}</div>
        {isLoading && <div style={{ fontSize: 12, color: color.faint3 }}>Loading…</div>}
      </div>

      {layout === "executive" && <Executive d={d} onProject={openProject} onPortfolio={() => navigate(SCREENS.portfolio.path)} />}
      {layout === "operational" && <Operational d={d} onProject={openProject} />}
      {layout === "compact" && <Compact d={d} onProject={openProject} />}
      {layout === "custom" && <Custom d={d} />}
    </div>
  );
}

const heroBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, background: color.surface, border: `1px solid ${color.border2}`,
  color: color.text, borderRadius: 9, padding: "10px 15px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
