using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EventLy.Api.Data.Configurations;

public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments", t =>
        {
            t.HasCheckConstraint("ck_payments_status", "status IN ('Pending','Paid','Failed','Expired','Cancelled')");
            t.HasCheckConstraint("ck_payments_provider", "provider IN ('Fake','Xendit','Manual')");
            t.HasCheckConstraint("ck_payments_amount", "amount >= 0");
        });

        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Amount).HasPrecision(12, 2);
        builder.Property(p => p.Currency).HasMaxLength(3).IsFixedLength();
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.Provider).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.ProviderReference).HasMaxLength(200);
        builder.Property(p => p.CheckoutUrl).HasMaxLength(2048);
        builder.Property(p => p.Note).HasMaxLength(500);
        builder.Property(p => p.Version).IsRowVersion();
        builder.OwnsOne(p => p.PackageSnapshot, s =>
        {
            s.ToJson("package_snapshot");
            s.OwnsOne(x => x.Features);
        });
        builder.Navigation(p => p.PackageSnapshot).IsRequired();

        builder.HasOne<Organization>().WithMany().HasForeignKey(p => p.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Event>().WithMany().HasForeignKey(p => p.EventId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Package>().WithMany().HasForeignKey(p => p.PackageId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(p => p.ConfirmedBy).OnDelete(DeleteBehavior.Restrict);

        // Idempotent webhooks: one row per provider transaction.
        builder.HasIndex(p => new { p.Provider, p.ProviderReference }).IsUnique()
            .HasDatabaseName("ux_payments_provider_ref");
        // An event is paid for at most once.
        builder.HasIndex(p => p.EventId).IsUnique().HasFilter("status = 'Paid'")
            .HasDatabaseName("ux_payments_one_paid");
        builder.HasIndex(p => new { p.EventId, p.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(p => new { p.OrganizationId, p.CreatedAt }).IsDescending(false, true);
        // Reconciliation scans pending payments.
        builder.HasIndex(p => new { p.Status, p.ExpiresAt }).HasFilter("status = 'Pending'")
            .HasDatabaseName("ix_payments_pending");
    }
}
