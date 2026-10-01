using System.Text.Json;
using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace EventLy.Api.Services;

/// <summary>
/// The package catalog. Owners and Admins read the active packages (cached for an hour); Root
/// creates and edits packages, which evicts the cache. Packages are never deleted, only deactivated.
/// </summary>
public sealed class PackageService(AppDbContext db, ICurrentUser currentUser, AuditService audit, IDistributedCache cache)
{
    public const string CatalogCacheKey = "pkg:all";

    private static readonly DistributedCacheEntryOptions CatalogCacheOptions =
        new() { AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1) };

    public async Task<IReadOnlyList<PackageDto>> ListActiveAsync(CancellationToken ct)
    {
        if (await cache.GetStringAsync(CatalogCacheKey, ct) is { } cached
            && JsonSerializer.Deserialize<List<PackageDto>>(cached) is { } fromCache)
        {
            return fromCache;
        }

        var packages = await db.Packages.AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.Price).ThenBy(p => p.Code)
            .ToListAsync(ct);
        var dtos = packages.Select(ToDto).ToList();
        await cache.SetStringAsync(CatalogCacheKey, JsonSerializer.Serialize(dtos), CatalogCacheOptions, ct);
        return dtos;
    }

    /// <summary>An active package; inactive ones are no longer offered (404).</summary>
    public async Task<PackageDto> GetActiveAsync(Guid id, CancellationToken ct) =>
        ToDto(await db.Packages.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id && p.IsActive, ct)
            ?? throw NotFound());

    /// <summary>Root: every package, including inactive ones.</summary>
    public async Task<IReadOnlyList<PackageDto>> ListAllAsync(CancellationToken ct)
    {
        var packages = await db.Packages.AsNoTracking()
            .OrderByDescending(p => p.IsActive).ThenBy(p => p.Price).ThenBy(p => p.Code)
            .ToListAsync(ct);
        return packages.Select(ToDto).ToList();
    }

    public async Task<PackageDto> CreateAsync(CreatePackageRequest request, CancellationToken ct)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Packages.AnyAsync(p => p.Code == code, ct))
        {
            throw new ConflictException("package.code_taken", "A package with this code already exists.");
        }

        var package = new Package
        {
            Code = code,
            Name = request.Name.Trim(),
            Price = request.Price,
            Currency = request.Currency,
            Features = request.Features.Copy(),
            IsActive = request.IsActive,
        };
        db.Packages.Add(package);
        audit.Add(AuditActions.PackageCreated, currentUser.UserId, entityType: nameof(Package), entityId: package.Id,
            metadata: new { package.Code, package.Price });
        await db.SaveChangesAsync(ct);
        await cache.RemoveAsync(CatalogCacheKey, ct);
        return ToDto(package);
    }

    public async Task<PackageDto> UpdateAsync(Guid id, UpdatePackageRequest request, CancellationToken ct)
    {
        var package = await db.Packages.SingleOrDefaultAsync(p => p.Id == id, ct) ?? throw NotFound();
        var previousPrice = package.Price;

        package.Name = request.Name.Trim();
        package.Price = request.Price;
        package.Currency = request.Currency;
        package.Features = request.Features.Copy();
        package.IsActive = request.IsActive;

        audit.Add(AuditActions.PackageUpdated, currentUser.UserId, entityType: nameof(Package), entityId: package.Id,
            metadata: new { package.Code, previousPrice, package.Price, package.IsActive });
        await db.SaveChangesAsync(ct);
        await cache.RemoveAsync(CatalogCacheKey, ct);
        return ToDto(package);
    }

    private static PackageDto ToDto(Package p) =>
        new(p.Id, p.Code, p.Name, p.Price, p.Currency, p.Features, p.IsActive);

    private static NotFoundException NotFound() => new("package.not_found", "Package not found.");
}
