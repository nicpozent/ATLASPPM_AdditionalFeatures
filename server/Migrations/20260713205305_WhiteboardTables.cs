using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class WhiteboardTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Schema only. Existing scenes stored as "whiteboard.{scope}" Setting
            // blobs are migrated into these tables at startup by
            // Whiteboards.BackfillAsync (parses + re-sanitises the JSON, then
            // deletes the Setting row) — kept in C# because the transform is a
            // JSON scene → many rows, awkward and fragile as raw SQL.
            migrationBuilder.CreateTable(
                name: "WhiteboardEdges",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Scope = table.Column<string>(type: "text", nullable: false),
                    EdgeId = table.Column<string>(type: "text", nullable: false),
                    FromNode = table.Column<string>(type: "text", nullable: false),
                    ToNode = table.Column<string>(type: "text", nullable: false),
                    Color = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WhiteboardEdges", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WhiteboardNodes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Scope = table.Column<string>(type: "text", nullable: false),
                    NodeId = table.Column<string>(type: "text", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    X = table.Column<double>(type: "double precision", nullable: false),
                    Y = table.Column<double>(type: "double precision", nullable: false),
                    W = table.Column<double>(type: "double precision", nullable: false),
                    H = table.Column<double>(type: "double precision", nullable: false),
                    Text = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<string>(type: "text", nullable: true),
                    Icon = table.Column<string>(type: "text", nullable: true),
                    PointsJson = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WhiteboardNodes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WhiteboardEdges_Scope",
                table: "WhiteboardEdges",
                column: "Scope");

            migrationBuilder.CreateIndex(
                name: "IX_WhiteboardEdges_Scope_EdgeId",
                table: "WhiteboardEdges",
                columns: new[] { "Scope", "EdgeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WhiteboardNodes_Scope_NodeId",
                table: "WhiteboardNodes",
                columns: new[] { "Scope", "NodeId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WhiteboardEdges");

            migrationBuilder.DropTable(
                name: "WhiteboardNodes");
        }
    }
}
