using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class OpsItemRichFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<string>>(
                name: "Components",
                table: "OpsItems",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<string>(
                name: "EpicKey",
                table: "OpsItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EpicName",
                table: "OpsItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "EstimateHours",
                table: "OpsItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<List<string>>(
                name: "FixVersions",
                table: "OpsItems",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<string>(
                name: "IssueType",
                table: "OpsItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "JiraCreated",
                table: "OpsItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "JiraUpdated",
                table: "OpsItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "JiraUrl",
                table: "OpsItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<List<string>>(
                name: "Labels",
                table: "OpsItems",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<string>(
                name: "ParentKey",
                table: "OpsItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Points",
                table: "OpsItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Reporter",
                table: "OpsItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Resolution",
                table: "OpsItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StatusName",
                table: "OpsItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TargetDate",
                table: "OpsItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "TimeSpentHours",
                table: "OpsItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "OpsItemAttachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OpsItemId = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_OpsItemAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OpsItemAttachments_OpsItems_OpsItemId",
                        column: x => x.OpsItemId,
                        principalTable: "OpsItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OpsItemComments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OpsItemId = table.Column<int>(type: "integer", nullable: false),
                    Author = table.Column<string>(type: "text", nullable: false),
                    Initials = table.Column<string>(type: "text", nullable: false),
                    Body = table.Column<string>(type: "text", nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    JiraId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OpsItemComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OpsItemComments_OpsItems_OpsItemId",
                        column: x => x.OpsItemId,
                        principalTable: "OpsItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OpsItemAttachments_OpsItemId",
                table: "OpsItemAttachments",
                column: "OpsItemId");

            migrationBuilder.CreateIndex(
                name: "IX_OpsItemComments_OpsItemId",
                table: "OpsItemComments",
                column: "OpsItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OpsItemAttachments");

            migrationBuilder.DropTable(
                name: "OpsItemComments");

            migrationBuilder.DropColumn(
                name: "Components",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "EpicKey",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "EpicName",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "EstimateHours",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "FixVersions",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "IssueType",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "JiraCreated",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "JiraUpdated",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "JiraUrl",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "Labels",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "ParentKey",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "Points",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "Reporter",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "Resolution",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "StatusName",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "TargetDate",
                table: "OpsItems");

            migrationBuilder.DropColumn(
                name: "TimeSpentHours",
                table: "OpsItems");
        }
    }
}
