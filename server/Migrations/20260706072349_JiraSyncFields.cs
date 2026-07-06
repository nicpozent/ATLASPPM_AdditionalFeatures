using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class JiraSyncFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "JiraKey",
                table: "Sprints",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "JiraBoardId",
                table: "Projects",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JiraProjectKey",
                table: "Projects",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "JiraKey",
                table: "ProjectTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "JiraKey",
                table: "Epics",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "JiraKey",
                table: "Sprints");

            migrationBuilder.DropColumn(
                name: "JiraBoardId",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "JiraProjectKey",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "JiraKey",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "JiraKey",
                table: "Epics");
        }
    }
}
