using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class SecurityCompliance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SecurityControls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProjectId = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Control = table.Column<string>(type: "text", nullable: false),
                    Framework = table.Column<string>(type: "text", nullable: false),
                    Evidence = table.Column<string>(type: "text", nullable: false),
                    Owner = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Ord = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityControls", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SecurityProfiles",
                columns: table => new
                {
                    ProjectId = table.Column<string>(type: "text", nullable: false),
                    Classification = table.Column<string>(type: "text", nullable: false),
                    Residency = table.Column<string>(type: "text", nullable: false),
                    Subjects = table.Column<string>(type: "text", nullable: false),
                    Retention = table.Column<string>(type: "text", nullable: false),
                    PersonalData = table.Column<bool>(type: "boolean", nullable: false),
                    SpecialCategory = table.Column<bool>(type: "boolean", nullable: false),
                    AutomatedDecisions = table.Column<bool>(type: "boolean", nullable: false),
                    CardholderData = table.Column<bool>(type: "boolean", nullable: false),
                    Gdpr = table.Column<bool>(type: "boolean", nullable: false),
                    Pci = table.Column<bool>(type: "boolean", nullable: false),
                    Iso = table.Column<bool>(type: "boolean", nullable: false),
                    AiAct = table.Column<bool>(type: "boolean", nullable: false),
                    Soc2 = table.Column<bool>(type: "boolean", nullable: false),
                    Nis2 = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityProfiles", x => x.ProjectId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SecurityControls_ProjectId",
                table: "SecurityControls",
                column: "ProjectId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SecurityControls");

            migrationBuilder.DropTable(
                name: "SecurityProfiles");
        }
    }
}
