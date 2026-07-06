using System.Net;
using Xunit;

namespace Atlas.Tests;

// The colour-graded Excel exports return a real .xlsx stream.
public class ExportTests : IClassFixture<AtlasApiFactory>
{
    readonly AtlasApiFactory _factory;
    public ExportTests(AtlasApiFactory factory) => _factory = factory;

    HttpClient Admin()
    {
        var c = _factory.CreateClient();
        c.DefaultRequestHeaders.Add("X-Atlas-Role", "admin");
        return c;
    }

    const string Xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    [Theory]
    [InlineData("month")]
    [InlineData("week")]
    [InlineData("quarter")]
    [InlineData("year")]
    public async Task Allocation_report_returns_an_xlsx(string period)
    {
        var res = await Admin().GetAsync($"/api/v1/resources/allocation-report.xlsx?period={period}&from=2026-01-01&to=2026-12-31");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(Xlsx, res.Content.Headers.ContentType?.MediaType);
        var bytes = await res.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 0);
        Assert.Equal(0x50, bytes[0]); // "PK" — a zip/xlsx magic byte
        Assert.Equal(0x4B, bytes[1]);
    }

    [Fact]
    public async Task Skills_matrix_exports_an_xlsx()
    {
        var res = await Admin().GetAsync("/api/v1/skills/export.xlsx");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(Xlsx, res.Content.Headers.ContentType?.MediaType);
        var bytes = await res.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 0 && bytes[0] == 0x50 && bytes[1] == 0x4B);
    }
}
