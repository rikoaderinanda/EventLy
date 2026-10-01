using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EventLy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRsvpWishesAndGifts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "gift_address",
                table: "events",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "gift_accounts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    provider = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    account_number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    account_holder = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gift_accounts", x => x.id);
                    table.CheckConstraint("ck_gift_accounts_kind", "kind IN ('Bank','EWallet')");
                    table.ForeignKey(
                        name: "fk_gift_accounts_events_event_id",
                        column: x => x.event_id,
                        principalTable: "events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "gift_confirmations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    invitation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sender_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    note = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gift_confirmations", x => x.id);
                    table.CheckConstraint("ck_gift_confirmations_amount", "amount IS NULL OR amount > 0");
                    table.ForeignKey(
                        name: "fk_gift_confirmations_events_event_id",
                        column: x => x.event_id,
                        principalTable: "events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_gift_confirmations_invitations_invitation_id",
                        column: x => x.invitation_id,
                        principalTable: "invitations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "rsvps",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    invitation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    responded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rsvps", x => x.id);
                    table.CheckConstraint("ck_rsvps_status", "status IN ('Pending','Attending','NotAttending')");
                    table.ForeignKey(
                        name: "fk_rsvps_invitations_invitation_id",
                        column: x => x.invitation_id,
                        principalTable: "invitations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "wishes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    invitation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    is_hidden = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_wishes", x => x.id);
                    table.ForeignKey(
                        name: "fk_wishes_events_event_id",
                        column: x => x.event_id,
                        principalTable: "events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_wishes_invitations_invitation_id",
                        column: x => x.invitation_id,
                        principalTable: "invitations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_gift_accounts_event_id_sort_order",
                table: "gift_accounts",
                columns: new[] { "event_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_gift_confirmations_event_id_created_at",
                table: "gift_confirmations",
                columns: new[] { "event_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_gift_confirmations_invitation_id",
                table: "gift_confirmations",
                column: "invitation_id");

            migrationBuilder.CreateIndex(
                name: "ux_rsvps_invitation",
                table: "rsvps",
                column: "invitation_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_wishes_event_id_created_at",
                table: "wishes",
                columns: new[] { "event_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_wishes_invitation_id",
                table: "wishes",
                column: "invitation_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gift_accounts");

            migrationBuilder.DropTable(
                name: "gift_confirmations");

            migrationBuilder.DropTable(
                name: "rsvps");

            migrationBuilder.DropTable(
                name: "wishes");

            migrationBuilder.DropColumn(
                name: "gift_address",
                table: "events");
        }
    }
}
