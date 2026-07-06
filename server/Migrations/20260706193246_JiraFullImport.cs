using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class JiraFullImport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "JiraId",
                table: "TaskComments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "BoardId",
                table: "Sprints",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "CompleteDate",
                table: "Sprints",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<List<string>>(
                name: "Components",
                table: "ProjectTasks",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "ProjectTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EpicKey",
                table: "ProjectTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<List<string>>(
                name: "FixVersions",
                table: "ProjectTasks",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "IssueType",
                table: "ProjectTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "JiraCreated",
                table: "ProjectTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "JiraUpdated",
                table: "ProjectTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "JiraUrl",
                table: "ProjectTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<List<string>>(
                name: "Labels",
                table: "ProjectTasks",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "ParentKey",
                table: "ProjectTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Reporter",
                table: "ProjectTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Resolution",
                table: "ProjectTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StatusName",
                table: "ProjectTasks",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "TimeSpentHours",
                table: "ProjectTasks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Epics",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EpicKey",
                table: "Epics",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "JiraUrl",
                table: "Epics",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "TaskAttachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TaskId = table.Column<int>(type: "integer", nullable: false),
                    JiraId = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    ContentType = table.Column<string>(type: "text", nullable: false),
                    Size = table.Column<long>(type: "bigint", nullable: false),
                    Author = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<string>(type: "text", nullable: false),
                    Bytes = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskAttachments_ProjectTasks_TaskId",
                        column: x => x.TaskId,
                        principalTable: "ProjectTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaskComments_TaskId",
                table: "TaskComments",
                column: "TaskId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskAttachments_TaskId",
                table: "TaskAttachments",
                column: "TaskId");

            migrationBuilder.AddForeignKey(
                name: "FK_TaskComments_ProjectTasks_TaskId",
                table: "TaskComments",
                column: "TaskId",
                principalTable: "ProjectTasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TaskComments_ProjectTasks_TaskId",
                table: "TaskComments");

            migrationBuilder.DropTable(
                name: "TaskAttachments");

            migrationBuilder.DropIndex(
                name: "IX_TaskComments_TaskId",
                table: "TaskComments");

            migrationBuilder.DropColumn(
                name: "JiraId",
                table: "TaskComments");

            migrationBuilder.DropColumn(
                name: "BoardId",
                table: "Sprints");

            migrationBuilder.DropColumn(
                name: "CompleteDate",
                table: "Sprints");

            migrationBuilder.DropColumn(
                name: "Components",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "EpicKey",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "FixVersions",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "IssueType",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "JiraCreated",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "JiraUpdated",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "JiraUrl",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "Labels",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "ParentKey",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "Reporter",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "Resolution",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "StatusName",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "TimeSpentHours",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Epics");

            migrationBuilder.DropColumn(
                name: "EpicKey",
                table: "Epics");

            migrationBuilder.DropColumn(
                name: "JiraUrl",
                table: "Epics");
        }
    }
}
