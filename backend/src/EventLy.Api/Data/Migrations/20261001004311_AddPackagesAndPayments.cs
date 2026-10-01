using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EventLy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPackagesAndPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "package_snapshot",
                table: "events",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "packages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    price = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    feature = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_packages", x => x.id);
                    table.CheckConstraint("ck_packages_price", "price >= 0");
                });

            migrationBuilder.CreateTable(
                name: "payments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    package_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    provider = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    provider_reference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    checkout_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    paid_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    confirmed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    package_snapshot = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payments", x => x.id);
                    table.CheckConstraint("ck_payments_amount", "amount >= 0");
                    table.CheckConstraint("ck_payments_provider", "provider IN ('Fake','Xendit','Manual')");
                    table.CheckConstraint("ck_payments_status", "status IN ('Pending','Paid','Failed','Expired','Cancelled')");
                    table.ForeignKey(
                        name: "fk_payments_events_event_id",
                        column: x => x.event_id,
                        principalTable: "events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_payments_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_payments_packages_package_id",
                        column: x => x.package_id,
                        principalTable: "packages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_payments_users_confirmed_by",
                        column: x => x.confirmed_by,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_events_package_id",
                table: "events",
                column: "package_id");

            migrationBuilder.CreateIndex(
                name: "ix_packages_code",
                table: "packages",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_payments_confirmed_by",
                table: "payments",
                column: "confirmed_by");

            migrationBuilder.CreateIndex(
                name: "ix_payments_event_id_created_at",
                table: "payments",
                columns: new[] { "event_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_payments_organization_id_created_at",
                table: "payments",
                columns: new[] { "organization_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_payments_package_id",
                table: "payments",
                column: "package_id");

            migrationBuilder.CreateIndex(
                name: "ix_payments_pending",
                table: "payments",
                columns: new[] { "status", "expires_at" },
                filter: "status = 'Pending'");

            migrationBuilder.CreateIndex(
                name: "ux_payments_one_paid",
                table: "payments",
                column: "event_id",
                unique: true,
                filter: "status = 'Paid'");

            migrationBuilder.CreateIndex(
                name: "ux_payments_provider_ref",
                table: "payments",
                columns: new[] { "provider", "provider_reference" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_events_packages_package_id",
                table: "events",
                column: "package_id",
                principalTable: "packages",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_events_packages_package_id",
                table: "events");

            migrationBuilder.DropTable(
                name: "payments");

            migrationBuilder.DropTable(
                name: "packages");

            migrationBuilder.DropIndex(
                name: "ix_events_package_id",
                table: "events");

            migrationBuilder.DropColumn(
                name: "package_snapshot",
                table: "events");
        }
    }
}
