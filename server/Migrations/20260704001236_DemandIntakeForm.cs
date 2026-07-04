using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class DemandIntakeForm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllStakeholders",
                table: "Demands",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "BenefitValue",
                table: "Demands",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "BusinessProblem",
                table: "Demands",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Criticality",
                table: "Demands",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Deadline",
                table: "Demands",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Demands",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ExpectedBenefits",
                table: "Demands",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<List<string>>(
                name: "GeoImpact",
                table: "Demands",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<bool>(
                name: "HasDeadline",
                table: "Demands",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ImprovementExisting",
                table: "Demands",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "Risk",
                table: "Demands",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Demands",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<List<string>>(
                name: "Stakeholders",
                table: "Demands",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.CreateTable(
                name: "DemandAttachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DemandId = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    ContentType = table.Column<string>(type: "text", nullable: false),
                    Size = table.Column<long>(type: "bigint", nullable: false),
                    Bytes = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemandAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DemandAttachments_Demands_DemandId",
                        column: x => x.DemandId,
                        principalTable: "Demands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DemandAttachments_DemandId",
                table: "DemandAttachments",
                column: "DemandId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DemandAttachments");

            migrationBuilder.DropColumn(
                name: "AllStakeholders",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "BenefitValue",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "BusinessProblem",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "Criticality",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "Deadline",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "ExpectedBenefits",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "GeoImpact",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "HasDeadline",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "ImprovementExisting",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "Risk",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Demands");

            migrationBuilder.DropColumn(
                name: "Stakeholders",
                table: "Demands");
        }
    }
}
