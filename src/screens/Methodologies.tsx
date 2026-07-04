import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font, radius } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Input, Select } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { Overlay } from "./Demands";

// ---- Methodology library (structural catalogue — these definitions ARE the content) ----
interface Method { name: string; desc: string; meta: string; best: string; icon: string; default?: boolean }
const METHODOLOGY_GROUPS: { group: string; items: Method[] }[] = [
  {
    group: "Traditional / Predictive",
    items: [
      { name: "Waterfall", desc: "Sequential phases with formal sign-off gates.", meta: "6 phases", best: "Fixed scope, regulated delivery", icon: "list" },
      { name: "V-Model", desc: "Verification & validation paired to each design stage.", meta: "8 stages", best: "Safety-critical & hardware", icon: "check" },
      { name: "Stage-Gate", desc: "Phase-gate funnel with go / kill decisions.", meta: "5 gates", best: "Capital & new-product projects", icon: "flag" },
    ],
  },
  {
    group: "Agile",
    items: [
      { name: "Scrum", desc: "Time-boxed sprints, backlog & ceremonies.", meta: "Sprints", best: "Cross-functional product teams", default: true, icon: "sync" },
      { name: "Kanban", desc: "Continuous flow with WIP limits.", meta: "Flow", best: "Support & operations", icon: "grid" },
      { name: "Extreme Programming", desc: "Engineering rigor: TDD, pairing, CI.", meta: "Sprints", best: "High-quality codebases", icon: "zap" },
    ],
  },
  {
    group: "Scaled & Hybrid",
    items: [
      { name: "SAFe", desc: "Scaled Agile: ARTs, PIs & portfolio flow.", meta: "Program Increments", best: "Large multi-team programs", icon: "layers" },
      { name: "Scrumban", desc: "Scrum cadence with Kanban flow control.", meta: "Hybrid", best: "Maintenance + delivery", icon: "sync" },
      { name: "Disciplined Agile", desc: "Context-driven, goal-based hybrid toolkit.", meta: "Hybrid", best: "Enterprise tailoring", icon: "target" },
    ],
  },
  {
    group: "SDLC Models",
    items: [
      { name: "Iterative & Incremental", desc: "Build in repeated cycles, growing scope.", meta: "Iterations", best: "Evolving requirements", icon: "sync" },
      { name: "Spiral", desc: "Risk-driven iterations with prototyping.", meta: "Spirals", best: "High-risk R&D", icon: "target" },
      { name: "RAD", desc: "Rapid prototyping & tight feedback loops.", meta: "Prototypes", best: "Speed-to-market", icon: "zap" },
      { name: "DevOps", desc: "Continuous integration, delivery & ops.", meta: "Continuous", best: "Cloud & platform teams", icon: "sync" },
    ],
  },
];

interface ScaffoldItem { type: string; title: string }
const SCAFFOLDS: Record<string, ScaffoldItem[]> = {
  Waterfall: [
    { type: "phase", title: "Requirements — gather & sign off (BRD)" },
    { type: "phase", title: "System & software design (SDD/SAD)" },
    { type: "phase", title: "Implementation / build" },
    { type: "phase", title: "Verification — system & UAT testing" },
    { type: "phase", title: "Deployment & cutover" },
    { type: "phase", title: "Maintenance & support" },
  ],
  "V-Model": [
    { type: "phase", title: "Requirements analysis ↔ Acceptance test plan" },
    { type: "phase", title: "System design ↔ System test plan" },
    { type: "phase", title: "Architectural design ↔ Integration test plan" },
    { type: "phase", title: "Module design ↔ Unit test plan" },
    { type: "phase", title: "Coding / implementation" },
    { type: "phase", title: "Validation — unit → integration → system → acceptance" },
  ],
  "Stage-Gate": [
    { type: "gate", title: "Gate 0 — Discovery / idea screen" },
    { type: "gate", title: "Gate 1 — Scoping" },
    { type: "gate", title: "Gate 2 — Business case & build plan" },
    { type: "gate", title: "Gate 3 — Development" },
    { type: "gate", title: "Gate 4 — Testing & validation" },
    { type: "gate", title: "Gate 5 — Launch & post-launch review" },
  ],
  Scrum: [
    { type: "epic", title: "Product backlog & vision" },
    { type: "task", title: "Sprint 0 — environment & board setup" },
    { type: "task", title: "Define Definition of Done & working agreement" },
    { type: "story", title: "Sprint 1 planning & backlog refinement" },
    { type: "task", title: "Ceremonies — daily scrum, review, retrospective" },
    { type: "task", title: "Set sprint length & velocity baseline" },
  ],
  Kanban: [
    { type: "task", title: "Design the board & map the workflow" },
    { type: "task", title: "Set WIP limits per column" },
    { type: "task", title: "Define classes of service & pull policies" },
    { type: "epic", title: "Backlog intake & prioritisation" },
    { type: "task", title: "Establish cadences (replenishment, delivery)" },
    { type: "task", title: "Track flow metrics — lead & cycle time" },
  ],
  "Extreme Programming": [
    { type: "epic", title: "User stories & release plan" },
    { type: "task", title: "Set up pair programming & shared ownership" },
    { type: "task", title: "Test-Driven Development (write tests first)" },
    { type: "task", title: "Continuous integration pipeline" },
    { type: "task", title: "Small, frequent releases" },
    { type: "task", title: "Continuous refactoring & simple design" },
  ],
  SAFe: [
    { type: "epic", title: "Portfolio epics & lean business case" },
    { type: "task", title: "Form Agile Release Train & assign teams" },
    { type: "epic", title: "PI 1 objectives" },
    { type: "task", title: "PI planning event" },
    { type: "spike", title: "Architectural runway spike" },
    { type: "task", title: "System demo & Inspect & Adapt workshop" },
  ],
  Scrumban: [
    { type: "epic", title: "Backlog & board setup" },
    { type: "task", title: "Set WIP limits on the board" },
    { type: "task", title: "Order-point trigger for planning" },
    { type: "story", title: "Sprint cadence planning" },
    { type: "task", title: "Pull policy & ready queue" },
    { type: "task", title: "Reviews & flow metrics" },
  ],
  "Disciplined Agile": [
    { type: "phase", title: "Inception — align scope, stakeholders, funding" },
    { type: "task", title: "Choose Way of Working (lifecycle & practices)" },
    { type: "phase", title: "Construction — build the solution incrementally" },
    { type: "task", title: "Goal-driven process decisions" },
    { type: "phase", title: "Transition — release into production" },
    { type: "task", title: "Ongoing — guided continuous improvement" },
  ],
  "Iterative & Incremental": [
    { type: "phase", title: "Initial planning & high-level requirements" },
    { type: "iter", title: "Iteration 1 — core increment" },
    { type: "iter", title: "Iteration 2 — extend & refine" },
    { type: "task", title: "Evaluate increment with stakeholders" },
    { type: "iter", title: "Iteration N — remaining scope" },
    { type: "task", title: "Final integration & release" },
  ],
  Spiral: [
    { type: "task", title: "Cycle 1 — determine objectives & constraints" },
    { type: "spike", title: "Identify & resolve risks (prototype)" },
    { type: "task", title: "Develop & verify the deliverable" },
    { type: "task", title: "Plan the next cycle" },
    { type: "task", title: "Cycle 2 — refine with reduced risk" },
    { type: "task", title: "Release readiness review" },
  ],
  RAD: [
    { type: "phase", title: "Requirements planning workshop" },
    { type: "task", title: "User design — interactive prototyping" },
    { type: "task", title: "Rapid construction (timeboxed)" },
    { type: "task", title: "User feedback & refine prototype" },
    { type: "phase", title: "Cutover — testing, training, go-live" },
  ],
  DevOps: [
    { type: "task", title: "Continuous integration pipeline" },
    { type: "task", title: "Continuous delivery / deployment pipeline" },
    { type: "task", title: "Infrastructure as Code" },
    { type: "task", title: "Automated testing & quality gates" },
    { type: "task", title: "Monitoring & observability" },
    { type: "task", title: "Feedback loop & incident response" },
  ],
};
function scaffoldFor(name: string): ScaffoldItem[] {
  return SCAFFOLDS[name] ?? SCAFFOLDS.Scrum;
}

const INTEGRATION_OPTS = [
  { value: "jira", label: "Jira" },
  { value: "ado", label: "Azure DevOps" },
  { value: "none", label: "None (Atlas only)" },
] as const;

interface TplState { methodology: string; name: string; dept: string; owner: string; integration: string }

export default function Methodologies() {
  const [tpl, setTpl] = useState<TplState | null>(null);

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      <div style={{ background: "linear-gradient(115deg,#11163A,#0F6CBD)", borderRadius: radius.xxl, padding: "24px 26px", marginBottom: 22, color: "#fff" }}>
        <div style={{ fontFamily: font.head, fontSize: 20, fontWeight: 600, marginBottom: 5 }}>Choose how each project runs</div>
        <div style={{ fontSize: 14, color: "#C9D6EE", maxWidth: 640 }}>Apply a delivery template to a project — predictive, agile, hybrid or a classic SDLC model. Each template defines its own phases, artifacts, ceremonies and approval gates.</div>
      </div>

      {METHODOLOGY_GROUPS.map((g) => (
        <div key={g.group} style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 13 }}>{g.group}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {g.items.map((m) => (
              <div key={m.name} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: 19, position: "relative", display: "flex", flexDirection: "column" }}>
                {m.default && (
                  <span style={{ position: "absolute", top: 15, right: 15, fontSize: 10, fontWeight: 700, color: "#0B6B37", background: "#E7F4EC", padding: "3px 9px", borderRadius: 20 }}>DEFAULT</span>
                )}
                <div style={{ width: 42, height: 42, borderRadius: 11, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 13 }}>
                  <Icon name={m.icon} size={21} />
                </div>
                <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, marginBottom: 5 }}>{m.name}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: color.subtle, marginBottom: 13, flex: 1 }}>{m.desc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: color.textMuted, background: color.bg, padding: "3px 9px", borderRadius: 6 }}>{m.meta}</span>
                  <span style={{ fontSize: 11.5, color: color.faint3 }}>Best for {m.best}</span>
                </div>
                <button
                  onClick={() => setTpl({ methodology: m.name, name: "", dept: "", owner: "", integration: "jira" })}
                  style={useBtn}
                  onMouseEnter={(e) => { e.currentTarget.style.background = color.primary; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = color.primary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = color.primary; e.currentTarget.style.borderColor = "#CFE0F4"; }}
                >Use template</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {tpl && <TemplateWizard tpl={tpl} setTpl={setTpl} onClose={() => setTpl(null)} />}
    </div>
  );
}

interface Created { name: string; methodology: string; dept: string; owner: string; integration: string | null; items: { title: string; ext: string | null; pushed: boolean }[] }

interface CreatedProject { id: string; name: string }
interface NewProject { name: string; dept: string; owner: string; methodology: string; applyTemplate: boolean }

function TemplateWizard({ tpl, setTpl, onClose }: { tpl: TplState; setTpl: (t: TplState) => void; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [created, setCreated] = useState<Created | null>(null);
  const scaffold = scaffoldFor(tpl.methodology);
  const qc = useQueryClient();
  const { can } = usePermissions();
  const mayCreate = can("cap-projects", "F");

  const createProject = useMutation({
    mutationFn: (body: NewProject) => api<CreatedProject>("/projects", { method: "POST", body: JSON.stringify(body) }),
  });

  const create = () => {
    const body: NewProject = { name: tpl.name.trim(), dept: tpl.dept.trim(), owner: tpl.owner.trim(), methodology: tpl.methodology, applyTemplate: true };
    createProject.mutate(body, {
      onSuccess: (project) => {
        qc.invalidateQueries({ queryKey: ["projects"] });
        if (project?.id) {
          // The scaffold was materialised server-side; refresh those views.
          qc.invalidateQueries({ queryKey: ["tasks", project.id] });
          qc.invalidateQueries({ queryKey: ["epics", project.id] });
          qc.invalidateQueries({ queryKey: ["gates", project.id] });
        }
        const sys = tpl.integration === "jira" ? "Jira" : tpl.integration === "ado" ? "Azure DevOps" : null;
        const prefix = tpl.integration === "jira" ? "BILT" : "ADO";
        setCreated({
          name: project?.name || tpl.name.trim(), methodology: tpl.methodology, dept: tpl.dept || "—", owner: tpl.owner || "Unassigned", integration: sys,
          items: scaffold.map((it, i) => ({ title: it.title, ext: sys ? (i === 0 && project?.id ? project.id : `${prefix}-${1024 + i}`) : null, pushed: !!sys && i === 0 })),
        });
        setStep(3);
      },
    });
  };

  return (
    <Overlay onClose={onClose} width={580}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #EEF1F6" }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <Icon name="template" size={18} />
        </span>
        <div style={{ flex: 1, fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>New project from {tpl.methodology} template</div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${color.border3}`, background: "#fff", color: "#56607A", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Icon name="x" size={16} />
        </button>
      </div>

      {step === 1 && (
        <div>
          <label style={lbl}>Project name</label>
          <Input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} placeholder="e.g. Customer Portal Rebuild" style={{ fontSize: 13.5, marginBottom: 14 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Division</label>
              <Input value={tpl.dept} onChange={(e) => setTpl({ ...tpl, dept: e.target.value })} placeholder="Department" />
            </div>
            <div>
              <label style={lbl}>Owner</label>
              <Input value={tpl.owner} onChange={(e) => setTpl({ ...tpl, owner: e.target.value })} placeholder="Project lead" />
            </div>
          </div>

          {/* Template preview — shown as soon as a methodology is selected, so the
              coherent, methodology-specific steps are visible before naming. */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12.5, color: color.subtle, marginBottom: 9 }}>The <b style={{ color: color.text }}>{tpl.methodology}</b> template will scaffold these work items:</div>
            <div style={{ border: "1px solid #EEF1F6", borderRadius: 11, overflow: "hidden" }}>
              {scaffold.map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", borderBottom: i < scaffold.length - 1 ? "1px solid #F4F6FA" : "none" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#566077", background: color.bg, padding: "2px 7px", borderRadius: 5, minWidth: 38, textAlign: "center" }}>{it.type}</span>
                  <span style={{ flex: 1, fontSize: 13, color: color.text }}>{it.title}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
            <Button variant="secondary" onClick={onClose} style={{ padding: "10px 16px" }}>Cancel</Button>
            <Button onClick={() => { if (tpl.name.trim()) setStep(2); }} style={{ padding: "10px 18px" }}>Next: scaffold</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ fontSize: 12.5, color: color.subtle, marginBottom: 11 }}>These work items will be created from the <b style={{ color: color.text }}>{tpl.methodology}</b> template:</div>
          <div style={{ border: "1px solid #EEF1F6", borderRadius: 11, overflow: "hidden", marginBottom: 18 }}>
            {scaffold.map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderBottom: "1px solid #F4F6FA" }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#566077", background: color.bg, padding: "2px 7px", borderRadius: 5, width: 38, textAlign: "center" }}>{it.type}</span>
                <span style={{ flex: 1, fontSize: 13, color: color.text }}>{it.title}</span>
                {i === 0 && <span style={{ fontSize: 10.5, fontWeight: 600, color: color.primaryDark }}>↗ pushed to tracker</span>}
              </div>
            ))}
          </div>
          <label style={lbl}>Create issues in</label>
          <Select value={tpl.integration} onChange={(e) => setTpl({ ...tpl, integration: e.target.value })}>
            {INTEGRATION_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <div style={{ fontSize: 11.5, color: color.faint3, marginTop: 7 }}>The first work item is pushed to the connector now; the rest sync on the next cycle.</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 9, marginTop: 20 }}>
            <Button variant="secondary" onClick={() => setStep(1)} style={{ padding: "10px 16px" }}>Back</Button>
            <Button onClick={create} disabled={createProject.isPending || !mayCreate} title={mayCreate ? undefined : "Your role can't create projects"} style={{ padding: "10px 18px", background: color.success }}>{createProject.isPending ? "Creating…" : "Create project"}</Button>
          </div>
        </div>
      )}

      {step === 3 && created && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ width: 42, height: 42, borderRadius: "50%", background: "#E7F4EC", color: "#0B6B37", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Icon name="check" size={20} />
            </span>
            <div>
              <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.ink }}>{created.name} created</div>
              <div style={{ fontSize: 12.5, color: color.faint2 }}>{created.methodology} · {created.dept} · {created.owner}</div>
            </div>
          </div>
          <div style={{ border: "1px solid #EEF1F6", borderRadius: 11, overflow: "hidden" }}>
            {created.items.map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderBottom: "1px solid #F4F6FA" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C7CEDB" }} />
                <span style={{ flex: 1, fontSize: 13, color: color.text }}>{it.title}</span>
                {it.pushed && <span style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 700, color: color.primaryDark, background: color.primaryTint2, padding: "2px 8px", borderRadius: 5 }}>{it.ext} ↗</span>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <Button onClick={onClose} style={{ padding: "10px 18px" }}>Done</Button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", marginBottom: 5 };
const useBtn: React.CSSProperties = { width: "100%", fontSize: 13, fontWeight: 600, color: color.primary, background: "#fff", border: "1px solid #CFE0F4", padding: 9, borderRadius: 9, cursor: "pointer", fontFamily: "inherit" };
