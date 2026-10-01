using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EventLy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class UniqueGuestNameAndPhone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_guests_event_id_name",
                table: "guests");

            migrationBuilder.AlterColumn<string>(
                name: "name",
                table: "guests",
                type: "citext",
                maxLength: 120,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(120)",
                oldMaxLength: 120);

            migrationBuilder.AddColumn<string>(
                name: "phone_key",
                table: "guests",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            // Existing data first, so the unique indexes can be created (decision Q-55):
            // tidy the spacing of names, then number later duplicates "Budi (2)", "Budi (3)"...
            migrationBuilder.Sql("""
                UPDATE guests SET name = btrim(regexp_replace(name, '\s+', ' ', 'g'));
                WITH ranked AS (
                    SELECT id, row_number() OVER (PARTITION BY event_id, lower(name) ORDER BY created_at, id) AS n
                    FROM guests WHERE deleted_at IS NULL)
                UPDATE guests g SET name = g.name || ' (' || r.n || ')'
                FROM ranked r WHERE g.id = r.id AND r.n > 1;
                """);
            // phone_key as WhatsAppMessage.NormalizePhone does it: digits, 0… becomes 62…, 8 to 15 digits.
            // Of numbers already used twice in an event, only the first guest keeps the key.
            migrationBuilder.Sql("""
                UPDATE guests g SET phone_key = CASE WHEN x.d LIKE '0%' THEN '62' || substr(x.d, 2) ELSE x.d END
                FROM (SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') AS d FROM guests WHERE phone IS NOT NULL) x
                WHERE g.id = x.id;
                UPDATE guests SET phone_key = NULL WHERE length(phone_key) NOT BETWEEN 8 AND 15;
                WITH ranked AS (
                    SELECT id, row_number() OVER (PARTITION BY event_id, phone_key ORDER BY created_at, id) AS n
                    FROM guests WHERE deleted_at IS NULL AND phone_key IS NOT NULL)
                UPDATE guests g SET phone_key = NULL FROM ranked r WHERE g.id = r.id AND r.n > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "ux_guests_event_name",
                table: "guests",
                columns: new[] { "event_id", "name" },
                unique: true,
                filter: "deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ux_guests_event_phone",
                table: "guests",
                columns: new[] { "event_id", "phone_key" },
                unique: true,
                filter: "deleted_at IS NULL AND phone_key IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_guests_event_name",
                table: "guests");

            migrationBuilder.DropIndex(
                name: "ux_guests_event_phone",
                table: "guests");

            migrationBuilder.DropColumn(
                name: "phone_key",
                table: "guests");

            migrationBuilder.AlterColumn<string>(
                name: "name",
                table: "guests",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "citext",
                oldMaxLength: 120);

            migrationBuilder.CreateIndex(
                name: "ix_guests_event_id_name",
                table: "guests",
                columns: new[] { "event_id", "name" },
                filter: "deleted_at IS NULL");
        }
    }
}
