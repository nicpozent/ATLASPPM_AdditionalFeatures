import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Input, Select, RowMenu, MenuItem } from "@/components/ui";
import { Overlay } from "./Demands";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const VIEW_TABS = [["schedule", "Schedule"], ["tasks", "Tasks"], ["resources", "Resource allocation"], ["sprints", "Sprints"]] as const;
type ViewId = (typeof VIEW_TABS)[number][0];

interface Phase { id: number; name: string; startMonth: number; endMonth: number; progress: number; }
interface Milestone { id: number; label: string; month: number; date: string; }
interface Gantt { canEdit: boolean; phases: Phase[]; milestones: Milestone[]; projectStart?: number | null; projectEnd?: number | null; startDate?: string; endDate?: string; sprints?: ProgramSprint[]; }
interface ProgramSprint { id: number; name: string; status: string; startMonth: number; endMonth: number; undated: boolean; }
interface ProgramRow { projectId: string; projectName: string; phases: Phase[]; startMonth?: number | null; endMonth?: number | null; startDate?: string; endDate?: string; sprints?: ProgramSprint[]; }
interface ProgramGantt { rows: ProgramRow[]; milestones: Milestone[]; }
interface Opt { id: string; name: string; }
interface PortfolioItem { type: string; id: string; name: string; status: string; startMonth: number; endMonth: number; progress: number | null; startLabel: string; endLabel: string; }
type PortfolioCat = "all" | "project" | "program" | "product" | "release";
interface SprintT { id: number; name: string; startDate: string; endDate: string; status: string; }
interface GTask { id: number; code: string; name: string; sprint: string; status: string; startDate: string; targetDate: string; }
const TASK_BAR: Record<string, { bg: string; border: string }> = {
  "To Do":       { bg: "#EEF1F6", border: "#8A93A6" },
  "In Progress": { bg: "#E6EFFB", border: "#0F6CBD" },
  "In Review":   { bg: "#FBF2D7", border: "#E0A100" },
  Done:          { bg: "#E7F4EC", border: "#15A34A" },
  Blocked:       { bg: "#FBE7E8", border: "#D13438" },
};
const monthOfIso = (s: string): number | null => { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d.getMonth(); };

const LABEL_W = 286;
const nowLeft = `${(new Date().getMonth() + 0.5) / 12 * 100}%`;

function useOpts(path: string, key: string) {
  return useQuery({
    queryKey: [key, "opts"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Opt[]> => { try { return (await api<Opt[]>(path)) ?? []; } catch { return []; } },
  });
}

export default function Gantt() {
  const [scope, setScope] = useState<"project" | "program" | "portfolio">("project");
  const [cat, setCat] = useState<PortfolioCat>("all");
  const [view, setView] = useState<ViewId>("schedule");
  const [projectId, setProjectId] = useState<string>("");
  const [programId, setProgramId] = useState<string>("");
  const [addMs, setAddMs] = useState(false);
  const [addPhase, setAddPhase] = useState(false);
  const [editPhase, setEditPhase] = useState<Phase | null>(null);
  const qc = useQueryClient();

  const { data: projects = [] } = useOpts("/projects", "projects");
  const { data: programs = [] } = useOpts("/programs", "programs");

  // Default the picker to the first available option once loaded.
  const activeProjectId = projectId || projects[0]?.id || "";
  const activeProgramId = programId || programs[0]?.id || "";

  const { data: gantt } = useQuery({
    queryKey: ["gantt", "project", activeProjectId], enabled: scope === "project" && !!activeProjectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<Gantt> => (await api<Gantt>(`/projects/${activeProjectId}/gantt`)) ?? { canEdit: false, phases: [], milestones: [] },
  });
  const { data: programGantt } = useQuery({
    queryKey: ["gantt", "program", activeProgramId], enabled: scope === "program" && !!activeProgramId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<ProgramGantt> => (await api<ProgramGantt>(`/programs/${activeProgramId}/gantt`)) ?? { rows: [], milestones: [] },
  });
  const { data: portfolio } = useQuery({
    queryKey: ["gantt", "portfolio"], enabled: scope === "portfolio", retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ items: PortfolioItem[] }> => (await api<{ items: PortfolioItem[] }>("/portfolio/gantt")) ?? { items: [] },
  });
  // Sprints (+ their tasks) for the selected project — a band on the schedule.
  const { data: sprintData } = useQuery({
    queryKey: ["sprints", activeProjectId], enabled: scope === "project" && !!activeProjectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ sprints: SprintT[] }> => (await api<{ sprints: SprintT[] }>(`/projects/${activeProjectId}/sprints`)) ?? { sprints: [] },
  });
  const { data: taskData } = useQuery({
    queryKey: ["tasks", activeProjectId], enabled: scope === "project" && !!activeProjectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ tasks: GTask[] }> => (await api<{ tasks: GTask[] }>(`/projects/${activeProjectId}/tasks`)) ?? { tasks: [] },
  });
  const sprintBars = useMemo<SprintBar[]>(() => {
    const allTasks = taskData?.tasks ?? [];
    const rows = sprintData?.sprints ?? [];
    const nowM = new Date().getMonth();
    const taskBars = (name: string, start: number, end: number) =>
      allTasks.filter((t) => t.sprint === name).map((t) => {
        const ta = monthOfIso(t.startDate), tb = monthOfIso(t.targetDate);
        const ts = ta ?? tb ?? start, te = tb ?? ta ?? end;
        return { id: t.id, name: `${t.code} ${t.name}`.trim(), status: t.status, startMonth: Math.min(ts, te), endMonth: Math.max(ts, te) };
      });

    // Prefer the server-computed sprint bars from the gantt endpoint — the same
    // authoritative source (the Sprint table + window fallback) the program
    // timeline uses, so any synced sprint (Jira board/board-less, ADO iteration)
    // or manual sprint shows in the Schedule. Attach each sprint's tasks by name.
    const serverBars = gantt?.sprints ?? [];
    if (serverBars.length > 0) {
      return serverBars.map((s) => ({
        id: s.id, name: s.name, status: s.status, startMonth: s.startMonth, endMonth: s.endMonth,
        tasks: taskBars(s.name, s.startMonth, s.endMonth), undated: s.undated,
      }));
    }

    if (rows.length > 0) {
      return rows.map((s) => {
        let a = monthOfIso(s.startDate), b = monthOfIso(s.endDate);
        // Jira often omits dates on future/closed sprints — keep them in the band
        // (falling back to the project window, else the current month) instead of
        // dropping them, so past & current sprints always show as phases.
        const undated = a === null && b === null;
        if (undated) { a = gantt?.projectStart ?? nowM; b = gantt?.projectEnd ?? nowM; }
        const start = Math.min(a ?? b!, b ?? a!), end = Math.max(a ?? b!, b ?? a!);
        return { id: s.id, name: s.name, status: s.status, startMonth: start, endMonth: end, tasks: taskBars(s.name, start, end), undated };
      });
    }

    // No Sprint rows for this project (common for board-less Jira mappings or
    // manual projects) — synthesise sprint bands from any sprint names the tasks
    // carry, so sprints still show under the Schedule. Window comes from the
    // tasks' own dates, else the project window / current month.
    const names = Array.from(new Set(allTasks.map((t) => t.sprint).filter((n): n is string => !!n && n.trim().length > 0)));
    return names.map((name, i) => {
      const months = allTasks.filter((t) => t.sprint === name).flatMap((t) => [monthOfIso(t.startDate), monthOfIso(t.targetDate)]).filter((m): m is number => m !== null);
      const undated = months.length === 0;
      const start = undated ? (gantt?.projectStart ?? nowM) : Math.min(...months);
      const end = undated ? (gantt?.projectEnd ?? nowM) : Math.max(...months);
      return { id: -1 - i, name, status: "Planned", startMonth: start, endMonth: end, tasks: taskBars(name, start, end), undated };
    });
  }, [sprintData, taskData, gantt]);

  const canEdit = scope === "project" && (gantt?.canEdit ?? false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["gantt"] });

  const addMilestone = useMutation({
    mutationFn: (b: { label: string; month: number }) => api(`/projects/${activeProjectId}/milestones`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => { invalidate(); setAddMs(false); },
  });
  const removeMilestone = useMutation({
    mutationFn: (id: number) => api(`/milestones/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const createPhase = useMutation({
    mutationFn: (b: Partial<Phase>) => api(`/projects/${activeProjectId}/phases`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => { invalidate(); setAddPhase(false); },
  });
  const patchPhase = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Phase> }) => api(`/phases/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { invalidate(); setEditPhase(null); },
  });
  const removePhase = useMutation({
    mutationFn: (id: number) => api(`/phases/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  // Window fallback: if the project has no parseable start/end dates but has
  // dated tasks, derive the window from the task date range so the Schedule
  // isn't blank for imported projects that carry tasks but no phases/dates.
  const taskMonths = (taskData?.tasks ?? []).flatMap((t) => [monthOfIso(t.startDate), monthOfIso(t.targetDate)]).filter((m): m is number => m !== null);
  const effProjectStart = gantt?.projectStart ?? (taskMonths.length ? Math.min(...taskMonths) : null);
  const effProjectEnd = gantt?.projectEnd ?? (taskMonths.length ? Math.max(...taskMonths) : null);

  const milestones = (scope === "program" ? programGantt?.milestones : gantt?.milestones) ?? [];
  const opts = scope === "program" ? programs : projects;
  const activeId = scope === "program" ? activeProgramId : activeProjectId;
  const setActive = scope === "program" ? setProgramId : setProjectId;

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      {/* scope toggle */}
      <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2, marginBottom: 14 }}>
        {([["project", "Project timeline"], ["program", "Program timeline"], ["portfolio", "Portfolio timeline"]] as const).map(([s, label]) => (
          <button key={s} onClick={() => setScope(s)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: scope === s ? "#fff" : "transparent", color: scope === s ? color.primary : "#565F73", boxShadow: scope === s ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>{label}</button>
        ))}
      </div>

      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 22px", borderBottom: `1px solid ${color.bg}`, flexWrap: "wrap" }}>
          {scope === "portfolio"
            ? <span style={{ width: 42, height: 42, borderRadius: 11, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="layers" size={20} /></span>
            : scope === "program"
            ? <span style={{ width: 42, height: 42, borderRadius: 11, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="folders" size={20} /></span>
            : <span style={{ width: 11, height: 11, borderRadius: "50%", background: color.faint3 }} />}
          <div>
            <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>{scope === "portfolio" ? "Portfolio timeline" : scope === "program" ? "Program timeline" : "Project timeline"}</div>
            <div style={{ fontSize: 12, color: color.faint2 }}>{scope === "portfolio" ? "Projects, programs, products & releases on one roadmap — filter by category" : scope === "program" ? "Project timelines aggregated across the program" : "Phases, milestones & dependencies for the selected project"}</div>
          </div>
          <div style={{ flex: 1 }} />
          {scope === "portfolio" ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {([["all", "All"], ["project", "Projects"], ["program", "Programs"], ["product", "Products"], ["release", "Releases"]] as const).map(([c, label]) => (
                <button key={c} onClick={() => setCat(c)} style={{ fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", padding: "5px 11px", borderRadius: 8, border: `1px solid ${cat === c ? color.primary : color.border}`, background: cat === c ? color.primary : "#fff", color: cat === c ? "#fff" : color.textMuted }}>{label}</button>
              ))}
            </div>
          ) : (
            <select value={activeId} onChange={(e) => setActive(e.target.value)} aria-label={scope === "program" ? "Select program" : "Select project"} style={selectStyle}>
              {opts.length === 0
                ? <option value="">{scope === "program" ? "No programs yet" : "No projects yet"}</option>
                : opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: color.subtle, flexWrap: "wrap" }}>
            <Legend swatch={<span style={{ width: 14, height: 10, borderRadius: 3, background: "#0F6CBD" }} />}>Complete</Legend>
            <Legend swatch={<span style={{ width: 14, height: 10, borderRadius: 3, background: "#DCEAF8", border: "1px solid #0F6CBD" }} />}>Planned</Legend>
            <Legend swatch={<span style={{ width: 10, height: 10, background: "#E0A100", transform: "rotate(45deg)" }} />}>Milestone</Legend>
            <Legend swatch={<span style={{ width: 2, height: 13, background: "#D13438" }} />}>Today</Legend>
          </div>
        </div>

        {/* view tabs (project/program only) */}
        {scope !== "portfolio" && (
          <div style={{ display: "flex", gap: 0, padding: "0 22px", borderBottom: `1px solid ${color.bg}`, background: "#FBFCFE" }}>
            {VIEW_TABS.map(([vid, label]) => {
              const active = view === vid;
              return <button key={vid} onClick={() => setView(vid)} style={{ padding: "11px 16px", marginRight: 6, border: "none", borderBottom: active ? "2.5px solid #0F6CBD" : "2.5px solid transparent", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", color: active ? color.primary : "#565F73" }}>{label}</button>;
            })}
          </div>
        )}

        {scope === "portfolio" ? (
          <PortfolioSchedule items={(portfolio?.items ?? []).filter((i) => cat === "all" || i.type === cat)} cat={cat} />
        ) : view === "schedule" ? (
          scope === "program"
            ? <ProgramSchedule rows={programGantt?.rows ?? []} milestones={milestones} />
            : <ProjectSchedule
                phases={gantt?.phases ?? []} milestones={milestones} canEdit={canEdit} hasProject={!!activeProjectId}
                projectStart={effProjectStart} projectEnd={effProjectEnd}
                startDate={gantt?.startDate ?? ""} endDate={gantt?.endDate ?? ""} sprints={sprintBars}
                onAddPhase={() => setAddPhase(true)} onEditPhase={setEditPhase} onRemovePhase={(id) => removePhase.mutate(id)}
                onAddMilestone={() => setAddMs(true)} onRemoveMilestone={(id) => removeMilestone.mutate(id)}
              />
        ) : view === "tasks" ? (
          scope === "program"
            ? <Note text="Switch to a project to view its task timeline." />
            : <TaskTimeline tasks={taskData?.tasks ?? []} hasProject={!!activeProjectId} />
        ) : view === "resources" ? (
          scope === "program"
            ? <Note text="Switch to a project to view resource allocation." />
            : <ResourceView projectId={activeProjectId} />
        ) : (
          scope === "program"
            ? <Note text="Switch to a project to view sprints." />
            : <SprintView projectId={activeProjectId} />
        )}
      </div>

      {addMs && <AddMilestoneModal onClose={() => setAddMs(false)} onAdd={(b) => addMilestone.mutate(b)} pending={addMilestone.isPending} />}
      {addPhase && <PhaseModal title="Add phase" onClose={() => setAddPhase(false)} pending={createPhase.isPending}
        onSave={(b) => createPhase.mutate(b)} />}
      {editPhase && <PhaseModal title="Edit phase" phase={editPhase} onClose={() => setEditPhase(null)} pending={patchPhase.isPending}
        onSave={(b) => patchPhase.mutate({ id: editPhase.id, body: b })} />}
    </div>
  );
}

// ---- Bar geometry ----------------------------------------------------------
function barStyle(startMonth: number, endMonth: number): React.CSSProperties {
  const left = startMonth / 12 * 100;
  const width = Math.max(1, (endMonth - startMonth + 1)) / 12 * 100;
  return { position: "absolute", left: `${left}%`, width: `${width}%`, top: 9, height: 20 };
}

function PhaseBar({ phase, editable, onEdit }: { phase: Phase; editable?: boolean; onEdit?: () => void }) {
  return (
    <div style={{ position: "relative", height: 38, borderBottom: "1px solid #F4F6FA" }}>
      <div title={`${phase.name} · ${MONTHS[phase.startMonth]}–${MONTHS[phase.endMonth]} · ${phase.progress}%`}
        onClick={editable ? onEdit : undefined}
        style={{ ...barStyle(phase.startMonth, phase.endMonth), borderRadius: 6, background: "#DCEAF8", border: "1px solid #0F6CBD", overflow: "hidden", cursor: editable ? "pointer" : "default" }}>
        <div style={{ height: "100%", width: `${phase.progress}%`, background: "#0F6CBD" }} />
      </div>
    </div>
  );
}

function MonthHeader() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", height: 38, borderBottom: `1px solid ${color.bg}` }}>
      {MONTHS.map((m) => <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, color: color.faint, fontWeight: 600, borderRight: "1px solid #F4F6FA" }}>{m}</div>)}
    </div>
  );
}

function NowLine() {
  return (
    <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "#D13438", left: nowLeft, zIndex: 5 }}>
      <span style={{ position: "absolute", top: -1, left: -18, fontSize: 9, fontWeight: 700, color: "#fff", background: "#D13438", padding: "1px 5px", borderRadius: 4 }}>NOW</span>
    </div>
  );
}

// ---- Project schedule ------------------------------------------------------
interface SprintTaskBar { id: number; name: string; status: string; startMonth: number; endMonth: number; }
interface SprintBar { id: number; name: string; status: string; startMonth: number; endMonth: number; tasks: SprintTaskBar[]; undated?: boolean; }
const SPRINT_BAR: Record<string, { bg: string; border: string }> = {
  Started:   { bg: "#D7EFE0", border: "#15A34A" },
  Completed: { bg: "#E6EFFB", border: "#0F6CBD" },
  Halted:    { bg: "#FBF2D7", border: "#E0A100" },
  Cancelled: { bg: "#FBE7E8", border: "#D13438" },
  Planned:   { bg: "#EEF1F6", border: "#8A93A6" },
  // legacy
  Active:    { bg: "#D7EFE0", border: "#15A34A" },
  Closed:    { bg: "#E6EFFB", border: "#0F6CBD" },
};
function ProjectSchedule({ phases, milestones, canEdit, hasProject, projectStart, projectEnd, startDate, endDate, sprints = [], onAddPhase, onEditPhase, onRemovePhase, onAddMilestone, onRemoveMilestone }: {
  phases: Phase[]; milestones: Milestone[]; canEdit: boolean; hasProject: boolean;
  projectStart: number | null; projectEnd: number | null; startDate: string; endDate: string; sprints?: SprintBar[];
  onAddPhase: () => void; onEditPhase: (p: Phase) => void; onRemovePhase: (id: number) => void;
  onAddMilestone: () => void; onRemoveMilestone: (id: number) => void;
}) {
  // Collapse the phase grid when there are no phases but sprints exist, so the
  // sprint band sits directly under the window and the columns stay aligned.
  const rowsHeight = phases.length ? Math.max(200, phases.length * 38) : (sprints.length ? 0 : 200);
  const hasWindow = projectStart != null && projectEnd != null;
  const [openSprints, setOpenSprints] = useState<Set<number>>(new Set());
  const toggleSprint = (id: number) => setOpenSprints((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const winStart = Math.min(projectStart ?? 0, projectEnd ?? 0);
  const winEnd = Math.max(projectStart ?? 0, projectEnd ?? 0);
  return (
    <div style={{ display: "flex" }}>
      {/* left labels */}
      <div style={{ width: LABEL_W, flex: "none", borderRight: `1px solid ${color.bg}` }}>
        <div style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          Phase / Workstream
          {canEdit && <button onClick={onAddPhase} style={addBtn}>+ Add</button>}
        </div>
        {hasWindow && (
          <div style={{ height: 34, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 22px", borderBottom: "1px solid #F4F6FA", background: "#FBFCFE" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: color.navy }}>Project window</span>
            <span style={{ fontSize: 10.5, color: color.faint3 }}>{startDate || "—"} → {endDate || "—"}</span>
          </div>
        )}
        {phases.length === 0 ? (
          (sprints.length === 0 || !hasProject) && (
            <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 22px", fontSize: 12.5, color: color.faint3, textAlign: "center" }}>
              {hasProject ? "No phases or sprints scheduled yet — add a phase, or sync sprints from Jira." : "Select a project."}
            </div>
          )
        ) : phases.map((p) => (
          <div key={p.id} style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 14px 0 22px", borderBottom: "1px solid #F4F6FA" }}>
            <span style={{ flex: 1, fontSize: 12.5, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
            <span style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 700, color: color.faint3, flex: "none" }}>{p.progress}%</span>
            {canEdit && (
              <RowMenu ariaLabel="Phase actions" width={150}>
                {(close) => (<>
                  <MenuItem label="Edit phase" icon={<Icon name="edit" size={15} />} onClick={() => { onEditPhase(p); close(); }} />
                  <MenuItem label="Remove" icon={<Icon name="trash" size={15} />} danger onClick={() => { onRemovePhase(p.id); close(); }} />
                </>)}
              </RowMenu>
            )}
          </div>
        ))}
        {sprints.length > 0 && (
          <>
            <div style={{ height: 30, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 11, fontWeight: 700, color: color.faint, letterSpacing: "0.04em", textTransform: "uppercase", borderTop: `1px solid ${color.bg}`, background: "#FBFCFE" }}>Sprints</div>
            {sprints.map((s) => {
              const open = openSprints.has(s.id);
              return (
                <div key={s.id}>
                  <div onClick={() => toggleSprint(s.id)} title="Show tasks" style={{ height: 34, display: "flex", alignItems: "center", gap: 7, padding: "0 14px 0 18px", borderBottom: "1px solid #F4F6FA", cursor: "pointer" }}>
                    <Icon name={open ? "chevronDown" : "chevronRight"} size={14} color={color.faint} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: (SPRINT_BAR[s.status] ?? SPRINT_BAR.Planned).border }}>{s.status}</span>
                  </div>
                  {open && (s.tasks.length === 0
                    ? <div style={{ height: 28, display: "flex", alignItems: "center", padding: "0 14px 0 42px", fontSize: 11, color: color.faint3, borderBottom: "1px solid #F4F6FA" }}>No tasks in this sprint</div>
                    : s.tasks.map((t) => (
                      <div key={t.id} style={{ height: 28, display: "flex", alignItems: "center", padding: "0 14px 0 42px", borderBottom: "1px solid #F7F9FC" }}>
                        <span style={{ flex: 1, fontSize: 11, color: color.subtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                      </div>
                    )))}
                </div>
              );
            })}
          </>
        )}
        <div style={{ height: 72, display: "flex", alignItems: "center", gap: 8, padding: "0 22px", fontSize: 11, fontWeight: 700, color: color.faint, letterSpacing: "0.04em", textTransform: "uppercase", borderTop: `1px solid ${color.bg}`, background: "#FBFCFE" }}>
          Milestones
          {canEdit && <button onClick={onAddMilestone} style={addBtn}>+ Add</button>}
        </div>
      </div>
      {/* right grid */}
      <div style={{ flex: 1, minWidth: 560, overflow: "hidden" }}>
        <MonthHeader />
        {hasWindow && (
          <div style={{ position: "relative", height: 34, borderBottom: "1px solid #F4F6FA", background: "#FBFCFE", backgroundImage: "linear-gradient(90deg,#F2F4F9 1px,transparent 1px)", backgroundSize: "8.3333% 100%" }}>
            <div title={`Project ${startDate || "?"} → ${endDate || "?"}`} style={{ ...barStyle(winStart, winEnd), top: 8, height: 18, borderRadius: 6, background: "repeating-linear-gradient(45deg,#E6EFFB,#E6EFFB 6px,#D7E6F8 6px,#D7E6F8 12px)", border: "1.5px solid #0F6CBD" }} />
          </div>
        )}
        <div style={{ position: "relative", minHeight: rowsHeight, height: rowsHeight, backgroundImage: "linear-gradient(90deg,#F2F4F9 1px,transparent 1px)", backgroundSize: "8.3333% 100%" }}>
          <NowLine />
          <div>
            {phases.map((p) => <PhaseBar key={p.id} phase={p} editable={canEdit} onEdit={() => onEditPhase(p)} />)}
          </div>
        </div>
        {sprints.length > 0 && (
          <div>
            <div style={{ height: 30, borderTop: `1px solid ${color.bg}`, background: "#FBFCFE" }} />
            {sprints.map((s) => {
              const c = SPRINT_BAR[s.status] ?? SPRINT_BAR.Planned;
              const open = openSprints.has(s.id);
              return (
                <div key={s.id}>
                  <div style={{ position: "relative", height: 34, backgroundImage: "linear-gradient(90deg,#F2F4F9 1px,transparent 1px)", backgroundSize: "8.3333% 100%" }}>
                    <div title={`${s.name} · ${s.undated ? "dates TBD in Jira" : `${MONTHS[s.startMonth]}–${MONTHS[s.endMonth]}`} · ${s.status}`}
                      style={{ ...barStyle(s.startMonth, s.endMonth), top: 7, height: 20, borderRadius: 6, background: c.bg, border: `1px ${s.undated ? "dashed" : "solid"} ${c.border}`, display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 10.5, fontWeight: 600, color: color.text, overflow: "hidden", whiteSpace: "nowrap" }}>{s.name}</div>
                  </div>
                  {open && (s.tasks.length === 0
                    ? <div style={{ height: 28, backgroundImage: "linear-gradient(90deg,#F2F4F9 1px,transparent 1px)", backgroundSize: "8.3333% 100%" }} />
                    : s.tasks.map((t) => {
                      const tc = TASK_BAR[t.status] ?? TASK_BAR["To Do"];
                      return (
                        <div key={t.id} style={{ position: "relative", height: 28, backgroundImage: "linear-gradient(90deg,#F2F4F9 1px,transparent 1px)", backgroundSize: "8.3333% 100%" }}>
                          <div title={`${t.name} · ${t.status}`} style={{ ...barStyle(t.startMonth, t.endMonth), top: 6, height: 15, borderRadius: 5, background: tc.bg, border: `1px solid ${tc.border}` }} />
                        </div>
                      );
                    }))}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ height: 72, position: "relative", borderTop: `1px solid ${color.bg}`, background: "#FBFCFE" }}>
          {milestones.map((ms) => (
            <div key={ms.id} style={{ position: "absolute", top: 0, left: `${(ms.month + 0.5) / 12 * 100}%`, transform: "translateX(-50%)", width: 90, textAlign: "center" }}>
              <span style={{ display: "block", width: 16, height: 16, background: "#E0A100", transform: "rotate(45deg)", margin: "10px auto 0", border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,0.22)", cursor: canEdit ? "pointer" : "default" }}
                title={canEdit ? "Remove milestone" : ms.label} onClick={canEdit ? () => onRemoveMilestone(ms.id) : undefined} />
              <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: color.text, whiteSpace: "nowrap", textAlign: "center", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis" }}>{ms.label}</span>
              <span style={{ display: "block", fontSize: 9, color: color.faint3, textAlign: "center" }}>{ms.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Portfolio schedule (all entity types on one grid) --------------------
const PF_TYPE: Record<string, { ink: string; tint: string; bar: string; label: string }> = {
  project: { ink: "#7A3FB0", tint: "#F0E8F7", bar: "#7A3FB0", label: "Project" },
  program: { ink: "#0C5798", tint: "#E6EFFB", bar: "#0F6CBD", label: "Program" },
  product: { ink: "#0B6B37", tint: "#E7F4EC", bar: "#15A34A", label: "Product" },
  release: { ink: "#8A6300", tint: "#FBF2D7", bar: "#E0A100", label: "Release" },
};
function PortfolioSchedule({ items, cat }: { items: PortfolioItem[]; cat: PortfolioCat }) {
  if (items.length === 0) return <Note text={cat === "all" ? "Nothing with dates in the portfolio yet. Set start/end dates on projects, programs, products or releases to see them here." : "No dated items in this category."} />;
  const rowsHeight = Math.max(120, items.length * 38);
  return (
    <div style={{ display: "flex" }}>
      <div style={{ width: LABEL_W, flex: "none", borderRight: `1px solid ${color.bg}` }}>
        <div style={{ height: 38, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>Item</div>
        {items.map((i) => {
          const t = PF_TYPE[i.type] ?? PF_TYPE.project;
          return (
            <div key={`${i.type}-${i.id}`} style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 14px 0 22px", borderBottom: "1px solid #F4F6FA" }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: t.ink, background: t.tint, padding: "2px 7px", borderRadius: 20, flex: "none" }}>{t.label}</span>
              <span style={{ flex: 1, fontSize: 12.5, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</span>
              {i.progress !== null && <span style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 700, color: color.faint3, flex: "none" }}>{i.progress}%</span>}
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, minWidth: 560, overflow: "hidden" }}>
        <MonthHeader />
        <div style={{ position: "relative", height: rowsHeight, backgroundImage: "linear-gradient(90deg,#F2F4F9 1px,transparent 1px)", backgroundSize: "8.3333% 100%" }}>
          <NowLine />
          {items.map((i) => {
            const t = PF_TYPE[i.type] ?? PF_TYPE.project;
            return (
              <div key={`${i.type}-${i.id}`} style={{ position: "relative", height: 38, borderBottom: "1px solid #F4F6FA" }}>
                <div title={`${i.name} · ${i.startLabel || "?"} → ${i.endLabel || "?"}${i.progress !== null ? ` · ${i.progress}%` : ""}`}
                  style={{ ...barStyle(i.startMonth, i.endMonth), borderRadius: 6, background: t.tint, border: `1px solid ${t.bar}`, overflow: "hidden" }}>
                  {i.progress !== null && <div style={{ height: "100%", width: `${i.progress}%`, background: t.bar }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Program schedule (aggregate) ------------------------------------------
function ProgramSchedule({ rows, milestones }: { rows: ProgramRow[]; milestones: Milestone[] }) {
  if (rows.length === 0) return <Note text="No projects in this program, or no program selected." />;
  return (
    <div style={{ display: "flex" }}>
      {/* left labels */}
      <div style={{ width: LABEL_W, flex: "none", borderRight: `1px solid ${color.bg}` }}>
        <div style={{ height: 38, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>Project / Phase / Sprint</div>
        {rows.map((r) => {
          const hasWindow = r.startMonth != null && r.endMonth != null;
          const empty = !hasWindow && r.phases.length === 0 && (r.sprints?.length ?? 0) === 0;
          return (
            <div key={r.projectId}>
              <div style={{ height: 30, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 12, fontWeight: 700, color: color.navy, background: "#F6F8FC", borderBottom: "1px solid #EEF1F6" }}>{r.projectName}</div>
              {hasWindow && (
                <div style={{ height: 30, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 22px", borderBottom: "1px solid #F4F6FA", background: "#FBFCFE" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: color.navy }}>Project window</span>
                  <span style={{ fontSize: 10, color: color.faint3 }}>{r.startDate || "—"} → {r.endDate || "—"}</span>
                </div>
              )}
              {r.phases.map((p) => (
                <div key={p.id} style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 22px", borderBottom: "1px solid #F4F6FA" }}>
                  <span style={{ flex: 1, fontSize: 12, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                  <span style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 700, color: color.faint3 }}>{p.progress}%</span>
                </div>
              ))}
              {(r.sprints ?? []).map((s) => (
                <div key={s.id} style={{ height: 34, display: "flex", alignItems: "center", gap: 7, padding: "0 22px", borderBottom: "1px solid #F4F6FA" }}>
                  <Icon name="zap" size={13} color={color.faint} />
                  <span style={{ flex: 1, fontSize: 11.5, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: (SPRINT_BAR[s.status] ?? SPRINT_BAR.Planned).border }}>{s.status}</span>
                </div>
              ))}
              {empty && <div style={{ height: 38, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 11.5, color: color.faint3, borderBottom: "1px solid #F4F6FA" }}>No schedule yet</div>}
            </div>
          );
        })}
      </div>
      {/* right grid */}
      <div style={{ flex: 1, minWidth: 560, overflow: "hidden" }}>
        <MonthHeader />
        <div style={{ position: "relative", backgroundImage: "linear-gradient(90deg,#F2F4F9 1px,transparent 1px)", backgroundSize: "8.3333% 100%" }}>
          <NowLine />
          {rows.map((r) => {
            const hasWindow = r.startMonth != null && r.endMonth != null;
            const empty = !hasWindow && r.phases.length === 0 && (r.sprints?.length ?? 0) === 0;
            return (
              <div key={r.projectId}>
                <div style={{ height: 30, borderBottom: "1px solid #EEF1F6", background: "#F6F8FC" }} />
                {hasWindow && (
                  <div style={{ position: "relative", height: 30, borderBottom: "1px solid #F4F6FA", background: "#FBFCFE" }}>
                    <div title={`${r.startDate || "?"} → ${r.endDate || "?"}`} style={{ ...barStyle(Math.min(r.startMonth!, r.endMonth!), Math.max(r.startMonth!, r.endMonth!)), top: 6, height: 18, borderRadius: 6, background: "repeating-linear-gradient(45deg,#E6EFFB,#E6EFFB 6px,#D7E6F8 6px,#D7E6F8 12px)", border: "1.5px solid #0F6CBD" }} />
                  </div>
                )}
                {r.phases.map((p) => <PhaseBar key={p.id} phase={p} />)}
                {(r.sprints ?? []).map((s) => {
                  const c = SPRINT_BAR[s.status] ?? SPRINT_BAR.Planned;
                  return (
                    <div key={s.id} style={{ position: "relative", height: 34, backgroundImage: "linear-gradient(90deg,#F2F4F9 1px,transparent 1px)", backgroundSize: "8.3333% 100%" }}>
                      <div title={`${s.name} · ${s.undated ? "dates TBD in Jira" : `${MONTHS[s.startMonth]}–${MONTHS[s.endMonth]}`} · ${s.status}`}
                        style={{ ...barStyle(s.startMonth, s.endMonth), top: 7, height: 20, borderRadius: 6, background: c.bg, border: `1px ${s.undated ? "dashed" : "solid"} ${c.border}`, display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 10.5, fontWeight: 600, color: color.text, overflow: "hidden", whiteSpace: "nowrap" }}>{s.name}</div>
                    </div>
                  );
                })}
                {empty && <div style={{ height: 38, borderBottom: "1px solid #F4F6FA" }} />}
              </div>
            );
          })}
        </div>
        <div style={{ height: 72, position: "relative", borderTop: `1px solid ${color.bg}`, background: "#FBFCFE" }}>
          {milestones.map((ms) => (
            <div key={ms.id} style={{ position: "absolute", top: 0, left: `${(ms.month + 0.5) / 12 * 100}%`, transform: "translateX(-50%)", width: 90, textAlign: "center" }}>
              <span style={{ display: "block", width: 14, height: 14, background: "#E0A100", transform: "rotate(45deg)", margin: "12px auto 0", border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,0.22)" }} />
              <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: color.text, whiteSpace: "nowrap", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis" }}>{ms.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Resource allocation view (reuses /capacity) ---------------------------
interface CapPerson { name: string; role: string; initials: string; color: string; opsPct: number; projectPct: number; productPct: number; util: number; over: boolean; highOps: boolean; }
interface Capacity { assigned: number; overCount: number; highOps: number; people: CapPerson[]; unknown: string[]; }

function ResourceView({ projectId }: { projectId: string }) {
  const { data } = useQuery({
    queryKey: ["capacity", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<Capacity | null> => (await api<Capacity>(`/projects/${projectId}/capacity`)) ?? null,
  });
  const people = data?.people ?? [];
  if (!projectId) return <Note text="Select a project." />;
  if (people.length === 0) return <Note text="No resource allocation data yet — assign people in the project's People & roles." />;
  const seg = (pct: number, c: string) => pct > 0 ? <div style={{ width: `${Math.min(100, pct)}%`, background: c, height: "100%" }} /> : null;
  return (
    <div style={{ padding: "16px 22px" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 12, color: color.subtle }}>
        <Legend swatch={<span style={{ width: 12, height: 10, borderRadius: 2, background: "#8A93A6" }} />}>Operations</Legend>
        <Legend swatch={<span style={{ width: 12, height: 10, borderRadius: 2, background: "#0F6CBD" }} />}>Project</Legend>
        <Legend swatch={<span style={{ width: 12, height: 10, borderRadius: 2, background: "#7A3FB0" }} />}>Product</Legend>
      </div>
      {people.map((p) => (
        <div key={p.name} style={{ display: "grid", gridTemplateColumns: "200px 1fr 54px", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid #F4F6FA" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: p.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, flex: "none" }}>{p.initials}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ fontSize: 10.5, color: color.faint3 }}>{p.role}</div>
            </div>
          </div>
          <div style={{ height: 14, background: "#EEF1F6", borderRadius: 7, overflow: "hidden", display: "flex", position: "relative" }}>
            {seg(p.opsPct, "#8A93A6")}{seg(p.projectPct, "#0F6CBD")}{seg(p.productPct, "#7A3FB0")}
            {p.util > 100 && <span style={{ position: "absolute", right: 4, top: -1, fontSize: 9, fontWeight: 700, color: "#A1282B" }}>over</span>}
          </div>
          <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 700, color: p.over ? "#A1282B" : color.textMuted, textAlign: "right" }}>{p.util}%</span>
        </div>
      ))}
      {data?.unknown && data.unknown.length > 0 && (
        <div style={{ fontSize: 11.5, color: color.faint3, marginTop: 10 }}>{data.unknown.join(", ")} — not on the Resources sheet (capacity unknown).</div>
      )}
    </div>
  );
}

// ---- Sprints view (groups project tasks by sprint) -------------------------
interface Task { id: number; code: string; name: string; assignee: string; status: string; sprint: string; }
const EMPTY_TASKS: Task[] = [];
const TASK_STATUS: Record<string, { ink: string; tint: string }> = {
  "Done": { ink: "#0B6B37", tint: "#E7F4EC" }, "In Progress": { ink: "#0C5798", tint: "#E6EFFB" },
  "In Review": { ink: "#8A6300", tint: "#FBF2D7" }, "To Do": { ink: "#566077", tint: "#EEF1F6" },
  "Blocked": { ink: "#A1282B", tint: "#FBE7E8" },
};

function SprintView({ projectId }: { projectId: string }) {
  const { data } = useQuery({
    queryKey: ["tasks", projectId], enabled: !!projectId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; tasks: Task[] }> =>
      (await api<{ canEdit: boolean; tasks: Task[] }>(`/projects/${projectId}/tasks`)) ?? { canEdit: false, tasks: [] },
  });
  const tasks = data?.tasks ?? EMPTY_TASKS;
  const groups = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) { const k = t.sprint?.trim() || "Backlog"; if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
    return Array.from(m.entries());
  }, [tasks]);

  if (!projectId) return <Note text="Select a project." />;
  if (tasks.length === 0) return <Note text="No sprints defined yet — tasks assigned to a sprint will group here." />;
  return (
    <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map(([sprint, items]) => {
        const done = items.filter((t) => t.status === "Done").length;
        return (
          <div key={sprint} style={{ border: `1px solid ${color.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "#F6F8FC", borderBottom: `1px solid ${color.bg}` }}>
              <span style={{ fontFamily: font.head, fontSize: 14, fontWeight: 600, color: color.navy }}>{sprint}</span>
              <span style={{ fontSize: 11.5, color: color.faint2 }}>{items.length} task{items.length === 1 ? "" : "s"} · {done} done</span>
              <div style={{ flex: 1 }} />
              <div style={{ width: 120, height: 6, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${items.length ? Math.round(done / items.length * 100) : 0}%`, background: "#15A34A" }} />
              </div>
            </div>
            {items.map((t) => {
              const sc = TASK_STATUS[t.status] ?? TASK_STATUS["To Do"];
              return (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 140px 110px", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: "1px solid #F4F6FA" }}>
                  <span style={{ fontFamily: font.mono, fontSize: 11, color: color.faint3 }}>{t.code}</span>
                  <span style={{ fontSize: 12.5, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                  <span style={{ fontSize: 11.5, color: color.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.assignee}</span>
                  <span style={{ justifySelf: "start", fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 9px", borderRadius: 6 }}>{t.status}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ---- Task timeline (project tasks placed by their own dates) ---------------
function TaskTimeline({ tasks, hasProject }: { tasks: GTask[]; hasProject: boolean }) {
  const nowM = new Date().getMonth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const statuses = useMemo(() => Array.from(new Set(tasks.map((t) => t.status).filter(Boolean))), [tasks]);
  const rows = useMemo(() => tasks
    .filter((t) => statusFilter === "all" || t.status === statusFilter)
    .map((t) => {
      const a = monthOfIso(t.startDate), b = monthOfIso(t.targetDate);
      const scheduled = a !== null || b !== null;
      const s = a ?? b ?? nowM, e = b ?? a ?? nowM;
      return { ...t, startMonth: Math.min(s, e), endMonth: Math.max(s, e), scheduled };
    })
    .sort((x, y) => x.startMonth - y.startMonth || x.code.localeCompare(y.code)),
  [tasks, statusFilter, nowM]);

  if (!hasProject) return <Note text="Select a project." />;
  if (tasks.length === 0) return <Note text="No tasks for this project yet. Tasks (created here or synced from Jira) will appear on this timeline." />;

  const rowsHeight = Math.max(120, rows.length * 34);
  return (
    <div>
      {/* status filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", padding: "12px 22px", borderBottom: `1px solid ${color.bg}`, background: "#FBFCFE" }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#56607A", marginRight: 2 }}>Status</span>
        {(["all", ...statuses]).map((s) => {
          const active = statusFilter === s;
          const c = s === "all" ? { bg: color.primary, border: color.primary } : (TASK_BAR[s] ?? TASK_BAR["To Do"]);
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", padding: "4px 11px", borderRadius: 20,
              border: `1px solid ${active ? c.border : color.border}`, background: active ? (s === "all" ? color.primary : c.bg) : "#fff",
              color: active && s === "all" ? "#fff" : active ? c.border : color.textMuted,
            }}>{s === "all" ? "All" : s} · {s === "all" ? tasks.length : tasks.filter((t) => t.status === s).length}</button>
          );
        })}
      </div>
      <div style={{ display: "flex" }}>
        {/* left labels */}
        <div style={{ width: LABEL_W, flex: "none", borderRight: `1px solid ${color.bg}` }}>
          <div style={{ height: 38, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>Task</div>
          {rows.map((t) => (
            <div key={t.id} style={{ height: 34, display: "flex", alignItems: "center", gap: 8, padding: "0 14px 0 22px", borderBottom: "1px solid #F4F6FA" }}>
              <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3, flex: "none" }}>{t.code}</span>
              <span style={{ flex: 1, fontSize: 12, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
              {t.sprint && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#0C5798", background: "#E6EFFB", padding: "1px 6px", borderRadius: 5, flex: "none" }}>{t.sprint}</span>}
            </div>
          ))}
        </div>
        {/* right grid */}
        <div style={{ flex: 1, minWidth: 560, overflow: "hidden" }}>
          <MonthHeader />
          <div style={{ position: "relative", height: rowsHeight, backgroundImage: "linear-gradient(90deg,#F2F4F9 1px,transparent 1px)", backgroundSize: "8.3333% 100%" }}>
            <NowLine />
            {rows.map((t) => {
              const tc = TASK_BAR[t.status] ?? TASK_BAR["To Do"];
              return (
                <div key={t.id} style={{ position: "relative", height: 34, borderBottom: "1px solid #F4F6FA" }}>
                  <div title={`${t.code} ${t.name} · ${t.status}${t.scheduled ? "" : " · unscheduled"}`}
                    style={{ ...barStyle(t.startMonth, t.endMonth), top: 8, height: 18, borderRadius: 5, background: tc.bg, border: `1px solid ${tc.border}`, opacity: t.scheduled ? 1 : 0.5, display: "flex", alignItems: "center", paddingLeft: 7, fontSize: 10, fontWeight: 600, color: color.text, overflow: "hidden", whiteSpace: "nowrap" }}>
                    {t.status}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, fontSize: 13, color: color.faint3, textAlign: "center" }}>{text}</div>;
}

// ---- Modals ----------------------------------------------------------------
function AddMilestoneModal({ onClose, onAdd, pending }: { onClose: () => void; onAdd: (m: { label: string; month: number }) => void; pending?: boolean }) {
  const [label, setLabel] = useState("");
  const [month, setMonth] = useState(new Date().getMonth());
  const submit = () => { if (label.trim()) onAdd({ label: label.trim(), month }); };
  return (
    <Overlay onClose={onClose} width={420}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 4 }}>Add milestone</div>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>Place a key date on the timeline.</div>
      <label style={lbl}>Milestone</label>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. MVP go-live" />
      <label style={{ ...lbl, marginTop: 12 }}>Month</label>
      <Select value={month} onChange={(e) => setMonth(+e.target.value)}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</Select>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={pending || !label.trim()} style={{ padding: "10px 18px" }}>{pending ? "Adding…" : "Add milestone"}</Button>
      </div>
    </Overlay>
  );
}

function PhaseModal({ title, phase, onClose, onSave, pending }: { title: string; phase?: Phase; onClose: () => void; onSave: (b: Partial<Phase>) => void; pending?: boolean }) {
  const [name, setName] = useState(phase?.name ?? "");
  const [start, setStart] = useState(phase?.startMonth ?? new Date().getMonth());
  const [end, setEnd] = useState(phase?.endMonth ?? Math.min(11, (phase?.startMonth ?? new Date().getMonth()) + 1));
  const [progress, setProgress] = useState(phase?.progress ?? 0);
  const submit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), startMonth: start, endMonth: Math.max(start, end), progress: Math.max(0, Math.min(100, progress)) });
  };
  return (
    <Overlay onClose={onClose} width={440}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 18 }}>A phase spans a range of months; progress fills the bar.</div>
      <label style={lbl}>Phase name</label>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Design & architecture" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <div><label style={lbl}>Start month</label><Select value={start} onChange={(e) => setStart(+e.target.value)}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</Select></div>
        <div><label style={lbl}>End month</label><Select value={end} onChange={(e) => setEnd(+e.target.value)}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</Select></div>
      </div>
      <label style={{ ...lbl, marginTop: 12 }}>Progress %</label>
      <Input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(Math.max(0, Math.min(100, +e.target.value || 0)))} style={{ width: 100, fontFamily: font.mono }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={pending || !name.trim()} style={{ padding: "10px 18px" }}>{pending ? "Saving…" : "Save phase"}</Button>
      </div>
    </Overlay>
  );
}

function Legend({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{swatch}{children}</span>;
}
const selectStyle: React.CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", color: color.primary, background: "#fff", cursor: "pointer", maxWidth: 280 };
const addBtn: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: color.primary, background: color.primaryTint, border: "1px solid #CFE0F4", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", textTransform: "none", letterSpacing: 0 };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", marginBottom: 5 };
