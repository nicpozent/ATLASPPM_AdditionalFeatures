using Microsoft.EntityFrameworkCore;

namespace Atlas.Api;

public record SetSoaEntryReq(bool? Applicable, string? Justification, string? Status, string? Owner);

// ============================================================================
//  Statement of Applicability (ISO 27001:2022 Clause 6.1.3 d / Annex A).
//  The SoA is the ISMS's mandatory record: for EVERY Annex A control it states
//  whether the control is applicable, the justification for inclusion/exclusion,
//  and its implementation status. Here it is per-project (each initiative states
//  its own applicability) and sits beside the existing control-evidence register
//  and review gates on Project → Security.
//
//  The 93-control Annex A catalogue is static reference data (Catalogue below) —
//  it is the standard, not user data — so it needs no table or seed. Only a
//  project's *decision* per control (applicable? why? status, owner) is persisted
//  (SoaEntry). An absent row means the SoA baseline: applicable, "Not started".
//  This gives full control coverage automatically (all 93 rows are always
//  present in the SoA), rather than only the ad-hoc controls someone typed in.
//
//  Authorization mirrors the rest of the Security tab: reads are open to any
//  authenticated caller; editing a decision needs Edit on "Approve demands &
//  gates" (cap-approve) and is audited.
// ============================================================================
public static class Soa
{
    static readonly string[] Statuses = { "Not started", "Planned", "Partial", "Implemented" };

    public record Control(string Ref, string Title, string Theme);

    // ISO 27001:2022 Annex A — 93 controls across 4 themes.
    public static readonly Control[] Catalogue = Build();

    static Control[] Build()
    {
        var list = new List<Control>();
        void T(string theme, params (string Ref, string Title)[] rows)
        { foreach (var r in rows) list.Add(new Control(r.Ref, r.Title, theme)); }

        T("Organizational",
            ("A.5.1", "Policies for information security"),
            ("A.5.2", "Information security roles and responsibilities"),
            ("A.5.3", "Segregation of duties"),
            ("A.5.4", "Management responsibilities"),
            ("A.5.5", "Contact with authorities"),
            ("A.5.6", "Contact with special interest groups"),
            ("A.5.7", "Threat intelligence"),
            ("A.5.8", "Information security in project management"),
            ("A.5.9", "Inventory of information and other associated assets"),
            ("A.5.10", "Acceptable use of information and other associated assets"),
            ("A.5.11", "Return of assets"),
            ("A.5.12", "Classification of information"),
            ("A.5.13", "Labelling of information"),
            ("A.5.14", "Information transfer"),
            ("A.5.15", "Access control"),
            ("A.5.16", "Identity management"),
            ("A.5.17", "Authentication information"),
            ("A.5.18", "Access rights"),
            ("A.5.19", "Information security in supplier relationships"),
            ("A.5.20", "Addressing information security within supplier agreements"),
            ("A.5.21", "Managing information security in the ICT supply chain"),
            ("A.5.22", "Monitoring, review and change management of supplier services"),
            ("A.5.23", "Information security for use of cloud services"),
            ("A.5.24", "Information security incident management planning and preparation"),
            ("A.5.25", "Assessment and decision on information security events"),
            ("A.5.26", "Response to information security incidents"),
            ("A.5.27", "Learning from information security incidents"),
            ("A.5.28", "Collection of evidence"),
            ("A.5.29", "Information security during disruption"),
            ("A.5.30", "ICT readiness for business continuity"),
            ("A.5.31", "Legal, statutory, regulatory and contractual requirements"),
            ("A.5.32", "Intellectual property rights"),
            ("A.5.33", "Protection of records"),
            ("A.5.34", "Privacy and protection of PII"),
            ("A.5.35", "Independent review of information security"),
            ("A.5.36", "Compliance with policies, rules and standards for information security"),
            ("A.5.37", "Documented operating procedures"));

        T("People",
            ("A.6.1", "Screening"),
            ("A.6.2", "Terms and conditions of employment"),
            ("A.6.3", "Information security awareness, education and training"),
            ("A.6.4", "Disciplinary process"),
            ("A.6.5", "Responsibilities after termination or change of employment"),
            ("A.6.6", "Confidentiality or non-disclosure agreements"),
            ("A.6.7", "Remote working"),
            ("A.6.8", "Information security event reporting"));

        T("Physical",
            ("A.7.1", "Physical security perimeters"),
            ("A.7.2", "Physical entry"),
            ("A.7.3", "Securing offices, rooms and facilities"),
            ("A.7.4", "Physical security monitoring"),
            ("A.7.5", "Protecting against physical and environmental threats"),
            ("A.7.6", "Working in secure areas"),
            ("A.7.7", "Clear desk and clear screen"),
            ("A.7.8", "Equipment siting and protection"),
            ("A.7.9", "Security of assets off-premises"),
            ("A.7.10", "Storage media"),
            ("A.7.11", "Supporting utilities"),
            ("A.7.12", "Cabling security"),
            ("A.7.13", "Equipment maintenance"),
            ("A.7.14", "Secure disposal or re-use of equipment"));

        T("Technological",
            ("A.8.1", "User endpoint devices"),
            ("A.8.2", "Privileged access rights"),
            ("A.8.3", "Information access restriction"),
            ("A.8.4", "Access to source code"),
            ("A.8.5", "Secure authentication"),
            ("A.8.6", "Capacity management"),
            ("A.8.7", "Protection against malware"),
            ("A.8.8", "Management of technical vulnerabilities"),
            ("A.8.9", "Configuration management"),
            ("A.8.10", "Information deletion"),
            ("A.8.11", "Data masking"),
            ("A.8.12", "Data leakage prevention"),
            ("A.8.13", "Information backup"),
            ("A.8.14", "Redundancy of information processing facilities"),
            ("A.8.15", "Logging"),
            ("A.8.16", "Monitoring activities"),
            ("A.8.17", "Clock synchronization"),
            ("A.8.18", "Use of privileged utility programs"),
            ("A.8.19", "Installation of software on operational systems"),
            ("A.8.20", "Networks security"),
            ("A.8.21", "Security of network services"),
            ("A.8.22", "Segregation of networks"),
            ("A.8.23", "Web filtering"),
            ("A.8.24", "Use of cryptography"),
            ("A.8.25", "Secure development life cycle"),
            ("A.8.26", "Application security requirements"),
            ("A.8.27", "Secure system architecture and engineering principles"),
            ("A.8.28", "Secure coding"),
            ("A.8.29", "Security testing in development and acceptance"),
            ("A.8.30", "Outsourced development"),
            ("A.8.31", "Separation of development, test and production environments"),
            ("A.8.32", "Change management"),
            ("A.8.33", "Test information"),
            ("A.8.34", "Protection of information systems during audit testing"));

        return list.ToArray();
    }

    static readonly Dictionary<string, string> CatalogueRefs =
        Catalogue.ToDictionary(c => c.Ref, c => c.Title);

    public static void MapSoaEndpoints(this RouteGroupBuilder api)
    {
        // Full Statement of Applicability for a project: every Annex A control,
        // merged with the project's decisions, grouped by theme, plus a coverage
        // roll-up. This gives complete control coverage by construction.
        api.MapGet("/projects/{id}/soa", async (string id, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            var canEdit = await Permissions.Allows(http, db, cfg, "cap-approve", "E");
            var entries = (await db.SoaEntries.Where(e => e.ProjectId == id).ToListAsync())
                .ToDictionary(e => e.Ref);

            var rows = Catalogue.Select(c =>
            {
                var e = entries.GetValueOrDefault(c.Ref);
                return new SoaControlDto(c.Ref, c.Title, c.Theme,
                    e?.Applicable ?? true,
                    e?.Justification ?? "",
                    e?.Status ?? "Not started",
                    e?.Owner ?? "");
            }).ToList();

            var applicable = rows.Count(r => r.Applicable);
            var implemented = rows.Count(r => r.Applicable && r.Status == "Implemented");
            var reviewed = rows.Count(r => entries.ContainsKey(r.Ref));
            var coverage = new SoaCoverageDto(
                Catalogue.Length, applicable, Catalogue.Length - applicable,
                implemented, reviewed,
                applicable == 0 ? 100 : (int)Math.Round(100.0 * implemented / applicable));

            return Results.Ok(new SoaDto(canEdit, coverage, rows));
        });

        // Record/replace a single control's SoA decision (upsert by ref).
        api.MapPut("/projects/{id}/soa/{ctlRef}", async (string id, string ctlRef, SetSoaEntryReq req, AtlasDbContext db, IConfiguration cfg, HttpContext http) =>
        {
            if (await Permissions.Deny(http, db, cfg, "cap-approve", "E") is { } denied) return denied;
            if (!await db.Projects.AnyAsync(p => p.Id == id)) return Results.NotFound();
            if (!CatalogueRefs.ContainsKey(ctlRef)) return Results.BadRequest(new { error = "Unknown Annex A control." });
            if (req.Status is not null && !Statuses.Contains(req.Status)) return Results.BadRequest(new { error = "Unknown status." });

            var e = await db.SoaEntries.FirstOrDefaultAsync(x => x.ProjectId == id && x.Ref == ctlRef);
            if (e is null)
            {
                e = new SoaEntry { ProjectId = id, Ref = ctlRef };
                db.SoaEntries.Add(e);
            }
            if (req.Applicable is { } ap) e.Applicable = ap;
            if (req.Justification is not null) e.Justification = req.Justification.Trim();
            if (req.Status is not null) e.Status = req.Status;
            if (req.Owner is not null) e.Owner = req.Owner.Trim();
            // An excluded control with no stated reason is an audit finding waiting
            // to happen — keep it permissible but recorded.
            db.AuditEvents.Add(Permissions.Audit(http, cfg, "Security",
                $"SoA {(e.Applicable ? "applicable" : "excluded")} · {ctlRef}",
                $"{id} · {CatalogueRefs[ctlRef]} → {e.Status}"));
            await db.SaveChangesAsync();
            return Results.Ok(new SoaControlDto(e.Ref, CatalogueRefs[e.Ref],
                Catalogue.First(c => c.Ref == e.Ref).Theme, e.Applicable, e.Justification, e.Status, e.Owner));
        });
    }
}
