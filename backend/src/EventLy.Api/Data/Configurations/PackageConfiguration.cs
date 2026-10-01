using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EventLy.Api.Data.Configurations;

public sealed class PackageConfiguration : IEntityTypeConfiguration<Package>
{
    public void Configure(EntityTypeBuilder<Package> builder)
    {
        builder.ToTable("packages", t => t.HasCheckConstraint("ck_packages_price", "price >= 0"));

        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Code).HasMaxLength(30);
        builder.Property(p => p.Name).HasMaxLength(80);
        builder.Property(p => p.Price).HasPrecision(12, 2);
        builder.Property(p => p.Currency).HasMaxLength(3).IsFixedLength();
        builder.OwnsOne(p => p.Features, f => f.ToJson("feature"));

        builder.HasIndex(p => p.Code).IsUnique();
    }
}
