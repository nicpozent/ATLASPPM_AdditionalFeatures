using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class ProjectLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Archived",
                table: "Projects",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsSystem",
                table: "Projects",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Any project that already exists predates manual creation, so it is
            // seeded/demo data: mark it system (archivable, never hard-deletable).
            migrationBuilder.Sql("UPDATE \"Projects\" SET \"IsSystem\" = true;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Archived",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "IsSystem",
                table: "Projects");
        }
    }
}
