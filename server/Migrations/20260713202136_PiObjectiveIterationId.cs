using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Atlas.Api.Migrations
{
    /// <inheritdoc />
    public partial class PiObjectiveIterationId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "IterationId",
                table: "PiObjectives",
                type: "integer",
                nullable: true);

            // Backfill from the previous migration-free home: the board placement
            // JSON map in Setting rows "pi.board.{incrementId}" (objectiveId →
            // iterationId). Best-effort inside a DO block so a hand-edited/corrupt
            // blob can never fail the migration; then drop the obsolete rows.
            migrationBuilder.Sql(@"
DO $$
BEGIN
    UPDATE ""PiObjectives"" o
    SET ""IterationId"" = (kv.value)::int
    FROM ""Settings"" s
    CROSS JOIN LATERAL jsonb_each_text(s.""Value""::jsonb) AS kv
    WHERE s.""Key"" LIKE 'pi.board.%' AND o.""Id""::text = kv.key;
EXCEPTION WHEN others THEN
    NULL;  -- placement is presentation state; tolerate any bad blob
END $$;");
            migrationBuilder.Sql(@"DELETE FROM ""Settings"" WHERE ""Key"" LIKE 'pi.board.%';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IterationId",
                table: "PiObjectives");
        }
    }
}
