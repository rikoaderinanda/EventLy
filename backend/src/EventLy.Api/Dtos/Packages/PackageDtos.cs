using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.Packages;

public sealed record PackageDto(
    Guid Id,
    string Code,
    string Name,
    decimal Price,
    string Currency,
    PackageFeatures Features,
    bool IsActive);

/// <summary>Root creates a package. <see cref="Code"/> can't change afterwards.</summary>
public sealed record CreatePackageRequest(
    string Code,
    string Name,
    decimal Price,
    string Currency,
    PackageFeatures Features,
    bool IsActive) : IPackageInput;

/// <summary>Changes apply to new checkouts only; paid events keep their snapshot (Q-20).</summary>
public sealed record UpdatePackageRequest(
    string Name,
    decimal Price,
    string Currency,
    PackageFeatures Features,
    bool IsActive) : IPackageInput;

/// <summary>The fields create and update share, so both use one validator.</summary>
public interface IPackageInput
{
    string Name { get; }

    decimal Price { get; }

    string Currency { get; }

    PackageFeatures Features { get; }
}
