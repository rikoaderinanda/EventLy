using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EventLy.Api.Data.Configurations;

public sealed class EventConfiguration : IEntityTypeConfiguration<Event>
{
    public void Configure(EntityTypeBuilder<Event> builder)
    {
        builder.ToTable("events", t =>
        {
            t.HasCheckConstraint("ck_events_category",
                "category IN ('Wedding','Corporate','Birthday','Community','Other')");
            t.HasCheckConstraint("ck_events_status",
                "status IN ('Draft','PendingPayment','Active','Completed','Cancelled')");
        });

        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Name).HasMaxLength(150);
        builder.Property(e => e.Category).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.Description).HasMaxLength(2000);
        builder.Property(e => e.TimeZone).HasMaxLength(64);
        builder.Property(e => e.Venue).HasMaxLength(200);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.CoverImageKey).HasMaxLength(512);
        builder.Property(e => e.WhatsappTemplate).HasMaxLength(1000);
        builder.Property(e => e.GiftAddress).HasMaxLength(500);
        builder.Property(e => e.GiftQrisKey).HasMaxLength(512);
        builder.Property(e => e.MusicKey).HasMaxLength(512);
        builder.Property(e => e.MusicContentType).HasMaxLength(40);
        builder.Property(e => e.GuestUploadEnabled).HasDefaultValue(true);
        builder.Property(e => e.Version).IsRowVersion();
        builder.Ignore(e => e.CheckInSession);
        builder.Ignore(e => e.EndsAt);
        builder.OwnsOne(e => e.PackageSnapshot, s =>
        {
            s.ToJson("package_snapshot");
            s.OwnsOne(x => x.Features);
        });

        builder.HasOne<Organization>().WithMany().HasForeignKey(e => e.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Package>().WithMany().HasForeignKey(e => e.PackageId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(e => e.Sessions).WithOne().HasForeignKey(s => s.EventId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(e => e.StaffAssignments).WithOne().HasForeignKey(a => a.EventId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.OrganizationId, e.Date }).IsDescending(false, true)
            .HasFilter("deleted_at IS NULL");
    }
}

public sealed class EventSessionConfiguration : IEntityTypeConfiguration<EventSession>
{
    public void Configure(EntityTypeBuilder<EventSession> builder)
    {
        builder.ToTable("event_sessions", t => t.HasCheckConstraint("ck_event_sessions_times", "ends_at > starts_at"));

        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Name).HasMaxLength(60);
        builder.Property(s => s.Venue).HasMaxLength(200);
        builder.Property(s => s.MapsUrl).HasMaxLength(2048);

        // "Exactly one check-in session per event" is enforced by the validator, not a unique partial index:
        // moving the flag from one session to another is two UPDATEs, and PostgreSQL can't defer a partial
        // unique index, so a valid edit could be refused depending on statement order.
        builder.HasIndex(s => new { s.EventId, s.SortOrder });
    }
}

public sealed class EventStaffAssignmentConfiguration : IEntityTypeConfiguration<EventStaffAssignment>
{
    public void Configure(EntityTypeBuilder<EventStaffAssignment> builder)
    {
        builder.ToTable("event_staff_assignments");

        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.HasOne<User>().WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(a => new { a.EventId, a.UserId }).IsUnique();
        builder.HasIndex(a => a.UserId);
    }
}
