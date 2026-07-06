using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class SubTeams : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SubTeams",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    ManagerKey = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubTeams", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TeamAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EntityType = table.Column<string>(type: "text", nullable: false),
                    EntityId = table.Column<string>(type: "text", nullable: false),
                    SubTeamId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamAssignments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SubTeamMembers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SubTeamId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubTeamMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubTeamMembers_SubTeams_SubTeamId",
                        column: x => x.SubTeamId,
                        principalTable: "SubTeams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamAssignmentMembers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TeamAssignmentId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamAssignmentMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamAssignmentMembers_TeamAssignments_TeamAssignmentId",
                        column: x => x.TeamAssignmentId,
                        principalTable: "TeamAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SubTeamMembers_SubTeamId",
                table: "SubTeamMembers",
                column: "SubTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamAssignmentMembers_TeamAssignmentId",
                table: "TeamAssignmentMembers",
                column: "TeamAssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamAssignments_EntityType_EntityId",
                table: "TeamAssignments",
                columns: new[] { "EntityType", "EntityId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SubTeamMembers");

            migrationBuilder.DropTable(
                name: "TeamAssignmentMembers");

            migrationBuilder.DropTable(
                name: "SubTeams");

            migrationBuilder.DropTable(
                name: "TeamAssignments");
        }
    }
}
