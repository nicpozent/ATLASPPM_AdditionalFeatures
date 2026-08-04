using Microsoft.EntityFrameworkCore;

namespace Atlas.Api.Governance;

// ============================================================================
//  Deterministic risk engine + status report. Rules run over the project's real
//  data (budget, tasks, quality, dependencies, gates, security, architecture)
//  and each finding cites the standard/control it maps to: ISO 27001, ISO 42001,
//  GDPR, PCI-DSS, NIST CSF, SOC 2, NIS2, MITRE ATT&CK, or PMO/ITIL governance.
//  A generic coverage pass additionally scores *any* framework the project has
//  logged controls under, so new frameworks map without a bespoke rule. No LLM —
//  every finding is reproducible and auditable. (Zero-Trust posture — how these
//  controls map to the ZT tenets — is documented in ADR-0049.)
// ============================================================================
public static class Risks
{
    static int Sev(string s) => s == "High" ? 3 : s == "Medium" ? 2 : 1;

    // Adversary technique classes surfaced for an architecture-significant change
    // (deterministic, keyed off the change type) — turns the MITRE ATT&CK finding
    // from a generic note into named tactic/technique references.
    static readonly Dictionary<string, string> AttackTechniques = new()
    {
        ["payment"]          = "Credential Access (T1552 unsecured credentials), Collection (T1005)",
        ["cloud-platform"]   = "Initial Access (T1190 exploit public-facing app), Valid Accounts (T1078)",
        ["new-saas"]         = "Initial Access (T1190), Persistence (T1098 account manipulation)",
        ["ai-solution"]      = "Supply-chain compromise (T1195), data/model poisoning; Initial Access (T1190)",
        ["new-product"]      = "Initial Access (T1190), Brute Force (T1110)",
        ["core-replacement"] = "Lateral Movement (T1210), OS Credential Dumping (T1003)",
    };

    // Runs the rule set and returns findings ordered most-severe first.
    static async Task<List<RiskFindingDto>> EvaluateAsync(AtlasDbContext db, string id)
    {
        var f = new List<RiskFindingDto>();
        var p = await db.Projects.FirstAsync(x => x.Id == id);

        // ---- Budget / schedule (PMO governance) ----------------------------
        if (p.Spent > p.Budget && p.Budget > 0)
            f.Add(new("High", "Budget", "Budget overrun",
                $"Spent €{p.Spent:N0}k of €{p.Budget:N0}k ({p.Spent / p.Budget * 100:N0}%).", "PMO governance", "Cost baseline control"));
        else if (p.Forecast > p.Budget && p.Budget > 0)
            f.Add(new("Medium", "Budget", "Forecast over budget",
                $"Forecast at completion €{p.Forecast:N0}k exceeds the €{p.Budget:N0}k baseline.", "PMO governance", "Cost baseline control"));

        var tasks = await db.ProjectTasks.Where(t => t.ProjectId == id).ToListAsync();
        var blocked = tasks.Count(t => t.Status == "Blocked");
        if (blocked > 0)
            f.Add(new(blocked >= 3 ? "High" : "Medium", "Delivery", $"{blocked} blocked task{(blocked > 1 ? "s" : "")}",
                "Blocked work items are impeding the sprint.", "PMO governance", "Impediment management"));
        var spill = tasks.Count(t => !string.IsNullOrEmpty(t.Baseline) && !string.IsNullOrEmpty(t.Sprint) && t.Baseline != t.Sprint);
        if (spill > 0)
            f.Add(new("Medium", "Schedule", $"{spill} task{(spill > 1 ? "s" : "")} slipped the baseline sprint",
                "Scope has carried over from its baselined sprint (spillover).", "PMO governance", "Schedule baseline"));

        // ---- Operational impact (ITIL / change & incident management) ------
        var ops = await db.OperationalItems.Where(o => o.ProjectId == id && (o.Status == "Open" || o.Status == "In progress")).ToListAsync();
        var opsCrit = ops.Count(o => o.Severity is "Critical" or "High");
        if (opsCrit > 0)
            f.Add(new(ops.Any(o => o.Severity == "Critical") ? "High" : "Medium", "Operational",
                $"{opsCrit} operational item{(opsCrit > 1 ? "s" : "")} impacting delivery",
                "Active incidents/changes/maintenance affecting this project can cause delivery deviations.",
                "ITIL / PMO governance", "Incident & change management"));
        else if (ops.Count > 0)
            f.Add(new("Low", "Operational", $"{ops.Count} open operational item{(ops.Count > 1 ? "s" : "")}",
                "Operational work is linked to this project; monitor for delivery impact.",
                "ITIL / PMO governance", "Incident & change management"));

        // ---- Resource capacity (assigned team over-allocated) --------------
        var over = await Capacity.OverAllocatedAsync(db, id);
        if (over.Count > 0)
            f.Add(new(over.Count >= 2 ? "High" : "Medium", "Resource",
                $"{over.Count} assigned team member{(over.Count > 1 ? "s" : "")} over-allocated",
                $"{string.Join(", ", over)} {(over.Count > 1 ? "are" : "is")} over 100% allocated (operations + project + product); delivery capacity is at risk.",
                "PMO governance", "Resource capacity management"));

        // Inherited dependency risk
        var deps = await db.ProjectDependencies.Where(d => d.ProjectId == id).Select(d => d.DependsOnId).ToListAsync();
        if (deps.Count > 0)
        {
            var red = await db.Projects.Where(x => deps.Contains(x.Id) && x.Status == "red").Select(x => x.Name).FirstOrDefaultAsync();
            if (red is not null)
                f.Add(new("High", "Dependency", "Inherited risk from a dependency",
                    $"Upstream dependency “{red}” is red; effective health is degraded.", "PMO governance", "Dependency management"));
        }

        // Gates
        var gates = await db.Gates.Where(g => g.ProjectId == id).ToListAsync();
        foreach (var g in gates.Where(g => g.Status == "Rejected"))
            f.Add(new("High", "Governance", $"Stage gate {g.Code} rejected",
                $"{g.Name} was rejected and needs rework before proceeding.", "PMO governance", "Stage-gate control"));

        // ---- Quality -------------------------------------------------------
        var defects = await db.Defects.Where(d => d.ProjectId == id).ToListAsync();
        var critOpen = defects.Count(d => d.Severity == "Critical" && d.Status is "Open" or "In progress");
        if (critOpen > 0)
            f.Add(new("High", "Quality", $"{critOpen} critical defect{(critOpen > 1 ? "s" : "")} open",
                "Unresolved critical defects threaten release quality.", "PMO governance", "Defect management"));
        var plansFailed = (await db.TestPlans.Where(t => t.ProjectId == id).ToListAsync()).Sum(t => t.Failed);
        if (plansFailed > 0)
            f.Add(new("Medium", "Quality", $"{plansFailed} failed test case{(plansFailed > 1 ? "s" : "")}",
                "Failing tests indicate unmet requirements.", "PMO governance", "Verification & validation"));

        // ---- Security / privacy / compliance -------------------------------
        var sec = await db.SecurityProfiles.FindAsync(id);
        var controls = await db.SecurityControls.Where(c => c.ProjectId == id).ToListAsync();
        bool Implemented(string fw) => controls.Any(c => c.Framework == fw && c.Status == "Implemented");
        if (sec is not null)
        {
            var dpiaRequired = sec.SpecialCategory || sec.AutomatedDecisions || sec.Classification == "Restricted";
            if (dpiaRequired && !Implemented("GDPR"))
                f.Add(new("High", "Privacy", "DPIA required but not evidenced",
                    "Special-category/automated processing triggers a mandatory DPIA with no GDPR control implemented.", "GDPR", "Art. 35 — Data protection impact assessment"));
            else if ((sec.PersonalData || sec.CardholderData) && !Implemented("GDPR"))
                f.Add(new("Medium", "Privacy", "Personal data without evidenced safeguards",
                    "Personal/cardholder data is processed but no GDPR control is marked Implemented.", "GDPR", "Art. 32 — Security of processing"));

            if (sec.CardholderData && !Implemented("PCI-DSS"))
                f.Add(new("High", "Security", "Cardholder data without PCI control",
                    "Cardholder data is in scope but no PCI-DSS control is Implemented.", "PCI-DSS", "Req 3 — Protect stored account data"));

            if (sec.Iso)
            {
                var weak = controls.Count(c => c.Framework == "ISO 27001" && c.Status != "Implemented");
                if (weak > 0 || !controls.Any(c => c.Framework == "ISO 27001"))
                    f.Add(new("Medium", "Security", "ISMS controls not fully implemented",
                        "ISO 27001 is in scope with missing or partial Annex A controls.", "ISO 27001", "A.5 / A.8 — Organisational & technological controls"));
            }

            // ---- EU AI Act risk-tiering + ISO 42001 AI management (ADR-0050) ---
            // Obligations are derived deterministically from the declared risk
            // tier (Annex III implies high-risk); an in-scope-but-unclassified AI
            // system is itself flagged so it gets triaged.
            var aiInScope = sec.AiAct || sec.AutomatedDecisions || sec.AiAnnexIii || !string.IsNullOrEmpty(sec.AiRiskTier);
            if (aiInScope)
            {
                var tier = string.IsNullOrEmpty(sec.AiRiskTier) && sec.AiAnnexIii ? "high" : sec.AiRiskTier;
                var aiControl = controls.Any(c => (c.Framework == "ISO 42001" || c.Control.Contains("AI") || c.Control.Contains("model")) && c.Status == "Implemented");
                if (tier == "prohibited")
                    f.Add(new("High", "AI governance", "Prohibited AI practice in scope",
                        "Classified as a prohibited practice under EU AI Act Art. 5 — it must not be placed on the EU market.", "EU AI Act", "Art. 5 — Prohibited AI practices"));
                else if (tier == "high")
                {
                    if (!sec.AiHumanOversight)
                        f.Add(new("High", "AI governance", "High-risk AI without human oversight",
                            "A high-risk AI system (Annex III) requires effective human oversight under Art. 14, which is not evidenced.", "EU AI Act", "Art. 14 — Human oversight"));
                    if (!aiControl)
                        f.Add(new("Medium", "AI governance", "High-risk AI management controls incomplete",
                            "A high-risk AI system needs a risk-management system (Art. 9) and data governance (Art. 10); no AI-management (ISO 42001) control is Implemented.", "ISO 42001", "Clause 6 — AI risk management & data governance"));
                }
                else if (tier == "limited")
                {
                    if (!sec.AiTransparency)
                        f.Add(new("Low", "AI governance", "AI transparency obligation unmet",
                            "Limited-risk AI must tell users they are interacting with an AI system (Art. 50); no transparency measure is recorded.", "EU AI Act", "Art. 50 — Transparency obligations"));
                }
                else if (string.IsNullOrEmpty(tier))
                    f.Add(new("Medium", "AI governance", "AI system not risk-classified",
                        "The initiative involves AI/automated decisions but has no EU AI Act risk tier set; classify it (minimal/limited/high/prohibited) to derive its obligations.", "EU AI Act", "Art. 6 — Classification rules for AI systems"));
            }

            // Threat-model coverage → MITRE ATT&CK (advisory)
            var arch = await db.ArchProfiles.FindAsync(id);
            var archSignificant = arch is not null && new[] { "new-product", "core-replacement", "payment", "cloud-platform", "new-saas", "ai-solution" }.Contains(arch.ChangeType);
            if (archSignificant && !controls.Any(c => c.Control.Contains("crypto") || c.Framework == "ISO 27001" && c.Status == "Implemented"))
                f.Add(new("Medium", "Threat model", "Threat-model coverage gap",
                    "Architecture-significant change without evidenced security controls; adversary techniques are unmitigated.",
                    "MITRE ATT&CK", $"Unmitigated technique classes — {AttackTechniques.GetValueOrDefault(arch!.ChangeType, "Initial Access / Credential Access")}"));
        }

        // ---- Generic framework coverage ------------------------------------
        // For every framework the project has logged controls under, score
        // implementation. This gives NIST CSF, SOC 2, NIS2, ISO 42001 (and any
        // future framework) a deterministic finding without a bespoke rule.
        // Skips a framework a specific rule above already reported, and any
        // fully-implemented framework.
        foreach (var fw in controls.Select(c => c.Framework).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct())
        {
            if (f.Any(x => x.Framework == fw)) continue;
            var fwControls = controls.Where(c => c.Framework == fw && c.Status != "Archived").ToList();
            if (fwControls.Count == 0) continue;
            var impl = fwControls.Count(c => c.Status == "Implemented");
            if (impl == fwControls.Count) continue;
            f.Add(new(impl == 0 ? "Medium" : "Low", "Compliance",
                $"{fw}: {impl}/{fwControls.Count} controls implemented",
                impl == 0 ? "Controls are logged for this framework but none are marked Implemented."
                          : "Some controls for this framework are still Planned or Partial.",
                fw, "Control implementation coverage"));
        }

        return f.OrderByDescending(x => Sev(x.Severity)).ToList();
    }

    public static void MapRiskEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects/{id}/risks", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.DenyRead(http, db, cfg,
                () => db.Projects.AnyAsync(p => p.Id == id && p.StakeholderVisible && !p.Archived)) is { } deny) return deny;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var findings = await EvaluateAsync(db, id);
            return Results.Ok(new RiskReportDto(
                findings.Count(x => x.Severity == "High"), findings.Count(x => x.Severity == "Medium"),
                findings.Count(x => x.Severity == "Low"), findings));
        });

        api.MapGet("/projects/{id}/status-report", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.DenyRead(http, db, cfg,
                () => db.Projects.AnyAsync(x => x.Id == id && x.StakeholderVisible && !x.Archived)) is { } deny) return deny;
            var p = await db.Projects.FirstOrDefaultAsync(x => x.Id == id);
            if (p is null) return Results.NotFound();
            var tasks = await db.ProjectTasks.Where(t => t.ProjectId == id).ToListAsync();
            var defects = await db.Defects.Where(d => d.ProjectId == id).ToListAsync();
            var plans = await db.TestPlans.Where(t => t.ProjectId == id).ToListAsync();
            var gates = await db.Gates.Where(g => g.ProjectId == id).ToListAsync();
            var sec = await db.SecurityProfiles.FindAsync(id);
            var findings = await EvaluateAsync(db, id);

            var done = tasks.Count(t => t.Status == "Done");
            var blocked = tasks.Count(t => t.Status == "Blocked");
            var spill = tasks.Count(t => !string.IsNullOrEmpty(t.Baseline) && !string.IsNullOrEmpty(t.Sprint) && t.Baseline != t.Sprint);
            var executed = plans.Sum(t => t.Passed + t.Failed + t.Blocked);
            var passRate = executed == 0 ? 0 : (int)Math.Round(100.0 * plans.Sum(t => t.Passed) / executed);
            var openDefects = defects.Count(d => d.Status is "Open" or "In progress");
            var dpia = sec is null ? "Not assessed"
                : (sec.SpecialCategory || sec.AutomatedDecisions || sec.Classification == "Restricted") ? "Required"
                : (sec.PersonalData || sec.CardholderData) ? "Recommended" : "Not required";

            var highlights = new List<string>
            {
                $"Health {p.Health}; {p.Progress}% complete in {p.Phase}.",
                $"Budget €{p.Spent:N0}k spent of €{p.Budget:N0}k" + (p.Budget > 0 ? $" ({p.Spent / p.Budget * 100:N0}%)." : "."),
                $"Delivery: {done}/{tasks.Count} tasks done, {blocked} blocked, {spill} spilled over.",
                $"Quality: {passRate}% pass rate, {openDefects} open defect(s).",
                $"Governance: {gates.Count(g => g.Status == "Approved")}/{gates.Count} gates approved; DPIA {dpia}.",
            };

            return Results.Ok(new StatusReportDto(p.Name, p.Phase, p.Health, p.Progress,
                $"€{p.Spent:N0}k / €{p.Budget:N0}k", done, tasks.Count, blocked, spill, passRate, openDefects,
                gates.Count(g => g.Status == "Approved"), gates.Count, dpia, highlights, findings.Take(5).ToList()));
        });
    }
}
