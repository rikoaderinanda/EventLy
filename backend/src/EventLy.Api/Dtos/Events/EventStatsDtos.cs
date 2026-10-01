namespace EventLy.Api.Dtos.Events;

/// <summary>
/// The numbers of one event for the dashboard and the statistics page (Q-60). Counts are of active
/// invitations of guests still on the list; "people" counts each invitation's number of people (Q-46).
/// </summary>
public sealed record EventStatsDto(
    Guid EventId,
    GuestStatsDto Guests,
    RsvpStatsDto Rsvp,
    CheckInStatsDto CheckIns,
    int Wishes,
    GiftStatsDto Gifts,
    PhotoStatsDto Photos,
    int Staff);

/// <param name="PeopleLimit">The package's <c>maxGuests</c>; null before payment.</param>
/// <param name="Opened">Invitations whose link the guest has opened at least once.</param>
public sealed record GuestStatsDto(int Invitations, int People, int? PeopleLimit, int Opened);

/// <summary>Invitations by answer; an invitation without an answer is pending.</summary>
public sealed record RsvpStatsDto(int Attending, int NotAttending, int Pending, int AttendingPeople);

/// <param name="ByHour">People checked in per hour (start of the hour, UTC), oldest first; only hours with check-ins.</param>
public sealed record CheckInStatsDto(int Invitations, int People, IReadOnlyList<HourCountDto> ByHour);

public sealed record HourCountDto(DateTimeOffset Hour, int People);

/// <summary>Guests' optional "Konfirmasi hadiah" (Q-41): how many, and the sum of the amounts they wrote.</summary>
public sealed record GiftStatsDto(int Confirmations, decimal Amount);

/// <param name="Limit">The package's <c>maxPhotos</c>; null before payment.</param>
public sealed record PhotoStatsDto(int Count, int? Limit);
