using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Data.Seed;

/// <summary>
/// The initial package catalog (docs/architecture/02-database-erd.md §5, prices from decision Q-37).
/// Runs with the migrations and only adds codes that don't exist yet, so Root's edits are never overwritten.
/// </summary>
public static class PackageSeed
{
    public static IReadOnlyList<Package> Initial() =>
    [
        new()
        {
            Code = "BASIC",
            Name = "Basic",
            Price = 150_000m,
            Features = Features(maxGuests: 150, maxPhotos: 300, maxStaff: 2, maxAdmins: 1, retentionDays: 30,
                premium: false, guestPhotos: 0),
        },
        new()
        {
            Code = "PREMIUM",
            Name = "Premium",
            Price = 350_000m,
            Features = Features(maxGuests: 500, maxPhotos: 1_500, maxStaff: 5, maxAdmins: 2, retentionDays: 90,
                premium: true, guestPhotos: 5),
        },
        new()
        {
            Code = "ENTERPRISE",
            Name = "Enterprise",
            Price = 1_000_000m,
            Features = Features(maxGuests: 5_000, maxPhotos: 10_000, maxStaff: 20, maxAdmins: 5, retentionDays: 365,
                premium: true, guestPhotos: 10),
        },
    ];

    public static async Task<int> SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        var existing = await db.Packages.Select(p => p.Code).ToListAsync(ct);
        var missing = Initial().Where(p => !existing.Contains(p.Code)).ToList();
        db.Packages.AddRange(missing);
        await db.SaveChangesAsync(ct);
        return missing.Count;
    }

    private static PackageFeatures Features(
        int maxGuests, int maxPhotos, int maxStaff, int maxAdmins, int retentionDays, bool premium, int guestPhotos) => new()
    {
        MaxGuests = maxGuests,
        MaxPhotos = maxPhotos,
        MaxStaff = maxStaff,
        MaxAdmins = maxAdmins,
        GalleryRetentionDays = retentionDays,
        ZipDownload = premium,
        ExcelExport = premium,
        GuestUploadEnabled = guestPhotos > 0,
        MaxGuestPhotosPerInvitation = guestPhotos,
        WishesEnabled = true,
        DigitalGiftEnabled = true,
        BackgroundMusicEnabled = true,
        CountdownEnabled = true,
    };
}
