using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class TeamMembersFk : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TeamMembers_EntraGroups_EntraGroupId",
                table: "TeamMembers");

            migrationBuilder.DropIndex(
                name: "IX_TeamMembers_EntraGroupId",
                table: "TeamMembers");

            migrationBuilder.DropColumn(
                name: "EntraGroupId",
                table: "TeamMembers");

            migrationBuilder.CreateIndex(
                name: "IX_TeamMembers_GroupId",
                table: "TeamMembers",
                column: "GroupId");

            migrationBuilder.AddForeignKey(
                name: "FK_TeamMembers_EntraGroups_GroupId",
                table: "TeamMembers",
                column: "GroupId",
                principalTable: "EntraGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TeamMembers_EntraGroups_GroupId",
                table: "TeamMembers");

            migrationBuilder.DropIndex(
                name: "IX_TeamMembers_GroupId",
                table: "TeamMembers");

            migrationBuilder.AddColumn<string>(
                name: "EntraGroupId",
                table: "TeamMembers",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamMembers_EntraGroupId",
                table: "TeamMembers",
                column: "EntraGroupId");

            migrationBuilder.AddForeignKey(
                name: "FK_TeamMembers_EntraGroups_EntraGroupId",
                table: "TeamMembers",
                column: "EntraGroupId",
                principalTable: "EntraGroups",
                principalColumn: "Id");
        }
    }
}
