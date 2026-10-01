using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EventLy.Api.Data.Configurations;

public sealed class CheckInConfiguration : IEntityTypeConfiguration<CheckIn>
{
    public void Configure(EntityTypeBuilder<CheckIn> builder)
    {
        builder.ToTable("check_ins", t => t.HasCheckConstraint("ck_check_ins_method", "method IN ('Scan','Manual')"));

        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.Method).HasConversion<string>().HasMaxLength(20);

        builder.HasOne<Event>().WithMany().HasForeignKey(c => c.EventId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Invitation>().WithOne().HasForeignKey<CheckIn>(c => c.InvitationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(c => c.CheckedInBy).OnDelete(DeleteBehavior.Restrict);

        // One invitation = one check-in: concurrent scans can't create a second row.
        builder.HasIndex(c => c.InvitationId).IsUnique().HasDatabaseName("ux_check_ins_invitation");
        builder.HasIndex(c => new { c.EventId, c.CheckedInAt }).IsDescending(false, true);
        builder.HasIndex(c => new { c.CheckedInBy, c.CheckedInAt }).IsDescending(false, true);
    }
}
