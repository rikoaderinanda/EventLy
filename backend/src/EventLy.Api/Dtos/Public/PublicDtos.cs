using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.Public;

/// <summary>
/// What a guest sees on their invitation page. Only this invitation's data and the event's public
/// content: no other guest's details, no ids, no package or payment information.
/// </summary>
public sealed record PublicInvitationDto(
    string GuestName,
    GuestType Type,
    int NumberOfPeople,
    PublicEventDto Event,
    PublicRsvpDto Rsvp,
    PublicFeaturesDto Features,
    string? MyWish,
    bool CheckedIn);

/// <summary><see cref="Sessions"/> holds only the sessions this guest is invited to (Q-38), in order.</summary>
public sealed record PublicEventDto(
    string Name,
    EventCategory Category,
    string? Description,
    string TimeZone,
    EventStatus Status,
    string? CoverUrl,
    IReadOnlyList<PublicSessionDto> Sessions);

public sealed record PublicSessionDto(
    string Name,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    DateTime StartsAtLocal,
    DateTime EndsAtLocal,
    string Venue,
    string? MapsUrl,
    bool IsCheckInSession);

/// <summary><see cref="ClosesAt"/> is when the last session ends; after it the answer can't change (Q-47).</summary>
public sealed record PublicRsvpDto(RsvpStatus Status, DateTimeOffset? RespondedAt, bool IsOpen, DateTimeOffset ClosesAt);

/// <summary>Package flags (Q-45) combined with the time windows; music also needs an uploaded file.</summary>
public sealed record PublicFeaturesDto(bool Countdown, bool Wishes, bool WishesOpen, bool DigitalGift, bool BackgroundMusic);

public sealed record UpdateRsvpRequest(RsvpStatus Status);

public sealed record PublicWishDto(string GuestName, string Message, DateTimeOffset CreatedAt, bool IsMine);

public sealed record PublicWishPageDto(IReadOnlyList<PublicWishDto> Wishes, int Page, bool HasMore);

public sealed record UpdateWishRequest(string Message);

public sealed record GiftAccountDto(GiftAccountKind Kind, string Provider, string AccountNumber, string AccountHolder);

/// <summary><see cref="QrisUrl"/> is a signed URL of the QRIS image, or null when there is none.</summary>
public sealed record PublicGiftsDto(IReadOnlyList<GiftAccountDto> Accounts, string? Address, string? QrisUrl);

public sealed record CreateGiftConfirmationRequest(string SenderName, decimal? Amount, string? Note);
