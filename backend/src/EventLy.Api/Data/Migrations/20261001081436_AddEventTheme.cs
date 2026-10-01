using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EventLy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEventTheme : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "theme",
                table: "events",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Elegant");

            // Existing events get the theme their category would get now (Q-62).
            migrationBuilder.Sql("""
                UPDATE events SET theme = CASE category
                    WHEN 'Birthday' THEN 'Birthday'
                    WHEN 'Corporate' THEN 'Corporate'
                    ELSE 'Elegant'
                END;
                """);

            migrationBuilder.AddCheckConstraint(
                name: "ck_events_theme",
                table: "events",
                sql: "theme IN ('Elegant','Birthday','Corporate')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_events_theme",
                table: "events");

            migrationBuilder.DropColumn(
                name: "theme",
                table: "events");
        }
    }
}
