using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EventLy.Api.Data.Configurations;

public sealed class PhotoConfiguration : IEntityTypeConfiguration<Photo>
{
    public void Configure(EntityTypeBuilder<Photo> builder)
    {
        builder.ToTable("photos", t => t.HasCheckConstraint("ck_photos_source", "source IN ('Staff','Owner','Guest')"));

        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Source).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.ObjectKey).HasMaxLength(512);
        builder.Property(p => p.ThumbnailKey).HasMaxLength(512);
        builder.Property(p => p.ContentType).HasMaxLength(40);

        builder.HasOne<Event>().WithMany().HasForeignKey(p => p.EventId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Invitation>().WithMany().HasForeignKey(p => p.InvitationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(p => p.UploadedBy).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(p => new { p.InvitationId, p.CreatedAt }).HasDatabaseName("ix_photos_invitation");
        builder.HasIndex(p => new { p.EventId, p.CreatedAt }).IsDescending(false, true);
    }
}
