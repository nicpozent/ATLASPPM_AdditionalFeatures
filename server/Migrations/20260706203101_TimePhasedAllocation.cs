using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class TimePhasedAllocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AllocHours",
                table: "TeamAssignmentMembers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "EndDate",
                table: "TeamAssignmentMembers",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ExtAlloc",
                table: "TeamAssignmentMembers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ExtEndDate",
                table: "TeamAssignmentMembers",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ExtHours",
                table: "TeamAssignmentMembers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ExtStartDate",
                table: "TeamAssignmentMembers",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StartDate",
                table: "TeamAssignmentMembers",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllocHours",
                table: "TeamAssignmentMembers");

            migrationBuilder.DropColumn(
                name: "EndDate",
                table: "TeamAssignmentMembers");

            migrationBuilder.DropColumn(
                name: "ExtAlloc",
                table: "TeamAssignmentMembers");

            migrationBuilder.DropColumn(
                name: "ExtEndDate",
                table: "TeamAssignmentMembers");

            migrationBuilder.DropColumn(
                name: "ExtHours",
                table: "TeamAssignmentMembers");

            migrationBuilder.DropColumn(
                name: "ExtStartDate",
                table: "TeamAssignmentMembers");

            migrationBuilder.DropColumn(
                name: "StartDate",
                table: "TeamAssignmentMembers");
        }
    }
}
