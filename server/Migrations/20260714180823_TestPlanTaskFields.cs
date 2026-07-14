using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class TestPlanTaskFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "TestPlanTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DueDate",
                table: "TestPlanTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<double>(
                name: "EstimateHours",
                table: "TestPlanTasks",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "JiraKey",
                table: "TestPlanTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StartDate",
                table: "TestPlanTasks",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "TestPlanTasks");

            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "TestPlanTasks");

            migrationBuilder.DropColumn(
                name: "EstimateHours",
                table: "TestPlanTasks");

            migrationBuilder.DropColumn(
                name: "JiraKey",
                table: "TestPlanTasks");

            migrationBuilder.DropColumn(
                name: "StartDate",
                table: "TestPlanTasks");
        }
    }
}
