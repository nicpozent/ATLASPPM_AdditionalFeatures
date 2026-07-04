import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, HealthPill, ProgressBar, statusDot, Button, Input, Select, Textarea } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { SCREENS } from "@/nav";
import {
  STATUS_FILTERS, useProjects, useBlockers, type Blocker, type BlockerStatus,
} from "./portfolio/data";

const fmtBudget = (v: number) => "€" + (v / 1000).toFixed(1) + "M";
const BLK_COLORS: Record<BlockerStatus, { dot: string; ink: string; tint: string }> = {
  Active:        { dot: "#D13438", ink: "#A1282B", tint: "#FBE7E8" },
  "In progress": { dot: "#E0A100", ink: "#8A6300", tint: "#FBF2D7" },
  Resolved:      { dot: "#15A34A", ink: "#0B6B37", tint: "#E7F4EC" },
};

interface RaiseBlocker { title: string; projectId: string; owner: string; status: BlockerStatus; }

export default function Portfolio() {
  const [tab, setTab] = useState<"projects" | "blockers">("projects");
  const [filter, setFilter] = useState<string>("all");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: blockers = [] } = useBlockers();
  const { can } = usePermissions();

  const raiseBlocker = useMutation({
    mutationFn: (body: RaiseBlocker) => api("/blockers", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blockers"] });
      qc.invalidateQueries({ queryKey: ["projects"] }); // blockerCount changes
    },
  });

  const blkCounts = {
    active: blockers.filter((b) => b.status === "Active").length,
    inProgress: blockers.filter((b) => b.status === "In progress").length,
    resolved: blockers.filter((b) => b.status === "Resolved").length,
  };
  const filtered = projects.filter((p) => STATUS_FILTERS.find((f) => f.key === filter)?.match(p) ?? true);
  const openProject = (id: string) => navigate(`${SCREENS.project.path}?id=${id}`);

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* sub-tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2 }}>
          <TabBtn active={tab === "projects"} onClick={() => setTab("projects")}>Projects</TabBtn>
          <TabBtn active={tab === "blockers"} onClick={() => setTab("blockers")}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              Blockers <span style={{ fontSize: 11, fontWeight: 700, background: "#D13438", color: "#fff", borderRadius: 20, padding: "1px 7px", fontFamily: font.mono }}>{blkCounts.active}</span>
            </span>
          </TabBtn>
        </div>
        <div style={{ flex: 1 }} />
        <Button variant="secondary"><Icon name="search" size={16} /> Filter</Button>
        <Button disabled={!can("cap-projects", "F")} title={can("cap-projects", "F") ? undefined : "Your role can't create projects"}><Icon name="plus" size={16} /> New project</Button>
      </div>

      {tab === "projects" ? (
        <>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
            {STATUS_FILTERS.map((f) => {
              const count = f.key === "all" ? projects.length : projects.filter((p) => f.match(p)).length;
              const active = filter === f.key;
              return (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit",
                  color: f.key === "all" ? "#fff" : f.ink, background: f.tint, boxShadow: active ? "0 0 0 2px #11163A22" : "none",
                }}>{f.label} · {count}</button>
              );
            })}
          </div>
          <Card padding={0} style={{ overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 0.95fr 0.7fr 0.8fr 0.9fr 1fr 0.85fr", padding: "14px 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
              <div>Project</div><div>Owner</div><div>Method</div><div>Health</div><div>Target date</div><div>Progress</div><div style={{ textAlign: "right" }}>Budget</div>
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: "56px 22px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>
                {projects.length === 0 ? "No projects yet. Create one to populate the portfolio." : "No projects match this filter."}
              </div>
            ) : filtered.map((p) => (
              <div key={p.id} onClick={() => openProject(p.id)} style={{ display: "grid", gridTemplateColumns: "2fr 0.95fr 0.7fr 0.8fr 0.9fr 1fr 0.85fr", alignItems: "center", padding: "15px 22px", borderBottom: "1px solid #F2F4F9", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: statusDot(p.status), flex: "none" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                      {p.blockerCount > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flex: "none", color: "#D13438", background: "#FBE7E8", borderRadius: 6, padding: "1px 6px 1px 4px", fontSize: 10.5, fontWeight: 700 }}><Icon name="alert" size={12} />{p.blockerCount}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: color.faint3, fontFamily: font.mono }}>{p.id} · {p.dept}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: color.textMuted }}>{p.owner}</div>
                <div><span style={{ fontSize: 11.5, fontWeight: 600, color: color.textMuted, background: color.bg, padding: "3px 9px", borderRadius: 6 }}>{p.methodology}</span></div>
                <div><HealthPill status={p.status} label={p.health} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: color.textMuted }}>{p.target}</div>
                <div style={{ paddingRight: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ProgressBar pct={p.progress} fill={statusDot(p.status)} />
                    <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: color.textMuted, width: 34, textAlign: "right" }}>{p.progress}%</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: color.text }}>{fmtBudget(p.budget)}</div>
                  <div style={{ fontSize: 11, color: color.faint3 }}>{fmtBudget(p.spent)} spent</div>
                </div>
              </div>
            ))}
          </Card>
        </>
      ) : (
        <BlockersTab
          blockers={blockers} counts={blkCounts} projects={projects}
          submitting={raiseBlocker.isPending}
          onRaise={(payload) => raiseBlocker.mutate(payload)}
        />
      )}
    </div>
  );
}

function BlockersTab({ blockers, counts, projects, onRaise, submitting }: {
  blockers: Blocker[]; counts: { active: number; inProgress: number; resolved: number };
  projects: { id: string; name: string }[]; onRaise: (b: RaiseBlocker) => void; submitting?: boolean;
}) {
  const { can } = usePermissions();
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<BlockerStatus>("Active");

  const submit = () => {
    if (!title.trim() || !projectId) return;
    onRaise({ title: title.trim(), projectId, owner: owner.trim(), status });
    setTitle(""); setOwner("");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", gap: 9, marginBottom: 14 }}>
          {[["Active", "#D13438", counts.active], ["In progress", "#E0A100", counts.inProgress], ["Resolved", "#15A34A", counts.resolved]].map(([label, c, n]) => (
            <div key={label as string} style={{ flex: 1, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 12, padding: "13px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: c as string }} /><span style={{ fontSize: 12, color: color.faint }}>{label}</span></div>
              <div style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: color.ink, marginTop: 3 }}>{n as number}</div>
            </div>
          ))}
        </div>
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.6fr 2.4fr 1.1fr 0.9fr 0.9fr", padding: "13px 20px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
            <div>ID</div><div>Blocker</div><div>Project</div><div>Owner</div><div>Status</div>
          </div>
          {blockers.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>No blockers logged. Raise one on the right when something impedes progress.</div>
          ) : blockers.map((b) => {
            const bc = BLK_COLORS[b.status];
            return (
              <div key={b.id} style={{ display: "grid", gridTemplateColumns: "0.6fr 2.4fr 1.1fr 0.9fr 0.9fr", alignItems: "center", padding: "13px 20px", borderBottom: "1px solid #F2F4F9" }}>
                <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint3 }}>{b.id}</div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: color.text, paddingRight: 12 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: color.subtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 8 }}>{b.projectName}</div>
                <div style={{ fontSize: 12.5, color: color.textMuted }}>{b.owner}</div>
                <div><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: bc.ink, background: bc.tint, padding: "3px 10px", borderRadius: 20 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: bc.dot }} />{b.status}</span></div>
              </div>
            );
          })}
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}><span style={{ color: "#D13438", display: "flex" }}><Icon name="alert" size={18} /></span><div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>Raise a blocker</div></div>
        <div style={{ fontSize: 12, color: color.faint2, marginBottom: 16 }}>Manually log an impediment against a project.</div>
        <Field label="Project">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{projects.length ? "Select a project" : "No projects available"}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Description">
          <Textarea value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is blocking progress?" style={{ minHeight: 64 }} />
        </Field>
        <Field label="Owner">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Assignee name" />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as BlockerStatus)}>
            {(["Active", "In progress", "Resolved"] as BlockerStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        {(() => { const may = can("cap-projects", "E"); const off = submitting || !may; return (
        <button onClick={submit} disabled={off} title={may ? undefined : "Your role can't raise blockers"} style={{ width: "100%", fontSize: 13.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: 11, borderRadius: 10, cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.6 : 1, fontFamily: "inherit", marginTop: 4 }}>{submitting ? "Adding…" : "Add blocker"}</button>
        ); })()}
      </Card>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
      background: active ? "#fff" : "transparent", color: active ? color.primary : "#6A7488", boxShadow: active ? "0 1px 3px rgba(20,26,60,0.12)" : "none",
    }}>{children}</button>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
