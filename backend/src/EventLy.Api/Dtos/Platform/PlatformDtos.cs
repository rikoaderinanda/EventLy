using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.Platform;

public sealed record OwnerOrganizationDto(Guid Id, string Name, OrganizationStatus Status);

/// <summary>What Root sees of an Owner (no guests, invitations or photos: customer privacy, decision Q-24).</summary>
public sealed record PlatformOwnerDto(
    Guid Id,
    string Name,
    string Email,
    UserStatus Status,
    OwnerOrganizationDto? Organization,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastSignInAt);
