import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { HealthPill, ProgressBar, QueryState, statusDot } from "@/components/ui";
import { SCREENS } from "@/nav";

// A stakeholder is listed on a subset of projects — read-only status & progress.
interface StakeholderProject {
  id: string; name: string; dept: string;
  status: "green" | "amber" | "red" | "hold"; health: string;
  progress: number; target: string; phase: string;
}

function useMyProjects() {
  return useQuery({
    queryKey: ["projects", "my"], retry: false, staleTime: 60_000,
    // No error-swallow here — a failed read must surface (QueryState renders it),
    // not silently look like "no projects".
    queryFn: async (): Promise<StakeholderProject[]> => (await api<StakeholderProject[]>("/projects/my")) ?? [],
  });
}

export default function MyProjects() {
  const q = useMyProjects();
  const navigate = useNavigate();
  const openProject = (id: string) => navigate(`${SCREENS.project.path}?id=${id}`);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 13.5, color: color.subtle, marginBottom: 16 }}>
        You are listed as a <b style={{ color: "#0E7C7B" }}>stakeholder</b> on these projects. Read-only access to status &amp; progress.
      </div>

      <QueryState query={q} minHeight={200} isEmpty={(ps) => ps.length === 0}
        empty="You are not listed as a stakeholder on any projects yet.">
        {(projects) => (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
            {projects.map((p) => {
              const dot = statusDot(p.status);
              return (
                <div
                  key={p.id}
                  onClick={() => openProject(p.id)}
                  style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14, padding: 19, cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: dot, flex: "none" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: color.ink }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono }}>{p.id} · {p.dept}</div>
                    </div>
                    <HealthPill status={p.status} label={p.health} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                    <ProgressBar pct={p.progress} fill={dot} height={7} />
                    <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.textMuted }}>{p.progress}%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: color.subtle }}>
                    <Icon name="calendar" size={14} /> Target {p.target} · {p.phase}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
  );
}
