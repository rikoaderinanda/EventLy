using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EventLy.Api.Data.Configurations;

public sealed class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.ToTable("organizations", t =>
            t.HasCheckConstraint("ck_organizations_status", "status IN ('Active','Suspended')"));

        builder.Property(o => o.Id).ValueGeneratedNever();
        builder.Property(o => o.Name).HasMaxLength(120);
        builder.Property(o => o.ContactEmail).HasColumnType("citext").HasMaxLength(254);
        builder.Property(o => o.ContactPhone).HasMaxLength(30);
        builder.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);

        // One Owner has one organization, enforced by the database too.
        builder.HasIndex(o => o.OwnerUserId).IsUnique();
        builder.HasOne<User>().WithMany().HasForeignKey(o => o.OwnerUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
