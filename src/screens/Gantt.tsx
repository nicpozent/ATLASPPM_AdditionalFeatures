import { useState, useMemo, useRef, useEffect, createContext, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Input, Select, RowMenu, MenuItem } from "@/components/ui";
import { toast, toastError } from "@/components/Toast";
import { Overlay } from "./Demands";
import {
  type Win, MONTHS, nowAbs, monthOfIso, absOfIso, ymToAbs, absToYm,
  monthAbbr, yearOf, anchored, makeWindow, fitWindowYM, segPct, barGeom, centerPct,
} from "./gantt/model";

const VIEW_TABS = [["schedule", "Schedule"], ["tasks", "Tasks"], ["resources", "Resource allocation"], ["sprints", "Sprints"]] as const;
type ViewId = (typeof VIEW_TABS)[number][0];

interface Phase { id: number; name: string; startMonth: number; endMonth: number; progress: number; }
interface Milestone { id: number; label: string; month: number; date: string; }
interface Gantt { canEdit: boolean; phases: Phase[]; milestones: Milestone[]; projectStart?: number | null; projectEnd?: number | null; startDate?: string; endDate?: string; sprints?: ProgramSprint[]; }
interface ProgramSprint { id: number; name: string; status: string; startMonth: number; endMonth: number; undated: boolean; startDate?: string; endDate?: string; }
interface ProgramRow { projectId: string; projectName: string; phases: Phase[]; startMonth?: number | null; endMonth?: number | null; startDate?: string; endDate?: string; sprints?: ProgramSprint[]; }
interface ProgramGantt { rows: ProgramRow[]; milestones: Milestone[]; }
interface Opt { id: string; name: string; }
interface PortfolioItem { type: string; id: string; name: string; status: string; startMonth: number; endMonth: number; progress: number | null; startLabel: string; endLabel: string; dept: string; }
type PortfolioCat = "all" | "project" | "program" | "product" | "release";
// A dependency edge on the timeline: (fromType,fromId) depends on (toType,toId),
// so the arrow points to → from. `source` is manual | jira | project.
interface TimelineDep { id: number; fromType: string; fromId: string; toType: string; toId: string; source: string; }
// A laid-out bar's position for arrow routing: 0-based row + left/width in %.
interface BarPos { row: number; left: number; width: number; }
interface SprintT { id: number; name: string; startDate: string; endDate: string; status: string; }
interface GTask { id: number; code: string; name: string; sprint: string; status: string; startDate: string; targetDate: string; jiraCreated?: string; startedAt?: string; resolvedAt?: string; assignee?: string; }
const TASK_BAR: Record<string, { bg: string; border: string }> = {
  "To Do":       { bg: color.neutralTint,  border: color.holdBorder },
  "In Progress": { bg: color.primaryTint2, border: color.primary },
  "In Review":   { bg: color.warningTint,  border: color.warning },
  Done:          { bg: color.successTint,  border: color.success },
  Blocked:       { bg: color.dangerTint,   border: color.danger },
};
const LABEL_W = 286;

// ── Timeline window (absolute months) ───────────────────────────────────────
// The pure month/geometry model lives in ./gantt/model (unit-tested). Here we
// keep only the React-coupled pieces: the window context and the CSS builders.
const WinCtx = createContext<Win>({ start: Math.floor(nowAbs() / 12) * 12, span: 12 });
const useWin = () => useContext(WinCtx);

// Window-relative bar geometry as inline styles. Bars fully outside the window
// are hidden; bars crossing an edge are clipped to it (see barGeom).
function barAbs(a0: number, a1: number, win: Win): React.CSSProperties {
  const g = barGeom(a0, a1, win);
  return g ? { position: "absolute", left: `${g.left}%`, width: `${g.width}%`, top: 9, height: 20 } : { display: "none" };
}
const gridBg = (win: Win): React.CSSProperties => ({
  backgroundImage: `linear-gradient(90deg,${color.surfaceAlt} 1px,transparent 1px)`,
  backgroundSize: `${100 / win.span}% 100%`,
});

function useOpts(path: string, key: string) {
  return useQuery({
    queryKey: [key, "opts"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Opt[]> => { try { return (await api<Opt[]>(path)) ?? []; } catch { return []; } },
  });
}

export default function Gantt() {
  const [scope, setScope] = useState<"project" | "program" | "portfolio">("project");
  const [cat, setCat] = useState<PortfolioCat>("all");
  const [pfDept, setPfDept] = useState("all");
  const [view, setView] = useState<ViewId>("schedule");
  const [projectId, setProjectId] = useState<string>("");
  const [programId, setProgramId] = useState<string>("");
  const [addMs, setAddMs] = useState(false);
  const [addPhase, setAddPhase] = useState(false);
  const [editPhase, setEditPhase] = useState<Phase | null>(null);
  // Visible calendar window — default = the current year (identical to the old
  // 12-month grid); the From/To pickers widen it up to 5 years ahead.
  const thisYear = new Date().getFullYear();
  const [fromYM, setFromYM] = useState(`${thisYear}-01`);
  const [toYM, setToYM] = useState(`${thisYear}-12`);
  const win = useMemo<Win>(() => makeWindow(fromYM, toYM), [fromYM, toYM]);
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
        return { id: t.id, name: `${t.code} ${t.name}`.trim(), status: t.status, startMonth: Math.min(ts, te), endMonth: Math.max(ts, te), startDate: t.startDate, endDate: t.targetDate };
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
        startDate: s.startDate, endDate: s.endDate,
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
        return { id: s.id, name: s.name, status: s.status, startMonth: start, endMonth: end, tasks: taskBars(s.name, start, end), undated, startDate: s.startDate, endDate: s.endDate };
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

  // Auto-fit the visible window to the selected project's actual span. Without
  // this the window stays on the current calendar year, so a project whose
  // phases/sprints live in another year shows an empty schedule ("sprints don't
  // show"). We fit once per project (tracked by id) so manual window edits stick.
  const fitYM = useMemo<{ from: string; to: string } | null>(() => {
    if (scope !== "project" || !activeProjectId || !gantt) return null;
    const base = yearOf(absOfIso(gantt.startDate) ?? nowAbs()) * 12;
    const abs: number[] = [];
    const add = (v: number | null | undefined) => { if (v != null) abs.push(v); };
    add(absOfIso(gantt.startDate)); add(absOfIso(gantt.endDate));
    (gantt.phases ?? []).forEach((p) => { abs.push(anchored(base, p.startMonth), anchored(base, p.endMonth)); });
    sprintBars.forEach((s) => {
      abs.push(absOfIso(s.startDate) ?? anchored(base, s.startMonth));
      abs.push(absOfIso(s.endDate) ?? anchored(base, s.endMonth));
    });
    (gantt.milestones ?? []).forEach((m) => add(absOfIso(m.date) ?? base + m.month));
    return fitWindowYM(abs);
  }, [scope, activeProjectId, gantt, sprintBars]);

  const fitRef = useRef<string>("");
  useEffect(() => {
    if (fitYM && activeProjectId && fitRef.current !== activeProjectId) {
      setFromYM(fitYM.from); setToYM(fitYM.to); fitRef.current = activeProjectId;
    }
  }, [fitYM, activeProjectId]);

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
      <div style={{ display: "inline-flex", background: color.border3, borderRadius: 10, padding: 3, gap: 2, marginBottom: 14 }}>
        {([["project", "Project timeline"], ["program", "Program timeline"], ["portfolio", "Portfolio timeline"]] as const).map(([s, label]) => (
          <button key={s} onClick={() => setScope(s)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: scope === s ? color.surface : "transparent", color: scope === s ? color.primary : color.subtle, boxShadow: scope === s ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>{label}</button>
        ))}
      </div>

      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 22px", borderBottom: `1px solid ${color.bg}`, flexWrap: "wrap" }}>
          {scope === "portfolio"
            ? <span style={{ width: 42, height: 42, borderRadius: 11, background: color.primaryTint, color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="layers" size={20} /></span>
            : scope === "program"
            ? <span style={{ width: 42, height: 42, borderRadius: 11, background: color.primaryTint, color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="folders" size={20} /></span>
            : <span style={{ width: 11, height: 11, borderRadius: "50%", background: color.faint3 }} />}
          <div>
            <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>{scope === "portfolio" ? "Portfolio timeline" : scope === "program" ? "Program timeline" : "Project timeline"}</div>
            <div style={{ fontSize: 12, color: color.faint2 }}>{scope === "portfolio" ? "Projects, programs, products & releases on one roadmap — filter by category" : scope === "program" ? "Project timelines aggregated across the program" : "Phases, milestones & dependencies for the selected project"}</div>
          </div>
          <div style={{ flex: 1 }} />
          {scope === "portfolio" ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {([["all", "All"], ["project", "Projects"], ["program", "Programs"], ["product", "Products"], ["release", "Releases"]] as const).map(([c, label]) => (
                <button key={c} onClick={() => setCat(c)} style={{ fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", padding: "5px 11px", borderRadius: 8, border: `1px solid ${cat === c ? color.primary : color.border}`, background: cat === c ? color.primary : "#fff", color: cat === c ? "#fff" : color.textMuted }}>{label}</button>
              ))}
              <select value={pfDept} onChange={(e) => setPfDept(e.target.value)} aria-label="Filter by department"
                style={{ ...selectStyle, marginLeft: 4 }}>
                <option value="all">All departments</option>
                {Array.from(new Set((portfolio?.items ?? []).map((i) => i.dept).filter((d) => !!d))).sort()
                  .map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
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
            <Legend swatch={<span style={{ width: 14, height: 10, borderRadius: 3, background: color.primaryTint2, border: `1px solid ${color.primary}` }} />}>Planned</Legend>
            <Legend swatch={<span style={{ width: 10, height: 10, background: "#E0A100", transform: "rotate(45deg)" }} />}>Milestone</Legend>
            <Legend swatch={<span style={{ width: 2, height: 13, background: "#D13438" }} />}>Today</Legend>
          </div>
        </div>

        {/* timeline window — calendar range, up to 5 years ahead */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 22px", borderBottom: `1px solid ${color.bg}`, background: color.surfaceAlt, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: color.faint, letterSpacing: "0.04em", textTransform: "uppercase" }}>Window</span>
          <input type="month" value={fromYM} max={absToYm(ymToAbs(toYM))} onChange={(e) => e.target.value && setFromYM(e.target.value)} aria-label="Timeline from month" style={winInput} />
          <span style={{ fontSize: 12, color: color.faint2 }}>→</span>
          <input type="month" value={toYM} min={fromYM} onChange={(e) => e.target.value && setToYM(e.target.value)} aria-label="Timeline to month" style={winInput} />
          <span style={{ fontSize: 11.5, color: color.faint3 }}>
            {win.span} mo{win.span >= 12 ? ` · ${(win.span / 12).toFixed(win.span % 12 ? 1 : 0)} yr` : ""}
          </span>
          <div style={{ flex: 1 }} />
          {([["1y", 12], ["2y", 24], ["3y", 36], ["5y", 60]] as const).map(([lbl, n]) => (
            <button key={lbl} onClick={() => setToYM(absToYm(ymToAbs(fromYM) + n - 1))} title={`Show ${n / 12} year${n > 12 ? "s" : ""} from the start month`} style={winBtn}>{lbl}</button>
          ))}
          <button onClick={() => { setFromYM(`${thisYear}-01`); setToYM(`${thisYear}-12`); }} title="Reset to the current calendar year" style={winBtn}>This year</button>
        </div>

        {/* view tabs (project/program only) */}
        {scope !== "portfolio" && (
          <div style={{ display: "flex", gap: 0, padding: "0 22px", borderBottom: `1px solid ${color.bg}`, background: color.surfaceAlt }}>
            {VIEW_TABS.map(([vid, label]) => {
              const active = view === vid;
              return <button key={vid} onClick={() => setView(vid)} style={{ padding: "11px 16px", marginRight: 6, border: "none", borderBottom: active ? `2.5px solid ${color.primary}` : "2.5px solid transparent", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", color: active ? color.primary : color.subtle }}>{label}</button>;
            })}
          </div>
        )}

        <WinCtx.Provider value={win}>
        {scope === "portfolio" ? (
          <PortfolioSchedule items={(portfolio?.items ?? []).filter((i) => (cat === "all" || i.type === cat) && (pfDept === "all" || i.dept === pfDept))} cat={cat} />
        ) : view === "schedule" ? (
          scope === "program"
            ? <ProgramSchedule rows={programGantt?.rows ?? []} milestones={milestones} />
            : <ProjectSchedule
                phases={gantt?.phases ?? []} milestones={milestones} canEdit={canEdit} hasProject={!!activeProjectId}
                projectId={activeProjectId}
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
        </WinCtx.Provider>
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
// Month-of-year (0-11) → absolute month, anchored to a base year (the item's
// project start year). Used for phases/derived sprints that carry no year.

function PhaseBar({ phase, base, editable, onEdit }: { phase: Phase; base: number; editable?: boolean; onEdit?: () => void }) {
  const win = useWin();
  return (
    <div style={{ position: "relative", height: 38, borderBottom: `1px solid ${color.surfaceAlt}` }}>
      <div title={`${phase.name} · ${MONTHS[phase.startMonth]}–${MONTHS[phase.endMonth]} · ${phase.progress}%`}
        onClick={editable ? onEdit : undefined}
        style={{ ...barAbs(anchored(base, phase.startMonth), anchored(base, phase.endMonth), win), borderRadius: 6, background: color.primaryTint2, border: `1px solid ${color.primary}`, overflow: "hidden", cursor: editable ? "pointer" : "default" }}>
        <div style={{ height: "100%", width: `${phase.progress}%`, background: "#0F6CBD" }} />
      </div>
    </div>
  );
}

function MonthHeader() {
  const win = useWin();
  const wide = win.span > 18;
  const cells = Array.from({ length: win.span }, (_, i) => win.start + i);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${win.span},1fr)`, height: 38, borderBottom: `1px solid ${color.bg}` }}>
      {cells.map((abs, i) => {
        const jan = ((abs % 12) + 12) % 12 === 0;
        return (
          <div key={abs} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: wide ? 9 : 11.5, color: color.faint, fontWeight: 600, borderRight: `1px solid ${jan ? color.border2 : color.surfaceAlt}`, overflow: "hidden", lineHeight: 1.15 }}>
            {wide
              ? (jan || i === 0) && <span style={{ fontWeight: 700, color: color.faint2 }}>{yearOf(abs)}</span>
              : <>
                  <span>{monthAbbr(abs)}</span>
                  {(jan || i === 0) && <span style={{ fontSize: 8.5, color: color.faint3 }}>{`’${String(yearOf(abs)).slice(2)}`}</span>}
                </>}
          </div>
        );
      })}
    </div>
  );
}

function NowLine() {
  const win = useWin();
  const a = nowAbs();
  if (a < win.start || a > win.start + win.span - 1) return null;   // today outside the window
  const left = `${(a - win.start + 0.5) / win.span * 100}%`;
  return (
    <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "#D13438", left, zIndex: 5 }}>
      <span style={{ position: "absolute", top: -1, left: -18, fontSize: 9, fontWeight: 700, color: "#fff", background: "#D13438", padding: "1px 5px", borderRadius: 4 }}>NOW</span>
    </div>
  );
}

// ---- Project schedule ------------------------------------------------------
interface SprintTaskBar { id: number; name: string; status: string; startMonth: number; endMonth: number; startDate?: string; endDate?: string; }
interface SprintBar { id: number; name: string; status: string; startMonth: number; endMonth: number; tasks: SprintTaskBar[]; undated?: boolean; startDate?: string; endDate?: string; }
const SPRINT_BAR: Record<string, { bg: string; border: string }> = {
  Started:   { bg: color.successTint,  border: color.success },
  Completed: { bg: color.primaryTint2, border: color.primary },
  Halted:    { bg: color.warningTint,  border: color.warning },
  Cancelled: { bg: color.dangerTint,   border: color.danger },
  Planned:   { bg: color.neutralTint,  border: color.holdBorder },
  // legacy
  Active:    { bg: color.successTint,  border: color.success },
  Closed:    { bg: color.primaryTint2, border: color.primary },
};
// Per-sprint bar colours — the established Atlas hue set (same palette as avatars
// and methodology chips) cycled by row order, so consecutive sprints read as
// distinct bands on the timeline even when they share a status. The hue carries
// identity; status still shows as the label in the left rail (and undated stays
// dashed). A light alpha wash of the same hue is the fill.
const SPRINT_HUES = ["#0F6CBD", "#7A3FB0", "#15A34A", "#C98A00", "#0E7C7B", "#C24A1F", "#5B8FCB", "#A1282B"];
function sprintHue(index: number): { bg: string; border: string } {
  const h = SPRINT_HUES[((index % SPRINT_HUES.length) + SPRINT_HUES.length) % SPRINT_HUES.length];
  return { bg: `${h}22`, border: h }; // ~13% tint fill + solid hue border
}
function ProjectSchedule({ phases, milestones, canEdit, hasProject, projectId, projectStart, projectEnd, startDate, endDate, sprints = [], onAddPhase, onEditPhase, onRemovePhase, onAddMilestone, onRemoveMilestone }: {
  phases: Phase[]; milestones: Milestone[]; canEdit: boolean; hasProject: boolean; projectId: string;
  projectStart: number | null; projectEnd: number | null; startDate: string; endDate: string; sprints?: SprintBar[];
  onAddPhase: () => void; onEditPhase: (p: Phase) => void; onRemovePhase: (id: number) => void;
  onAddMilestone: () => void; onRemoveMilestone: (id: number) => void;
}) {
  const win = useWin();
  const gb = gridBg(win);
  // Anchor bare month-of-year values (phases, derived sprints) to the project's
  // start year; items with real dates are placed by those dates directly.
  const base = yearOf(absOfIso(startDate) ?? win.start) * 12;
  // Collapse the phase grid when there are no phases but sprints exist, so the
  // sprint band sits directly under the window and the columns stay aligned.
  const rowsHeight = phases.length ? Math.max(200, phases.length * 38) : (sprints.length ? 0 : 200);
  const hasWindow = projectStart != null && projectEnd != null;
  const [openSprints, setOpenSprints] = useState<Set<number>>(new Set());
  const toggleSprint = (id: number) => setOpenSprints((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // Sprint-level dependency arrows: only edges whose BOTH ends are sprints of this
  // project (their ids are among the bars we render). Drawn over the right grid.
  const { edges, canEdit: canLink, add: addDep, remove: removeDep } = usePortfolioDeps();
  const qc = useQueryClient();
  const [linking, setLinking] = useState(false);
  const ingestDeps = useMutation({
    mutationFn: () => api<{ added: number; removed: number }>(`/projects/${projectId}/dependencies/jira-ingest`, { method: "POST" }),
    onSuccess: (r) => { toast(`Jira dependencies: +${r?.added ?? 0} · -${r?.removed ?? 0}`, "info"); qc.invalidateQueries({ queryKey: ["portfolio-deps"] }); },
    onError: toastError,
  });
  const gridRef = useRef<HTMLDivElement>(null);
  const sprintIds = new Set(sprints.map((s) => String(s.id)));
  const sprintEdges = edges.filter((e) => e.fromType === "sprint" && e.toType === "sprint" && sprintIds.has(e.fromId) && sprintIds.has(e.toId));
  const sprintName = (id: string) => sprints.find((s) => String(s.id) === id)?.name ?? `sprint ${id}`;
  const manualSprintEdges = sprintEdges.filter((e) => e.source === "manual");
  // Project window bar in absolute months: prefer the real project dates (span
  // years), else anchor the derived month window to the base year.
  const winA = absOfIso(startDate) ?? base + Math.min(projectStart ?? 0, projectEnd ?? 0);
  const winB = absOfIso(endDate) ?? base + Math.max(projectStart ?? 0, projectEnd ?? 0);
  return (
    <>
    <div style={{ display: "flex" }}>
      {/* left labels */}
      <div style={{ width: LABEL_W, flex: "none", borderRight: `1px solid ${color.bg}` }}>
        <div style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
          Phase / Workstream
          {canEdit && <button onClick={onAddPhase} style={addBtn}>+ Add</button>}
        </div>
        {hasWindow && (
          <div style={{ height: 34, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 22px", borderBottom: `1px solid ${color.surfaceAlt}`, background: color.surfaceAlt }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: color.navy }}>Project window</span>
            <span style={{ fontSize: 10.5, color: color.faint3 }}>{startDate || "—"} → {endDate || "—"}</span>
          </div>
        )}
        {phases.length === 0 ? (
          (sprints.length === 0 || !hasProject) && (
            <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 22px", fontSize: 12.5, color: color.faint3, textAlign: "center" }}>
              {hasProject ? "No phases or sprints scheduled yet. For a Jira/ADO project, run a sync (Integrations → Sync) to import its sprints; or add a phase or sprint manually." : "Select a project."}
            </div>
          )
        ) : phases.map((p) => (
          <div key={p.id} style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 14px 0 22px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
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
            <div style={{ height: 30, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 11, fontWeight: 700, color: color.faint, letterSpacing: "0.04em", textTransform: "uppercase", borderTop: `1px solid ${color.bg}`, background: color.surfaceAlt }}>Sprints</div>
            {sprints.map((s, i) => {
              const open = openSprints.has(s.id);
              const hue = sprintHue(i).border;
              return (
                <div key={s.id}>
                  <div onClick={() => toggleSprint(s.id)} title="Show tasks" style={{ height: 34, display: "flex", alignItems: "center", gap: 7, padding: "0 14px 0 18px", borderBottom: `1px solid ${color.surfaceAlt}`, cursor: "pointer" }}>
                    <Icon name={open ? "chevronDown" : "chevronRight"} size={14} color={color.faint} />
                    <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: hue, flex: "none" }} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: (SPRINT_BAR[s.status] ?? SPRINT_BAR.Planned).border }}>{s.status}</span>
                  </div>
                  {open && (s.tasks.length === 0
                    ? <div style={{ height: 28, display: "flex", alignItems: "center", padding: "0 14px 0 42px", fontSize: 11, color: color.faint3, borderBottom: `1px solid ${color.surfaceAlt}` }}>No tasks in this sprint</div>
                    : s.tasks.map((t) => (
                      <div key={t.id} style={{ height: 28, display: "flex", alignItems: "center", padding: "0 14px 0 42px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
                        <span style={{ flex: 1, fontSize: 11, color: color.subtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                      </div>
                    )))}
                </div>
              );
            })}
          </>
        )}
        <div style={{ height: 72, display: "flex", alignItems: "center", gap: 8, padding: "0 22px", fontSize: 11, fontWeight: 700, color: color.faint, letterSpacing: "0.04em", textTransform: "uppercase", borderTop: `1px solid ${color.bg}`, background: color.surfaceAlt }}>
          Milestones
          {canEdit && <button onClick={onAddMilestone} style={addBtn}>+ Add</button>}
        </div>
      </div>
      {/* right grid */}
      <div ref={gridRef} style={{ position: "relative", flex: 1, minWidth: 560, overflow: "hidden" }}>
        <MonthHeader />
        {hasWindow && (
          <div style={{ position: "relative", height: 34, borderBottom: `1px solid ${color.surfaceAlt}`, background: color.surfaceAlt, ...gb }}>
            <div title={`Project ${startDate || "?"} → ${endDate || "?"}`} style={{ ...barAbs(winA, winB, win), top: 8, height: 18, borderRadius: 6, background: `repeating-linear-gradient(45deg,${color.primaryTint2},${color.primaryTint2} 6px,${color.primaryTint2} 6px,${color.primaryTint2} 12px)`, border: `1.5px solid ${color.primary}` }} />
          </div>
        )}
        <div style={{ position: "relative", minHeight: rowsHeight, height: rowsHeight, ...gb }}>
          <NowLine />
          <div>
            {phases.map((p) => <PhaseBar key={p.id} phase={p} base={base} editable={canEdit} onEdit={() => onEditPhase(p)} />)}
          </div>
        </div>
        {sprints.length > 0 && (
          <div>
            <div style={{ height: 30, borderTop: `1px solid ${color.bg}`, background: color.surfaceAlt }} />
            {sprints.map((s, i) => {
              const c = sprintHue(i);
              const open = openSprints.has(s.id);
              return (
                <div key={s.id}>
                  <div style={{ position: "relative", height: 34, ...gb }}>
                    <div data-dep-key={s.id >= 0 ? `sprint-${s.id}` : undefined} title={`${s.name} · ${s.undated ? "dates TBD in Jira" : `${MONTHS[s.startMonth]}–${MONTHS[s.endMonth]}`} · ${s.status}`}
                      style={{ ...barAbs(absOfIso(s.startDate) ?? anchored(base, s.startMonth), absOfIso(s.endDate) ?? anchored(base, s.endMonth), win), top: 7, height: 20, borderRadius: 6, background: c.bg, border: `1px ${s.undated ? "dashed" : "solid"} ${c.border}`, display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 10.5, fontWeight: 600, color: color.text, overflow: "hidden", whiteSpace: "nowrap" }}>{s.name}</div>
                  </div>
                  {open && (s.tasks.length === 0
                    ? <div style={{ height: 28, ...gb }} />
                    : s.tasks.map((t) => {
                      const tc = TASK_BAR[t.status] ?? TASK_BAR["To Do"];
                      return (
                        <div key={t.id} style={{ position: "relative", height: 28, ...gb }}>
                          <div title={`${t.name} · ${t.status}`} style={{ ...barAbs(absOfIso(t.startDate) ?? anchored(base, t.startMonth), absOfIso(t.endDate) ?? anchored(base, t.endMonth), win), top: 6, height: 15, borderRadius: 5, background: tc.bg, border: `1px solid ${tc.border}` }} />
                        </div>
                      );
                    }))}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ height: 72, position: "relative", borderTop: `1px solid ${color.bg}`, background: color.surfaceAlt }}>
          {milestones.map((ms) => {
            const p = centerPct(absOfIso(ms.date) ?? base + ms.month, win);
            if (p === null) return null;   // milestone outside the visible window
            return (
            <div key={ms.id} style={{ position: "absolute", top: 0, left: `${p}%`, transform: "translateX(-50%)", width: 90, textAlign: "center" }}>
              <span style={{ display: "block", width: 16, height: 16, background: "#E0A100", transform: "rotate(45deg)", margin: "10px auto 0", border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,0.22)", cursor: canEdit ? "pointer" : "default" }}
                title={canEdit ? "Remove milestone" : ms.label} onClick={canEdit ? () => onRemoveMilestone(ms.id) : undefined} />
              <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: color.text, whiteSpace: "nowrap", textAlign: "center", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis" }}>{ms.label}</span>
              <span style={{ display: "block", fontSize: 9, color: color.faint3, textAlign: "center" }}>{ms.date}</span>
            </div>
            );
          })}
        </div>
        {sprints.length > 0 && <MeasuredArrows containerRef={gridRef} edges={sprintEdges} remeasure={`${win.start}:${win.span}:${sprints.length}:${[...openSprints].join(",")}:${sprintEdges.length}`} />}
      </div>
    </div>
    {/* Sprint dependency legend + manual linking (project timeline) */}
    {sprints.length > 0 && (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 22px", borderTop: `1px solid ${color.bg}`, background: color.surfaceAlt, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: color.subtle }}>
          <svg width={26} height={8} aria-hidden="true"><line x1={0} y1={4} x2={20} y2={4} stroke={color.faint} strokeWidth={1.5} /><path d="M20,1 L25,4 L20,7 Z" fill={color.faint} /></svg>
          sprint depends on
        </span>
        <span style={{ fontSize: 11, color: color.faint3 }}>{sprintEdges.length} shown</span>
        <div style={{ flex: 1 }} />
        {canLink && (
          <Button variant="secondary" onClick={() => ingestDeps.mutate()} disabled={ingestDeps.isPending} title="Derive sprint dependencies from the project's Jira issue links">
            <Icon name="refresh" size={14} /> {ingestDeps.isPending ? "Ingesting…" : "Ingest from Jira"}
          </Button>
        )}
        {canLink && sprints.filter((s) => s.id >= 0).length >= 2 && <Button variant="secondary" onClick={() => setLinking(true)}><Icon name="plus" size={14} /> Link sprint dependency</Button>}
      </div>
    )}
    {manualSprintEdges.length > 0 && (
      <div style={{ display: "flex", gap: 8, padding: "0 22px 12px", flexWrap: "wrap" }}>
        {manualSprintEdges.map((e) => (
          <span key={e.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: color.text, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 20, padding: "4px 6px 4px 11px" }}>
            {sprintName(e.fromId)} <Icon name="arrowRight" size={12} color={color.faint2} /> {sprintName(e.toId)}
            {canLink && <button onClick={() => removeDep.mutate(e.id)} aria-label="Remove dependency" title="Remove dependency" style={{ border: "none", background: "none", cursor: "pointer", color: color.faint3, padding: 2, lineHeight: 0 }}><Icon name="x" size={13} /></button>}
          </span>
        ))}
      </div>
    )}
    {linking && (
      <LinkSprintModal projectId={projectId} sprints={sprints.filter((s) => s.id >= 0)} onClose={() => setLinking(false)}
        onAdd={(b) => { addDep.mutate(b); setLinking(false); }} pending={addDep.isPending} />
    )}
    </>
  );
}

// Modal to hand-draw a sprint→sprint dependency within one project's timeline.
function LinkSprintModal({ projectId, sprints, onClose, onAdd, pending }: {
  projectId: string; sprints: SprintBar[]; onClose: () => void;
  onAdd: (b: { fromType: string; fromId: string; toType: string; toId: string }) => void; pending?: boolean;
}) {
  void projectId;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const submit = () => { if (from && to && from !== to) onAdd({ fromType: "sprint", fromId: from, toType: "sprint", toId: to }); };
  return (
    <Overlay onClose={onClose} width={440}>
      <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 700, color: color.ink, marginBottom: 4 }}>Link a sprint dependency</div>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 16 }}>Draw an arrow from the sprint that <b>depends on</b> an earlier one.</div>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>This sprint…</label>
      <Select value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "100%", marginBottom: 14 }}>
        <option value="">Select a sprint…</option>
        {sprints.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
      </Select>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>…depends on</label>
      <Select value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "100%", marginBottom: 18 }}>
        <option value="">Select an upstream sprint…</option>
        {sprints.map((s) => <option key={s.id} value={String(s.id)} disabled={String(s.id) === from}>{s.name}</option>)}
      </Select>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!from || !to || from === to || pending}>Link</Button>
      </div>
    </Overlay>
  );
}

// ---- Dependency arrows (SVG overlay) ---------------------------------------
// Routes a finish-to-start elbow from each upstream bar's right edge to the
// downstream bar's left edge. Positions come in as percentages; we measure the
// grid's pixel width so the arrowheads stay round (no non-uniform SVG scaling).
// Absolutely positioned, non-interactive, and sits just under the Today line.
function DependencyLayer({ edges, pos, rowH, rows }: { edges: TimelineDep[]; pos: Map<string, BarPos>; rowH: number; rows: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = rows * rowH;
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 }}>
      {w > 0 && (
        <svg width={w} height={H} style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }} aria-hidden="true">
          <defs>
            <marker id="dep-arrowhead" markerWidth="8" markerHeight="8" refX="5.5" refY="3" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L6,3 L0,6 Z" fill={color.faint} />
            </marker>
          </defs>
          {edges.map((e) => {
            const up = pos.get(`${e.toType}-${e.toId}`);
            const down = pos.get(`${e.fromType}-${e.fromId}`);
            if (!up || !down) return null;   // an endpoint is off-window / not shown
            const x1 = ((up.left + up.width) / 100) * w, y1 = up.row * rowH + rowH / 2;
            const x2 = (down.left / 100) * w, y2 = down.row * rowH + rowH / 2;
            // Route the long horizontal run through the target row's GUTTER (bars
            // sit at top:9 h:20, so 0–9 / 29–38 are clear) rather than across the
            // bar's centre, and drop into the target from just left of its bar — so
            // the connector never runs over a timeline bar. A short stub exits the
            // source's right edge; a short stub enters the target's left edge.
            const xR = x1 + 12;                         // stub right of the source bar
            const xE = Math.max(2, x2 - 10);            // just left of the target bar
            const yG = down.row >= up.row ? down.row * rowH + 5 : down.row * rowH + rowH - 5;
            return (
              <path key={e.id || `${e.fromType}${e.fromId}~${e.toType}${e.toId}`}
                d={`M ${x1} ${y1} H ${xR} V ${yG} H ${xE} V ${y2} H ${x2}`} fill="none"
                stroke={color.faint} strokeWidth={1.5} strokeDasharray={e.source === "manual" ? "" : "4 3"}
                markerEnd="url(#dep-arrowhead)" opacity={0.9} />
            );
          })}
        </svg>
      )}
    </div>
  );
}

// Measured dependency overlay — reads the on-screen rect of every bar tagged
// with data-dep-key inside `containerRef` and draws arrows between them. Used on
// the Project/Program timelines whose rows are non-uniform and expandable, so
// positions come from the real DOM (correct by construction) rather than
// hand-computed row math. `remeasure` is any value that changes when layout does
// (window, expand state, edge list) to re-run the measurement.
function MeasuredArrows({ containerRef, edges, remeasure }: {
  containerRef: React.RefObject<HTMLDivElement | null>; edges: TimelineDep[]; remeasure: unknown;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [rects, setRects] = useState<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const base = el.getBoundingClientRect();
      const m = new Map<string, { x: number; y: number; w: number; h: number }>();
      el.querySelectorAll<HTMLElement>("[data-dep-key]").forEach((n) => {
        const k = n.getAttribute("data-dep-key");
        if (!k) return;
        const r = n.getBoundingClientRect();
        m.set(k, { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
      });
      setRects(m);
      setBox({ w: el.clientWidth, h: el.scrollHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, remeasure]);
  return (
    <svg width={box.w} height={box.h} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible", zIndex: 4 }} aria-hidden="true">
      <defs>
        <marker id="dep-arrowhead-m" markerWidth="8" markerHeight="8" refX="5.5" refY="3" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L6,3 L0,6 Z" fill={color.faint} />
        </marker>
      </defs>
      {edges.map((e) => {
        const up = rects.get(`${e.toType}-${e.toId}`), down = rects.get(`${e.fromType}-${e.fromId}`);
        if (!up || !down) return null;
        const x1 = up.x + up.w, y1 = up.y + up.h / 2, x2 = down.x, y2 = down.y + down.h / 2;
        const midX = Math.max(x1 + 12, x2 - 12);
        return (
          <path key={e.id || `${e.fromType}${e.fromId}~${e.toType}${e.toId}`}
            d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`} fill="none"
            stroke={color.faint} strokeWidth={1.5} strokeDasharray={e.source === "manual" ? "" : "4 3"}
            markerEnd="url(#dep-arrowhead-m)" opacity={0.85} />
        );
      })}
    </svg>
  );
}

// Shared portfolio/timeline dependency edges + link mutations (one row per
// dependency; source manual|jira|project). Used by every timeline scope.
function usePortfolioDeps() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["portfolio-deps"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<{ canEdit: boolean; edges: TimelineDep[] }> =>
      (await api<{ canEdit: boolean; edges: TimelineDep[] }>("/portfolio/dependencies")) ?? { canEdit: false, edges: [] },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["portfolio-deps"] });
  const add = useMutation({
    mutationFn: (b: { fromType: string; fromId: string; toType: string; toId: string }) => api("/portfolio/dependencies", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => { toast("Dependency linked", "info"); invalidate(); }, onError: toastError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/portfolio/dependencies/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast("Dependency removed", "info"); invalidate(); }, onError: toastError,
  });
  return { edges: data?.edges ?? [], canEdit: data?.canEdit ?? false, add, remove };
}

// ---- Portfolio schedule (all entity types on one grid) --------------------
const PF_TYPE: Record<string, { ink: string; tint: string; bar: string; label: string }> = {
  project: { ink: "#7A3FB0", tint: color.accentTint, bar: "#7A3FB0", label: "Project" },
  program: { ink: color.primaryDark, tint: color.primaryTint2, bar: "#0F6CBD", label: "Program" },
  product: { ink: color.successInk, tint: color.successTint, bar: "#15A34A", label: "Product" },
  release: { ink: color.warningInk, tint: color.warningTint, bar: "#E0A100", label: "Release" },
};
// Per-item bar colour — a distinct hue from the established Atlas palette, keyed
// by the item's stable id so each timeline bar reads as its own band (the type
// stays identified by the left-rail chip). Makes a newly-added item visibly
// distinct rather than merging into a wall of one colour.
const PF_HUES = ["#0F6CBD", "#7A3FB0", "#15A34A", "#C98A00", "#0E7C7B", "#C24A1F", "#5B8FCB", "#A1282B"];
function pfHue(key: string): { bar: string; tint: string } {
  let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = PF_HUES[h % PF_HUES.length];
  return { bar: hue, tint: `${hue}22` };
}
function PortfolioSchedule({ items, cat }: { items: PortfolioItem[]; cat: PortfolioCat }) {
  const win = useWin();
  const gb = gridBg(win);
  const [linking, setLinking] = useState(false);
  const { edges, canEdit, add: addDep, remove: removeDep } = usePortfolioDeps();
  // Dated items (startLabel/endLabel are ISO/display dates) place across years;
  // items with only a derived month window anchor to the window's start year.
  const itemAbs = (label: string, month: number) => absOfIso(label) ?? yearOf(win.start) * 12 + month;
  if (items.length === 0) return <Note text={cat === "all" ? "Nothing with dates in the portfolio yet. Set start/end dates on projects, programs, products or releases to see them here." : "No dated items in this category."} />;
  const rowsHeight = Math.max(120, items.length * 38);
  const nameOf = new Map(items.map((i) => [`${i.type}-${i.id}`, i.name]));
  // Bar positions (%) for arrow routing — only items whose bar is on the window.
  const pos = new Map<string, BarPos>();
  items.forEach((i, row) => {
    const g = barGeom(itemAbs(i.startLabel, i.startMonth), itemAbs(i.endLabel, i.endMonth), win);
    if (g) pos.set(`${i.type}-${i.id}`, { row, left: g.left, width: g.width });
  });
  // Draw only edges whose BOTH ends are visible in the current filter + window.
  const visibleEdges = edges.filter((e) => pos.has(`${e.toType}-${e.toId}`) && pos.has(`${e.fromType}-${e.fromId}`));
  const manualEdges = edges.filter((e) => e.source === "manual");
  const label = (type: string, id: string) => nameOf.get(`${type}-${id}`) ?? `${type} ${id}`;
  return (
    <>
    <div style={{ display: "flex" }}>
      <div style={{ width: LABEL_W, flex: "none", borderRight: `1px solid ${color.bg}` }}>
        <div style={{ height: 38, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>Item</div>
        {items.map((i) => {
          const t = PF_TYPE[i.type] ?? PF_TYPE.project;
          return (
            <div key={`${i.type}-${i.id}`} style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 14px 0 22px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: t.ink, background: t.tint, padding: "2px 7px", borderRadius: 20, flex: "none" }}>{t.label}</span>
              <span style={{ flex: 1, fontSize: 12.5, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</span>
              {i.progress !== null && <span style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 700, color: color.faint3, flex: "none" }}>{i.progress}%</span>}
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, minWidth: 560, overflow: "hidden" }}>
        <MonthHeader />
        <div style={{ position: "relative", height: rowsHeight, ...gb }}>
          <NowLine />
          {items.map((i) => {
            const c = pfHue(`${i.type}-${i.id}`);
            return (
              <div key={`${i.type}-${i.id}`} style={{ position: "relative", height: 38, borderBottom: `1px solid ${color.surfaceAlt}` }}>
                <div title={`${i.name} · ${i.startLabel || "?"} → ${i.endLabel || "?"}${i.progress !== null ? ` · ${i.progress}%` : ""}`}
                  style={{ ...barAbs(itemAbs(i.startLabel, i.startMonth), itemAbs(i.endLabel, i.endMonth), win), borderRadius: 6, background: c.tint, border: `1px solid ${c.bar}`, overflow: "hidden" }}>
                  {i.progress !== null && <div style={{ height: "100%", width: `${i.progress}%`, background: c.bar }} />}
                </div>
              </div>
            );
          })}
          <DependencyLayer edges={visibleEdges} pos={pos} rowH={38} rows={items.length} />
        </div>
      </div>
    </div>
    {/* Dependency legend + manual link management */}
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 22px", borderTop: `1px solid ${color.bg}`, background: color.surfaceAlt, flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: color.subtle }}>
        <svg width={26} height={8} aria-hidden="true"><line x1={0} y1={4} x2={20} y2={4} stroke={color.faint} strokeWidth={1.5} /><path d="M20,1 L25,4 L20,7 Z" fill={color.faint} /></svg>
        depends on
      </span>
      <span style={{ fontSize: 11, color: color.faint3 }}>{visibleEdges.length} shown{edges.length !== visibleEdges.length ? ` · ${edges.length - visibleEdges.length} off-window` : ""}</span>
      <div style={{ flex: 1 }} />
      {canEdit && <Button variant="secondary" onClick={() => setLinking(true)}><Icon name="plus" size={14} /> Link dependency</Button>}
    </div>
    {manualEdges.length > 0 && (
      <div style={{ display: "flex", gap: 8, padding: "0 22px 12px", flexWrap: "wrap" }}>
        {manualEdges.map((e) => (
          <span key={e.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: color.text, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 20, padding: "4px 6px 4px 11px" }}>
            {label(e.fromType, e.fromId)} <Icon name="arrowRight" size={12} color={color.faint2} /> {label(e.toType, e.toId)}
            {canEdit && <button onClick={() => removeDep.mutate(e.id)} aria-label="Remove dependency" title="Remove dependency" style={{ border: "none", background: "none", cursor: "pointer", color: color.faint3, padding: 2, lineHeight: 0 }}><Icon name="x" size={13} /></button>}
          </span>
        ))}
      </div>
    )}
    {linking && <LinkDependencyModal items={items} onClose={() => setLinking(false)} onAdd={(b) => { addDep.mutate(b); setLinking(false); }} pending={addDep.isPending} />}
    </>
  );
}

// Modal to hand-draw a cross-entity dependency between two portfolio items.
function LinkDependencyModal({ items, onClose, onAdd, pending }: {
  items: PortfolioItem[]; onClose: () => void;
  onAdd: (b: { fromType: string; fromId: string; toType: string; toId: string }) => void; pending?: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const opt = (i: PortfolioItem) => ({ key: `${i.type}-${i.id}`, label: `${(PF_TYPE[i.type] ?? PF_TYPE.project).label} · ${i.name}` });
  const split = (key: string) => { const idx = key.indexOf("-"); return { type: key.slice(0, idx), id: key.slice(idx + 1) }; };
  const submit = () => {
    if (!from || !to || from === to) return;
    const f = split(from), t = split(to);
    onAdd({ fromType: f.type, fromId: f.id, toType: t.type, toId: t.id });
  };
  return (
    <Overlay onClose={onClose} width={460}>
      <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 700, color: color.ink, marginBottom: 4 }}>Link a dependency</div>
      <div style={{ fontSize: 12.5, color: color.faint2, marginBottom: 16 }}>Draw an arrow from the item that <b>depends on</b> another. Both must be visible in the current filter.</div>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>This item…</label>
      <Select value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "100%", marginBottom: 14 }}>
        <option value="">Select an item…</option>
        {items.map((i) => { const o = opt(i); return <option key={o.key} value={o.key}>{o.label}</option>; })}
      </Select>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 }}>…depends on</label>
      <Select value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "100%", marginBottom: 18 }}>
        <option value="">Select an upstream item…</option>
        {items.map((i) => { const o = opt(i); return <option key={o.key} value={o.key} disabled={o.key === from}>{o.label}</option>; })}
      </Select>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!from || !to || from === to || pending}>Link</Button>
      </div>
    </Overlay>
  );
}

// ---- Program schedule (aggregate) ------------------------------------------
function ProgramSchedule({ rows, milestones }: { rows: ProgramRow[]; milestones: Milestone[] }) {
  const win = useWin();
  const gb = gridBg(win);
  const msBase = yearOf(win.start) * 12;
  // Read-only dependency arrows across the program's projects & sprints.
  const { edges } = usePortfolioDeps();
  const gridRef = useRef<HTMLDivElement>(null);
  const keys = new Set<string>();
  rows.forEach((r) => { keys.add(`project-${r.projectId}`); (r.sprints ?? []).forEach((s) => keys.add(`sprint-${s.id}`)); });
  const progEdges = edges.filter((e) => keys.has(`${e.fromType}-${e.fromId}`) && keys.has(`${e.toType}-${e.toId}`));
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
              <div style={{ height: 30, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 12, fontWeight: 700, color: color.navy, background: color.surfaceAlt, borderBottom: `1px solid ${color.bg}` }}>{r.projectName}</div>
              {hasWindow && (
                <div style={{ height: 30, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 22px", borderBottom: `1px solid ${color.surfaceAlt}`, background: color.surfaceAlt }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: color.navy }}>Project window</span>
                  <span style={{ fontSize: 10, color: color.faint3 }}>{r.startDate || "—"} → {r.endDate || "—"}</span>
                </div>
              )}
              {r.phases.map((p) => (
                <div key={p.id} style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 22px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
                  <span style={{ flex: 1, fontSize: 12, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                  <span style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 700, color: color.faint3 }}>{p.progress}%</span>
                </div>
              ))}
              {(r.sprints ?? []).map((s) => (
                <div key={s.id} style={{ height: 34, display: "flex", alignItems: "center", gap: 7, padding: "0 22px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
                  <Icon name="zap" size={13} color={color.faint} />
                  <span style={{ flex: 1, fontSize: 11.5, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: (SPRINT_BAR[s.status] ?? SPRINT_BAR.Planned).border }}>{s.status}</span>
                </div>
              ))}
              {empty && <div style={{ height: 38, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 11.5, color: color.faint3, borderBottom: `1px solid ${color.surfaceAlt}` }}>No schedule yet</div>}
            </div>
          );
        })}
      </div>
      {/* right grid */}
      <div style={{ flex: 1, minWidth: 560, overflow: "hidden" }}>
        <MonthHeader />
        <div ref={gridRef} style={{ position: "relative", ...gb }}>
          <NowLine />
          {rows.map((r) => {
            const hasWindow = r.startMonth != null && r.endMonth != null;
            const empty = !hasWindow && r.phases.length === 0 && (r.sprints?.length ?? 0) === 0;
            const base = yearOf(absOfIso(r.startDate) ?? win.start) * 12;   // this row's anchor year
            return (
              <div key={r.projectId}>
                <div style={{ height: 30, borderBottom: `1px solid ${color.bg}`, background: color.surfaceAlt }} />
                {hasWindow && (
                  <div style={{ position: "relative", height: 30, borderBottom: `1px solid ${color.surfaceAlt}`, background: color.surfaceAlt }}>
                    <div data-dep-key={`project-${r.projectId}`} title={`${r.startDate || "?"} → ${r.endDate || "?"}`} style={{ ...barAbs(absOfIso(r.startDate) ?? base + Math.min(r.startMonth!, r.endMonth!), absOfIso(r.endDate) ?? base + Math.max(r.startMonth!, r.endMonth!), win), top: 6, height: 18, borderRadius: 6, background: `repeating-linear-gradient(45deg,${color.primaryTint2},${color.primaryTint2} 6px,${color.primaryTint2} 6px,${color.primaryTint2} 12px)`, border: `1.5px solid ${color.primary}` }} />
                  </div>
                )}
                {r.phases.map((p) => <PhaseBar key={p.id} phase={p} base={base} />)}
                {(r.sprints ?? []).map((s) => {
                  const c = SPRINT_BAR[s.status] ?? SPRINT_BAR.Planned;
                  return (
                    <div key={s.id} style={{ position: "relative", height: 34, ...gb }}>
                      <div data-dep-key={s.id >= 0 ? `sprint-${s.id}` : undefined} title={`${s.name} · ${s.undated ? "dates TBD in Jira" : `${MONTHS[s.startMonth]}–${MONTHS[s.endMonth]}`} · ${s.status}`}
                        style={{ ...barAbs(absOfIso(s.startDate) ?? anchored(base, s.startMonth), absOfIso(s.endDate) ?? anchored(base, s.endMonth), win), top: 7, height: 20, borderRadius: 6, background: c.bg, border: `1px ${s.undated ? "dashed" : "solid"} ${c.border}`, display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 10.5, fontWeight: 600, color: color.text, overflow: "hidden", whiteSpace: "nowrap" }}>{s.name}</div>
                    </div>
                  );
                })}
                {empty && <div style={{ height: 38, borderBottom: `1px solid ${color.surfaceAlt}` }} />}
              </div>
            );
          })}
          <MeasuredArrows containerRef={gridRef} edges={progEdges} remeasure={`${win.start}:${win.span}:${rows.length}:${progEdges.length}`} />
        </div>
        <div style={{ height: 72, position: "relative", borderTop: `1px solid ${color.bg}`, background: color.surfaceAlt }}>
          {milestones.map((ms) => {
            const p = centerPct(absOfIso(ms.date) ?? msBase + ms.month, win);
            if (p === null) return null;
            return (
            <div key={ms.id} style={{ position: "absolute", top: 0, left: `${p}%`, transform: "translateX(-50%)", width: 90, textAlign: "center" }}>
              <span style={{ display: "block", width: 14, height: 14, background: "#E0A100", transform: "rotate(45deg)", margin: "12px auto 0", border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,0.22)" }} />
              <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: color.text, whiteSpace: "nowrap", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis" }}>{ms.label}</span>
            </div>
            );
          })}
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
        <div key={p.name} style={{ display: "grid", gridTemplateColumns: "200px 1fr 54px", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: `1px solid ${color.surfaceAlt}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: p.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, flex: "none" }}>{p.initials}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ fontSize: 10.5, color: color.faint3 }}>{p.role}</div>
            </div>
          </div>
          <div style={{ height: 14, background: color.bg, borderRadius: 7, overflow: "hidden", display: "flex", position: "relative" }}>
            {seg(p.opsPct, "#8A93A6")}{seg(p.projectPct, "#0F6CBD")}{seg(p.productPct, "#7A3FB0")}
            {p.util > 100 && <span style={{ position: "absolute", right: 4, top: -1, fontSize: 9, fontWeight: 700, color: color.dangerInk }}>over</span>}
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
  "Done": { ink: color.successInk, tint: color.successTint }, "In Progress": { ink: color.primaryDark, tint: color.primaryTint2 },
  "In Review": { ink: color.warningInk, tint: color.warningTint }, "To Do": { ink: color.subtle, tint: color.bg },
  "Blocked": { ink: color.dangerInk, tint: color.dangerTint },
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: color.surfaceAlt, borderBottom: `1px solid ${color.bg}` }}>
              <span style={{ fontFamily: font.head, fontSize: 14, fontWeight: 600, color: color.navy }}>{sprint}</span>
              <span style={{ fontSize: 11.5, color: color.faint2 }}>{items.length} task{items.length === 1 ? "" : "s"} · {done} done</span>
              <div style={{ flex: 1 }} />
              <div style={{ width: 120, height: 6, background: color.bg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${items.length ? Math.round(done / items.length * 100) : 0}%`, background: "#15A34A" }} />
              </div>
            </div>
            {items.map((t) => {
              const sc = TASK_STATUS[t.status] ?? TASK_STATUS["To Do"];
              return (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 140px 110px", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: `1px solid ${color.surfaceAlt}` }}>
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
// Order tasks are shown/sorted in.
type TaskSort = "created" | "createdDesc" | "status" | "age";
const TASK_SORTS: [TaskSort, string][] = [
  ["created", "Created (oldest)"], ["createdDesc", "Created (newest)"],
  ["status", "By status"], ["age", "Longest-running"],
];
const STATUS_ORDER: Record<string, number> = { "To Do": 0, "In Progress": 1, "In Review": 2, Blocked: 3, Done: 4 };
const ROW_H = 34;
const VIEWPORT_H = 520;   // scroll-window height for the virtualized body

// The Tasks view is a LIFECYCLE timeline, not a duration Gantt: each work-item is
// drawn along its real life — created → (work started) → resolved — because a Jira
// issue rarely has a planned start/end span (which is why a plain bar looked like
// noise). A faint track shows how long it has existed (age); the solid segment is
// the active/working period; markers pin the created / started / resolved dates.
function TaskTimeline({ tasks, hasProject }: { tasks: GTask[]; hasProject: boolean }) {
  const win = useWin();
  const gb = gridBg(win);
  const now = nowAbs();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<TaskSort>("created");
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const statuses = useMemo(() => Array.from(new Set(tasks.map((t) => t.status).filter(Boolean))), [tasks]);

  const rows = useMemo(() => {
    const mapped = tasks
      .filter((t) => statusFilter === "all" || t.status === statusFilter)
      .map((t) => {
        const isDone = t.status === "Done";
        const cat: "todo" | "active" | "done" | "blocked" =
          isDone ? "done" : t.status === "Blocked" ? "blocked" : t.status === "To Do" || !t.status ? "todo" : "active";
        const createdA = absOfIso(t.jiraCreated) ?? absOfIso(t.startDate);
        const startedA = absOfIso(t.startedAt);
        const resolvedA = absOfIso(t.resolvedAt) ?? (isDone ? absOfIso(t.targetDate) : null);
        const originA = createdA ?? startedA ?? resolvedA;
        const endA = isDone ? (resolvedA ?? startedA ?? originA ?? now) : now;
        // "todo" items have no active period — they're still sitting in the backlog.
        const activeA = cat === "todo" ? null : (startedA ?? createdA ?? originA);
        const scheduled = originA !== null;
        const span = originA === null ? 0 : Math.max(0, (isDone ? (resolvedA ?? now) : now) - originA);
        return { ...t, cat, createdA, startedA, resolvedA, originA, endA, activeA, scheduled, span };
      });
    const byCode = (a: typeof mapped[number], b: typeof mapped[number]) => a.code.localeCompare(b.code, undefined, { numeric: true });
    const o = (v: number | null) => v ?? Number.POSITIVE_INFINITY;
    switch (sort) {
      case "createdDesc": return [...mapped].sort((a, b) => o(b.originA) - o(a.originA) || byCode(a, b));
      case "status": return [...mapped].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || o(a.originA) - o(b.originA) || byCode(a, b));
      case "age": return [...mapped].sort((a, b) => b.span - a.span || byCode(a, b));
      default: return [...mapped].sort((a, b) => o(a.originA) - o(b.originA) || byCode(a, b));
    }
  }, [tasks, statusFilter, sort, now]);

  if (!hasProject) return <Note text="Select a project." />;
  if (tasks.length === 0) return <Note text="No tasks for this project yet. Tasks (created here or synced from Jira) will appear on this timeline." />;

  const total = rows.length * ROW_H;
  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - 8);
  const last = Math.min(rows.length, Math.ceil((scrollTop + VIEWPORT_H) / ROW_H) + 8);
  const visible = rows.slice(first, last);
  const chip = (label: string, sw: React.ReactNode) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: color.faint2 }}>{sw}{label}</span>
  );

  return (
    <div>
      {/* status filter + sort */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", padding: "12px 22px", borderBottom: `1px solid ${color.bg}`, background: color.surfaceAlt }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: color.subtle, marginRight: 2 }}>Status</span>
        {(["all", ...statuses]).map((s) => {
          const active = statusFilter === s;
          const c = s === "all" ? { bg: color.primary, border: color.primary } : (TASK_BAR[s] ?? TASK_BAR["To Do"]);
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", padding: "4px 11px", borderRadius: 20,
              border: `1px solid ${active ? c.border : color.border}`, background: active ? (s === "all" ? color.primary : c.bg) : color.surface,
              color: active && s === "all" ? "#fff" : active ? c.border : color.textMuted,
            }}>{s === "all" ? "All" : s} · {s === "all" ? tasks.length : tasks.filter((t) => t.status === s).length}</button>
          );
        })}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: color.subtle }}>Sort</span>
        <Select value={sort} onChange={(e) => setSort(e.target.value as TaskSort)} style={{ width: 168, height: 30, padding: "0 8px", fontSize: 12 }}>
          {TASK_SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      {/* legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "7px 22px", borderBottom: `1px solid ${color.bg}` }}>
        {chip("Created", <span style={{ width: 9, height: 9, borderRadius: 9, background: color.surface, border: `2px solid ${color.faint2}` }} />)}
        {chip("Work started", <span style={{ width: 8, height: 8, background: color.primary, transform: "rotate(45deg)", display: "inline-block" }} />)}
        {chip("Resolved", <span style={{ width: 9, height: 9, borderRadius: 9, background: color.success }} />)}
        {chip("Active period", <span style={{ width: 18, height: 8, borderRadius: 3, background: color.primaryTint2, border: `1px solid ${color.primary}` }} />)}
        {chip("Age", <span style={{ width: 18, height: 3, borderRadius: 2, background: color.border2 }} />)}
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: color.faint3 }}>Markers outside the selected dates are hidden — widen From / To above.</span>
      </div>
      {/* header row (label + months), non-scrolling */}
      <div style={{ display: "flex", borderBottom: `1px solid ${color.bg}` }}>
        <div style={{ width: LABEL_W, flex: "none", height: 38, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 11, color: color.faint3, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, borderRight: `1px solid ${color.bg}` }}>
          Task · {rows.length}
        </div>
        <div style={{ flex: 1, minWidth: 560 }}><MonthHeader /></div>
      </div>
      {/* virtualized scrolling body — only visible rows are rendered */}
      <div ref={scrollRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={{ maxHeight: VIEWPORT_H, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ display: "flex" }}>
          {/* left labels */}
          <div style={{ width: LABEL_W, flex: "none", borderRight: `1px solid ${color.bg}`, position: "relative", height: total }}>
            {visible.map((t, i) => (
              <div key={t.id} style={{ position: "absolute", top: (first + i) * ROW_H, left: 0, right: 0, height: ROW_H, display: "flex", alignItems: "center", gap: 8, padding: "0 14px 0 22px", borderBottom: `1px solid ${color.surfaceAlt}`, boxSizing: "border-box" }}>
                <span style={{ fontFamily: font.mono, fontSize: 10.5, color: color.faint3, flex: "none" }}>{t.code}</span>
                <span style={{ flex: 1, fontSize: 12, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                {t.sprint && <span style={{ fontSize: 9.5, fontWeight: 700, color: color.primaryDark, background: color.primaryTint2, padding: "1px 6px", borderRadius: 5, flex: "none" }}>{t.sprint}</span>}
              </div>
            ))}
          </div>
          {/* right grid */}
          <div style={{ flex: 1, minWidth: 560, position: "relative", height: total, ...gb }}>
            <NowLine />
            {visible.map((t, i) => (
              <TaskLifeRow key={t.id} t={t} top={(first + i) * ROW_H} win={win} now={now} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// One task's lifecycle row: faint age track + active segment + created/started/
// resolved markers, all positioned by real dates within the window.
function TaskLifeRow({ t, top, win, now }: {
  t: { code: string; name: string; status: string; cat: "todo" | "active" | "done" | "blocked"; scheduled: boolean;
    createdA: number | null; startedA: number | null; resolvedA: number | null; originA: number | null; endA: number; activeA: number | null;
    jiraCreated?: string; startedAt?: string; resolvedAt?: string };
  top: number; win: Win; now: number;
}) {
  const tc = TASK_BAR[t.status] ?? TASK_BAR["To Do"];
  const track = t.originA === null ? null : segPct(t.originA, t.endA, win);
  const active = t.activeA === null ? null : segPct(t.activeA, t.endA, win);
  const createdPct = t.originA === null ? null : centerPct(t.originA, win);
  const startedPct = t.startedA !== null && t.originA !== null && t.startedA > t.originA && t.cat !== "todo" ? centerPct(t.startedA, win) : null;
  const resolvedPct = t.cat === "done" && t.resolvedA !== null ? centerPct(t.resolvedA, win) : null;
  const ageMonths = t.originA === null ? 0 : Math.max(0, (t.cat === "done" ? (t.resolvedA ?? now) : now) - (t.activeA ?? t.originA));
  const tip = [`${t.code} ${t.name}`, t.status,
    t.jiraCreated ? `Created ${t.jiraCreated}` : "", t.startedAt ? `Started ${t.startedAt}` : "",
    t.resolvedAt ? `Resolved ${t.resolvedAt}` : (t.cat !== "done" && t.originA !== null ? `Open ${ageMonths}mo` : ""),
    !t.scheduled ? "No dates" : ""].filter(Boolean).join(" · ");
  const dot = (pct: number, style: React.CSSProperties) => (
    <div title={tip} style={{ position: "absolute", left: `${pct}%`, marginLeft: -5, zIndex: 3, ...style }} />
  );
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, height: ROW_H, borderBottom: `1px solid ${color.surfaceAlt}`, boxSizing: "border-box" }}>
      {track && <div title={tip} style={{ position: "absolute", left: `${track.left}%`, width: `${track.width}%`, top: 15, height: 4, borderRadius: 2, background: color.border2 }} />}
      {active && <div title={tip} style={{ position: "absolute", left: `${active.left}%`, width: `${active.width}%`, top: 9, height: 16, borderRadius: 5, background: tc.bg, border: `1px solid ${tc.border}` }} />}
      {createdPct !== null && dot(createdPct, { top: 10.5, width: 9, height: 9, borderRadius: 9, background: color.surface, border: `2px solid ${tc.border}`, boxSizing: "border-box" })}
      {startedPct !== null && dot(startedPct, { top: 11, width: 8, height: 8, marginLeft: -4, background: color.primary, transform: "rotate(45deg)" })}
      {resolvedPct !== null && dot(resolvedPct, { top: 10.5, width: 9, height: 9, borderRadius: 9, background: color.success })}
      {!t.scheduled && <span style={{ position: "absolute", left: 6, top: 9, fontSize: 10, color: color.faint3, fontStyle: "italic" }}>No dates</span>}
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
const selectStyle: React.CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", color: color.primary, background: color.surface, cursor: "pointer", maxWidth: 280 };
const winInput: React.CSSProperties = { border: `1px solid ${color.border2}`, borderRadius: 7, padding: "5px 8px", fontSize: 12, fontFamily: "inherit", color: color.text, background: color.surface, cursor: "pointer" };
const winBtn: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", padding: "5px 10px", borderRadius: 7, border: `1px solid ${color.border}`, background: color.surface, color: color.textMuted };
const addBtn: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: color.primary, background: color.primaryTint, border: `1px solid ${color.primaryTint2}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", textTransform: "none", letterSpacing: 0 };
const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: color.subtle, marginBottom: 5 };
