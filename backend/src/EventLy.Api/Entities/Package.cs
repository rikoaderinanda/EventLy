namespace EventLy.Api.Entities;

/// <summary>
/// A paid plan in the catalog. Root edits price, limits and active status (decision Q-2); packages are
/// never hard-deleted because events and payments reference them, only deactivated.
/// </summary>
public sealed class Package : IHasTimestamps
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    /// <summary>Stable identifier (BASIC, PREMIUM...), used by the seed. Can't change after creation.</summary>
    public required string Code { get; init; }

    public required string Name { get; set; }

    public decimal Price { get; set; }

    public string Currency { get; set; } = Currencies.Idr;

    /// <summary>Limits and feature flags, stored as jsonb.</summary>
    public PackageFeatures Features { get; set; } = new();

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>Limits and flags of a package (docs/architecture/02-database-erd.md §5). Later phases read them from here.</summary>
public sealed class PackageFeatures
{
    public int MaxGuests { get; set; }

    public int MaxPhotos { get; set; }

    public int MaxStaff { get; set; }

    public int MaxAdmins { get; set; }

    public int GalleryRetentionDays { get; set; }

    public bool ZipDownload { get; set; }

    public bool ExcelExport { get; set; }

    public bool GuestUploadEnabled { get; set; }

    public int MaxGuestPhotosPerInvitation { get; set; }

    public bool WishesEnabled { get; set; }

    public bool DigitalGiftEnabled { get; set; }

    public bool BackgroundMusicEnabled { get; set; }

    public bool CountdownEnabled { get; set; }

    /// <summary>EF stores features as an owned value, and one instance can't belong to two rows.</summary>
    public PackageFeatures Copy() => (PackageFeatures)MemberwiseClone();
}

/// <summary>
/// The package as it was when the Owner paid (decision Q-20): later edits by Root don't change the
/// price or limits of an event that is already paid for.
/// </summary>
public sealed class PackageSnapshot
{
    public Guid PackageId { get; set; }

    public string Code { get; set; } = "";

    public string Name { get; set; } = "";

    public decimal Price { get; set; }

    public string Currency { get; set; } = Currencies.Idr;

    public PackageFeatures Features { get; set; } = new();

    public static PackageSnapshot Of(Package package) => new()
    {
        PackageId = package.Id,
        Code = package.Code,
        Name = package.Name,
        Price = package.Price,
        Currency = package.Currency,
        Features = package.Features.Copy(),
    };

    public PackageSnapshot Copy() => new()
    {
        PackageId = PackageId,
        Code = Code,
        Name = Name,
        Price = Price,
        Currency = Currency,
        Features = Features.Copy(),
    };
}

public static class Currencies
{
    public const string Idr = "IDR";
}
