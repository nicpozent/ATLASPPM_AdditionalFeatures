namespace Atlas.Api.People;

// The fixed set of owning departments for projects, programs and products.
// Kept in one place so the API validates against exactly the list the UI offers.
public static class Departments
{
    public static readonly string[] All =
    {
        "Infrastructure", "Development", "Security", "D365", "Architecture", "PMO", "PO",
    };

    // Normalise an incoming value to a known department (case-insensitive), else "".
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        return All.FirstOrDefault(d => string.Equals(d, value.Trim(), StringComparison.OrdinalIgnoreCase)) ?? "";
    }
}
