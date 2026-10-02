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
    OwnerPurchaseSummaryDto Purchases,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastSignInAt);

/// <summary>Counts shown in Root's Owner list.</summary>
public sealed record OwnerPurchaseSummaryDto(int Events, int PaidEvents, int PendingPayments);

public sealed record PlatformEventDto(
    Guid Id,
    string Name,
    DateTimeOffset Date,
    string TimeZone,
    EventStatus Status,
    string? PackageName);

public sealed record PlatformPaymentDto(
    Guid Id,
    Guid EventId,
    string EventName,
    string PackageName,
    decimal Amount,
    string Currency,
    PaymentStatus Status,
    PaymentProvider Provider,
    string? Reference,
    DateTimeOffset? PaidAt,
    string? Note,
    DateTimeOffset CreatedAt);

/// <summary>An Owner with their events and purchase history. Still no guests, invitations or photos (Q-24).</summary>
public sealed record PlatformOwnerDetailDto(
    PlatformOwnerDto Owner,
    IReadOnlyList<PlatformEventDto> Events,
    IReadOnlyList<PlatformPaymentDto> Payments);
