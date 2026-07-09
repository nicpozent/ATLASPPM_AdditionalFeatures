using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class AiActClassification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AiAnnexIii",
                table: "SecurityProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AiHumanOversight",
                table: "SecurityProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "AiRiskTier",
                table: "SecurityProfiles",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AiSystemName",
                table: "SecurityProfiles",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "AiTransparency",
                table: "SecurityProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiAnnexIii",
                table: "SecurityProfiles");

            migrationBuilder.DropColumn(
                name: "AiHumanOversight",
                table: "SecurityProfiles");

            migrationBuilder.DropColumn(
                name: "AiRiskTier",
                table: "SecurityProfiles");

            migrationBuilder.DropColumn(
                name: "AiSystemName",
                table: "SecurityProfiles");

            migrationBuilder.DropColumn(
                name: "AiTransparency",
                table: "SecurityProfiles");
        }
    }
}
