using EventLy.Api.Dtos.Public;
using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.Guests;

/// <summary>RSVP monitor row: one per invitation, with the guest it belongs to.</summary>
public sealed record RsvpListItemDto(
    Guid InvitationId,
    Guid GuestId,
    string GuestName,
    GuestType GuestType,
    int NumberOfPeople,
    RsvpStatus Status,
    DateTimeOffset? RespondedAt,
    DateTimeOffset? OpenedAt,
    InvitationStatus InvitationStatus);

/// <summary>Counts over active invitations. <see cref="ExpectedPeople"/> adds up the people of attending invitations.</summary>
public sealed record RsvpSummaryDto(int Invitations, int Opened, int Pending, int Attending, int NotAttending, int ExpectedPeople);

public sealed record OrganizerWishDto(
    Guid Id,
    Guid InvitationId,
    string GuestName,
    string Message,
    bool IsHidden,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record EventGiftsDto(IReadOnlyList<GiftAccountDto> Accounts, string? Address);

/// <summary>Replaces the event's accounts and gift address.</summary>
public sealed record UpdateEventGiftsRequest(IReadOnlyList<GiftAccountDto> Accounts, string? Address);

public sealed record GiftConfirmationDto(
    Guid Id,
    Guid InvitationId,
    string GuestName,
    string SenderName,
    decimal? Amount,
    string? Note,
    DateTimeOffset CreatedAt);
