using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EventLy.Api.Data.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users", t =>
        {
            t.HasCheckConstraint("ck_users_role", "role IN ('Root','Owner','Admin','Staff')");
            t.HasCheckConstraint("ck_users_status", "status IN ('Invited','Active','Disabled')");
        });

        builder.Property(u => u.Id).ValueGeneratedNever();
        builder.Property(u => u.Name).HasMaxLength(100);
        builder.Property(u => u.Email).HasColumnType("citext").HasMaxLength(254);
        builder.Property(u => u.GoogleSubject).HasMaxLength(255);
        builder.Property(u => u.AvatarUrl).HasMaxLength(2048);
        builder.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
        builder.Property(u => u.Status).HasConversion<string>().HasMaxLength(20);

        builder.HasIndex(u => u.Email).IsUnique();
        builder.HasIndex(u => u.GoogleSubject).IsUnique().HasFilter("google_subject IS NOT NULL");
        builder.HasIndex(u => new { u.OrganizationId, u.Role });
    }
}
