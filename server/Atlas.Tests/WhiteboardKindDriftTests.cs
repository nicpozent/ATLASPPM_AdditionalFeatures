using System.Text.RegularExpressions;

namespace Atlas.Tests;

// ADR-0064 shape registry. The whiteboard has TWO whitelists of node kinds that
// MUST stay identical: the server sanitiser (Whiteboards.Kinds, the security
// boundary — anything not in it is rejected on write) and the frontend registry
// (src/whiteboard/types.ts — the NodeKind union + SHAPES map that drive the UI).
// Before the registry refactor these drifted silently: a kind added on one side
// was mis-rendered or rejected on the other. These tests fail loudly on drift.
public class WhiteboardKindDriftTests
{
    // The canonical 14 kinds (R12 / #98). Adding a kind means: (1) extend this
    // list, (2) the frontend NodeKind union + SHAPES map (Record<NodeKind> forces
    // a spec), (3) the server Whiteboards.Kinds set. Any one missed → a test here
    // goes red.
    private static readonly string[] Canonical =
    {
        "note", "rect", "ellipse", "diamond", "actor", "text", "icon",
        "triangle", "hexagon", "parallelogram", "star", "cylinder", "pill", "draw",
    };

    [Fact]
    public void Server_whitelist_matches_the_canonical_set()
    {
        Assert.Equal(
            Canonical.OrderBy(x => x, StringComparer.Ordinal),
            Whiteboards.Kinds.OrderBy(x => x, StringComparer.Ordinal));
    }

    [Fact]
    public void Frontend_NodeKind_union_matches_the_server_whitelist()
    {
        var types = RepoFile("src/whiteboard/types.ts");
        Assert.True(File.Exists(types), $"expected frontend registry at {types}");
        var src = File.ReadAllText(types);

        // Grab the `export type NodeKind = "a" | "b" | …;` block and pull every
        // quoted member out of it. Regex is enough — the union is a flat list of
        // string literals by construction (it feeds a Record<NodeKind, …>).
        var union = Regex.Match(src, @"export\s+type\s+NodeKind\s*=(.*?);", RegexOptions.Singleline);
        Assert.True(union.Success, "could not locate the NodeKind union in types.ts");
        var frontendKinds = Regex.Matches(union.Groups[1].Value, "\"([a-z]+)\"")
            .Select(m => m.Groups[1].Value)
            .ToHashSet();

        Assert.Equal(
            Canonical.OrderBy(x => x, StringComparer.Ordinal),
            frontendKinds.OrderBy(x => x, StringComparer.Ordinal));
    }

    // Walk up from the test assembly to the repo root (the dir that holds src/),
    // so the test finds the frontend file regardless of the working directory.
    private static string RepoFile(string relative)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "src", "whiteboard")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        return Path.Combine(dir!.FullName, relative.Replace('/', Path.DirectorySeparatorChar));
    }
}
