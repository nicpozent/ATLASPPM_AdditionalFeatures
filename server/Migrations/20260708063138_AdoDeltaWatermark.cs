using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class AdoDeltaWatermark : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LastAdoSync",
                table: "Projects",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastAdoSync",
                table: "Projects");
        }
    }
}
