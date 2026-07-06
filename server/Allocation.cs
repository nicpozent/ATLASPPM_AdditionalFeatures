namespace Atlas.Api;

// ============================================================================
//  Capacity model — one canonical basis for turning weekly hours into a % of a
//  person's capacity, and for deciding whether a dated allocation segment is
//  live on a given day. 40h/week = 100%; ~4.33 weeks/month (52/12) and 12
//  months/year drive the effort maths used by the period exports.
// ============================================================================
public static class AllocMath
{
    public const int HoursPerWeek = 40;
    public const double WeeksPerMonth = 52.0 / 12.0;   // ≈ 4.333

    // Weekly hours → whole-% of capacity (clamped 0–100).
    public static int PctFromHours(int hours) =>
        Math.Clamp((int)Math.Round(hours * 100.0 / HoursPerWeek), 0, 100);

    // Resolve a member segment's canonical %: prefer explicit hours when given,
    // else the supplied percent.
    public static int Percent(int? pct, int? hours) =>
        hours is int h && h > 0 ? PctFromHours(h) : Math.Clamp(pct ?? 0, 0, 100);

    // A dated segment is live on `asOf` when it has started and not yet ended.
    // Empty bounds are open, so a segment with no dates is always live (keeps
    // pre-dates data behaving exactly as before).
    public static bool ActiveOn(string? start, string? end, DateOnly asOf)
    {
        if (!string.IsNullOrEmpty(start) && DateOnly.TryParse(start, out var s) && asOf < s) return false;
        if (!string.IsNullOrEmpty(end) && DateOnly.TryParse(end, out var e) && asOf > e) return false;
        return true;
    }
}
