using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.CheckIns;

/// <summary>
/// A scanned QR (the invitation URL or the bare code), or an invitation picked from the name search
/// (manual entry). Exactly one of the two.
/// </summary>
public sealed record CheckInRequest(string? Code, Guid? InvitationId);

public static class CheckInWarnings
{
    /// <summary>The guest is invited only to other sessions, for example the akad (Q-53). Allowed, with a warning.</summary>
    public const string NotInvitedToCheckInSession = "not_invited_to_check_in_session";

    /// <summary>The guest answered "not attending"; checking in changes it to attending (Q-49).</summary>
    public const string RsvpNotAttending = "rsvp_not_attending";
}

/// <summary>
/// What Staff see for a scanned guest, before and after committing. <see cref="AlreadyCheckedIn"/> with
/// <see cref="CheckedInAt"/> and <see cref="CheckedInBy"/> tells a repeat scan apart.
/// </summary>
public sealed record CheckInResultDto(
    Guid InvitationId,
    string GuestName,
    GuestType Type,
    int NumberOfPeople,
    RsvpStatus Rsvp,
    bool AlreadyCheckedIn,
    DateTimeOffset? CheckedInAt,
    string? CheckedInBy,
    IReadOnlyList<string> Warnings);

/// <summary>A name search hit for manual entry.</summary>
public sealed record CheckInSearchItemDto(Guid InvitationId, string GuestName, GuestType Type, int NumberOfPeople, bool CheckedIn);

public sealed record CheckInSummaryDto(int Invitations, int People, int CheckedInInvitations, int CheckedInPeople);

public sealed record CheckInLogItemDto(
    Guid Id,
    Guid InvitationId,
    string GuestName,
    int NumberOfPeople,
    DateTimeOffset CheckedInAt,
    Guid StaffId,
    string StaffName,
    CheckInMethod Method);
