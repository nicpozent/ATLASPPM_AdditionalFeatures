using System.Reflection;
using Mono.Cecil;
using NetArchTest.Rules;
using Xunit;

namespace Atlas.Tests;

// ============================================================================
//  Architecture boundary enforcement (ADR-0072).
//
//  The API is a modular monolith. Domain modules live in per-domain namespaces
//  Atlas.Api.<Domain>; the shared kernel (entities, DTOs, DbContext, RBAC) and
//  the composition root (Program/Endpoints/WriteEndpoints) stay in the root
//  Atlas.Api namespace, which every module may use.
//
//  These tests enforce the boundaries at the IL level so cross-module coupling
//  cannot creep in unnoticed. The analysis is Mono.Cecil-based and resolves
//  compiler-generated nested types (async state machines, closures) to their
//  declaring type's namespace — NetArchTest's own scan misses those, so the
//  ratchet below is the authoritative guard.
// ============================================================================
public class ArchitectureTests
{
    static readonly string[] Domains =
    {
        "Comms","Delivery","Finance","Governance","Integrations",
        "Operations","People","Platform","Portfolio",
    };

    // The APPROVED module dependency graph (source -> allowed targets), captured
    // from the codebase as of ADR-0072. This is a ratchet: a module may depend on
    // the shared kernel freely, but a NEW edge between domains fails this test —
    // forcing a conscious decision (extend the map, or route via the kernel).
    //
    // KNOWN CYCLES (tech debt, tracked in ADR-0072 for later decoupling):
    //   People <-> Comms      (notifications raised from capacity logic)
    //   People <-> Operations (ops load feeds the resource roster)
    static readonly Dictionary<string, string[]> Allowed = new()
    {
        ["Comms"]        = new[] { "People" },
        ["Delivery"]     = new[] { "Comms", "Integrations", "People", "Platform" },
        ["Finance"]      = new string[0],
        ["Governance"]   = new[] { "Comms", "Integrations", "People" },
        ["Integrations"] = new string[0],
        ["Operations"]   = new[] { "People" },
        ["People"]       = new[] { "Comms", "Operations" },
        ["Platform"]     = new string[0],
        ["Portfolio"]    = new string[0],
    };

    // Modules that must stay self-contained: they may use the shared kernel but
    // no other domain module. Integrations are driven adapters (Jira/ADO) that
    // must not reach up into business modules; Finance/Portfolio/Platform are
    // leaves today and we keep them that way.
    static readonly string[] CleanModules = { "Finance", "Integrations", "Platform", "Portfolio" };

    static string NsOf(TypeReference tr)
    {
        var t = tr;
        while (t.DeclaringType != null) t = t.DeclaringType;
        return t.Namespace ?? "";
    }

    static string? DomainOf(string ns)
    {
        foreach (var d in Domains)
            if (ns == $"Atlas.Api.{d}" || ns.StartsWith($"Atlas.Api.{d}."))
                return d;
        return null; // root / shared kernel
    }

    // Compute the actual domain -> domain dependency edges from the compiled API.
    static Dictionary<string, HashSet<string>> ComputeEdges()
    {
        var asmPath = typeof(Atlas.Api.AtlasDbContext).Assembly.Location;
        var module = ModuleDefinition.ReadModule(asmPath);
        var edges = Domains.ToDictionary(d => d, _ => new HashSet<string>());

        foreach (var t in module.GetTypes())
        {
            var src = DomainOf(NsOf(t));
            if (src is null) continue;

            void Note(TypeReference? target)
            {
                if (target is null) return;
                var td = DomainOf(NsOf(target));
                if (td is not null && td != src) edges[src].Add(td);
            }

            Note(t.BaseType);
            foreach (var i in t.Interfaces) Note(i.InterfaceType);
            foreach (var f in t.Fields) Note(f.FieldType);
            foreach (var m in t.Methods)
            {
                Note(m.ReturnType);
                foreach (var p in m.Parameters) Note(p.ParameterType);
                if (!m.HasBody) continue;
                foreach (var v in m.Body.Variables) Note(v.VariableType);
                foreach (var ins in m.Body.Instructions)
                {
                    switch (ins.Operand)
                    {
                        case MethodReference mr: Note(mr.DeclaringType); break;
                        case FieldReference fr: Note(fr.DeclaringType); break;
                        case TypeReference tr: Note(tr); break;
                    }
                }
            }
        }
        return edges;
    }

    [Fact]
    public void Module_dependencies_stay_within_the_approved_graph()
    {
        var edges = ComputeEdges();
        var violations = new List<string>();
        foreach (var (src, targets) in edges)
        {
            var allowed = Allowed[src];
            foreach (var t in targets.OrderBy(x => x))
                if (!allowed.Contains(t))
                    violations.Add($"  {src} -> {t}");
        }

        Assert.True(violations.Count == 0,
            "New cross-module dependency introduced. Route it via the shared kernel " +
            "or, if deliberate, add the edge to ArchitectureTests.Allowed (and ADR-0072):\n"
            + string.Join("\n", violations));
    }

    [Fact]
    public void Clean_modules_depend_on_no_other_domain_module()
    {
        var edges = ComputeEdges();
        var violations = CleanModules
            .SelectMany(m => edges[m].OrderBy(x => x).Select(t => $"  {m} -> {t}"))
            .ToList();

        Assert.True(violations.Count == 0,
            "A self-contained module gained a dependency on another domain:\n"
            + string.Join("\n", violations));
    }

    [Fact]
    public void No_new_dependency_cycles_between_modules()
    {
        var edges = ComputeEdges();
        var known = new HashSet<string> { "Comms|People", "Operations|People" };
        var cycles = new List<string>();
        foreach (var (a, targets) in edges)
            foreach (var b in targets)
                if (edges.TryGetValue(b, out var back) && back.Contains(a))
                {
                    var key = string.CompareOrdinal(a, b) < 0 ? $"{a}|{b}" : $"{b}|{a}";
                    if (!known.Contains(key)) cycles.Add(key);
                }

        Assert.True(cycles.Count == 0,
            "New module dependency cycle(s) introduced (break one direction, or route "
            + "via the shared kernel):\n  " + string.Join("\n  ", cycles.Distinct()));
    }

    [Fact]
    public void Integrations_adapters_do_not_reach_into_business_modules()
    {
        // Idiomatic NetArchTest cross-check of the Integrations leaf rule. (The
        // Cecil ratchet above is authoritative; this documents intent in the
        // arch-testing vocabulary.)
        var asm = typeof(Atlas.Api.AtlasDbContext).Assembly;
        var others = Domains.Where(d => d != "Integrations")
                            .Select(d => $"Atlas.Api.{d}").ToArray();
        var result = Types.InAssembly(asm)
            .That().ResideInNamespace("Atlas.Api.Integrations")
            .ShouldNot().HaveDependencyOnAny(others)
            .GetResult();

        Assert.True(result.IsSuccessful,
            "Integrations adapters must not depend on business modules: "
            + string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>()));
    }
}
