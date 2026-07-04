using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class CostLineScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CostLines_ProjectId",
                table: "CostLines");

            migrationBuilder.RenameColumn(
                name: "ProjectId",
                table: "CostLines",
                newName: "OwnerId");

            migrationBuilder.AddColumn<string>(
                name: "Scope",
                table: "CostLines",
                type: "text",
                nullable: false,
                defaultValue: "project");

            migrationBuilder.CreateIndex(
                name: "IX_CostLines_Scope_OwnerId",
                table: "CostLines",
                columns: new[] { "Scope", "OwnerId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CostLines_Scope_OwnerId",
                table: "CostLines");

            migrationBuilder.DropColumn(
                name: "Scope",
                table: "CostLines");

            migrationBuilder.RenameColumn(
                name: "OwnerId",
                table: "CostLines",
                newName: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_CostLines_ProjectId",
                table: "CostLines",
                column: "ProjectId");
        }
    }
}
