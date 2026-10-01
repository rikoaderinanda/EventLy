using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EventLy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCheckIns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "check_ins",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    invitation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    checked_in_by = table.Column<Guid>(type: "uuid", nullable: false),
                    checked_in_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    method = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_check_ins", x => x.id);
                    table.CheckConstraint("ck_check_ins_method", "method IN ('Scan','Manual')");
                    table.ForeignKey(
                        name: "fk_check_ins_events_event_id",
                        column: x => x.event_id,
                        principalTable: "events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_check_ins_invitations_invitation_id",
                        column: x => x.invitation_id,
                        principalTable: "invitations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_check_ins_users_checked_in_by",
                        column: x => x.checked_in_by,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_check_ins_checked_in_by_checked_in_at",
                table: "check_ins",
                columns: new[] { "checked_in_by", "checked_in_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_check_ins_event_id_checked_in_at",
                table: "check_ins",
                columns: new[] { "event_id", "checked_in_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ux_check_ins_invitation",
                table: "check_ins",
                column: "invitation_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "check_ins");
        }
    }
}
