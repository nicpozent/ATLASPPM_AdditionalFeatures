using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class OkrHealthDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Health",
                table: "Objectives",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StartDate",
                table: "Objectives",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TargetDate",
                table: "Objectives",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Health",
                table: "Objectives");

            migrationBuilder.DropColumn(
                name: "StartDate",
                table: "Objectives");

            migrationBuilder.DropColumn(
                name: "TargetDate",
                table: "Objectives");
        }
    }
}
