using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class ArchitectureAdm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdmPhases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProjectId = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Phase = table.Column<string>(type: "text", nullable: false),
                    Focus = table.Column<string>(type: "text", nullable: false),
                    Owner = table.Column<string>(type: "text", nullable: false),
                    Artefact = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Ord = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdmPhases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ArchProfiles",
                columns: table => new
                {
                    ProjectId = table.Column<string>(type: "text", nullable: false),
                    ChangeType = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArchProfiles", x => x.ProjectId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdmPhases_ProjectId_Code",
                table: "AdmPhases",
                columns: new[] { "ProjectId", "Code" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdmPhases");

            migrationBuilder.DropTable(
                name: "ArchProfiles");
        }
    }
}
