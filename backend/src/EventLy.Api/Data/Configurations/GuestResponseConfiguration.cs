using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EventLy.Api.Data.Configurations;

public sealed class RsvpConfiguration : IEntityTypeConfiguration<Rsvp>
{
    public void Configure(EntityTypeBuilder<Rsvp> builder)
    {
        builder.ToTable("rsvps", t => t.HasCheckConstraint("ck_rsvps_status", "status IN ('Pending','Attending','NotAttending')"));
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
        builder.HasOne<Invitation>().WithOne().HasForeignKey<Rsvp>(r => r.InvitationId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(r => r.InvitationId).IsUnique().HasDatabaseName("ux_rsvps_invitation");
    }
}

public sealed class WishConfiguration : IEntityTypeConfiguration<Wish>
{
    public void Configure(EntityTypeBuilder<Wish> builder)
    {
        builder.ToTable("wishes");
        builder.Property(w => w.Id).ValueGeneratedNever();
        builder.Property(w => w.Message).HasMaxLength(Wish.MaxLength);
        builder.HasOne<Event>().WithMany().HasForeignKey(w => w.EventId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Invitation>().WithOne().HasForeignKey<Wish>(w => w.InvitationId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(w => w.InvitationId).IsUnique();
        builder.HasIndex(w => new { w.EventId, w.CreatedAt }).IsDescending(false, true);
    }
}

public sealed class GiftAccountConfiguration : IEntityTypeConfiguration<GiftAccount>
{
    public void Configure(EntityTypeBuilder<GiftAccount> builder)
    {
        builder.ToTable("gift_accounts", t => t.HasCheckConstraint("ck_gift_accounts_kind", "kind IN ('Bank','EWallet')"));
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(a => a.Provider).HasMaxLength(60);
        builder.Property(a => a.AccountNumber).HasMaxLength(40);
        builder.Property(a => a.AccountHolder).HasMaxLength(100);
        builder.HasOne<Event>().WithMany().HasForeignKey(a => a.EventId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(a => new { a.EventId, a.SortOrder });
    }
}

public sealed class GiftConfirmationConfiguration : IEntityTypeConfiguration<GiftConfirmation>
{
    public void Configure(EntityTypeBuilder<GiftConfirmation> builder)
    {
        builder.ToTable("gift_confirmations", t => t.HasCheckConstraint("ck_gift_confirmations_amount", "amount IS NULL OR amount > 0"));
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.SenderName).HasMaxLength(100);
        builder.Property(c => c.Amount).HasPrecision(14, 2);
        builder.Property(c => c.Note).HasMaxLength(300);
        builder.HasOne<Event>().WithMany().HasForeignKey(c => c.EventId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Invitation>().WithMany().HasForeignKey(c => c.InvitationId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(c => new { c.EventId, c.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(c => c.InvitationId);
    }
}
