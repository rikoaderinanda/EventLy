using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EventLy.Api.Data.Configurations;

public sealed class GuestConfiguration : IEntityTypeConfiguration<Guest>
{
    public void Configure(EntityTypeBuilder<Guest> builder)
    {
        builder.ToTable("guests", t =>
        {
            t.HasCheckConstraint("ck_guests_people", $"number_of_people BETWEEN 1 AND {Guest.MaxPeoplePerGroup}");
            t.HasCheckConstraint("ck_guests_type", "guest_type IN ('Individual','Group')");
        });

        builder.Property(g => g.Id).ValueGeneratedNever();
        builder.Property(g => g.Name).HasMaxLength(120);
        builder.Property(g => g.Phone).HasMaxLength(30);
        builder.Property(g => g.Email).HasColumnType("citext").HasMaxLength(254);
        builder.Property(g => g.Type).HasColumnName("guest_type").HasConversion<string>().HasMaxLength(20);

        builder.HasOne<Event>().WithMany().HasForeignKey(g => g.EventId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(g => g.Sessions).WithOne().HasForeignKey(s => s.GuestId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(g => g.Invitation).WithOne().HasForeignKey<Invitation>(i => i.GuestId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(g => new { g.EventId, g.Name }).HasFilter("deleted_at IS NULL");
    }
}

public sealed class GuestSessionConfiguration : IEntityTypeConfiguration<GuestSession>
{
    public void Configure(EntityTypeBuilder<GuestSession> builder)
    {
        builder.ToTable("guest_sessions");
        builder.HasKey(s => new { s.GuestId, s.SessionId });
        // Removing a session from the event removes it from every guest's invitation.
        builder.HasOne<EventSession>().WithMany().HasForeignKey(s => s.SessionId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(s => s.SessionId);
    }
}

public sealed class InvitationConfiguration : IEntityTypeConfiguration<Invitation>
{
    public void Configure(EntityTypeBuilder<Invitation> builder)
    {
        builder.ToTable("invitations", t =>
        {
            t.HasCheckConstraint("ck_invitations_type", "type IN ('Individual','Group')");
            t.HasCheckConstraint("ck_invitations_status", "status IN ('Active','Revoked')");
        });

        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Code).HasMaxLength(InvitationCode.Length).IsFixedLength();
        builder.Property(i => i.Type).HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.Status).HasConversion<string>().HasMaxLength(20);

        builder.HasOne<Event>().WithMany().HasForeignKey(i => i.EventId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(i => i.Code).IsUnique().HasDatabaseName("ux_invitations_code");
        builder.HasIndex(i => i.GuestId).IsUnique().HasDatabaseName("ux_invitations_guest");
        builder.HasIndex(i => new { i.EventId, i.Status }).HasDatabaseName("ix_invitations_event_status");
    }
}
