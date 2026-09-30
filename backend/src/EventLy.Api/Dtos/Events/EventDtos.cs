using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.Events;

/// <summary>
/// A session as entered by the organizer: local wall-clock times at the venue (no offset), converted
/// to UTC with the event's time zone. <see cref="Id"/> is set when editing an existing session.
/// </summary>
public sealed record EventSessionInput(
    Guid? Id,
    string Name,
    DateTime StartsAtLocal,
    DateTime EndsAtLocal,
    string Venue,
    string? MapsUrl,
    bool IsCheckInSession);

/// <summary>The fields create and update share, so both use one validator.</summary>
public interface IEventInput
{
    string Name { get; }

    EventCategory Category { get; }

    string TimeZone { get; }

    string? Description { get; }

    IReadOnlyList<EventSessionInput> Sessions { get; }
}

public sealed record CreateEventRequest(
    string Name,
    EventCategory Category,
    string TimeZone,
    string? Description,
    IReadOnlyList<EventSessionInput> Sessions) : IEventInput;

/// <summary><see cref="Version"/> is the value read with the event; a newer change elsewhere gives 409.</summary>
public sealed record UpdateEventRequest(
    string Name,
    EventCategory Category,
    string TimeZone,
    string? Description,
    IReadOnlyList<EventSessionInput> Sessions,
    uint Version) : IEventInput;

public sealed record EventSessionDto(
    Guid Id,
    string Name,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    DateTime StartsAtLocal,
    DateTime EndsAtLocal,
    string Venue,
    string? MapsUrl,
    bool IsCheckInSession);

public sealed record EventDto(
    Guid Id,
    string Name,
    EventCategory Category,
    string? Description,
    string TimeZone,
    DateTimeOffset Date,
    string Venue,
    EventStatus Status,
    IReadOnlyList<EventSessionDto> Sessions,
    int StaffCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    uint Version);

public sealed record EventListItemDto(
    Guid Id,
    string Name,
    EventCategory Category,
    string TimeZone,
    DateTimeOffset Date,
    string Venue,
    EventStatus Status);

public sealed record EventListQuery(EventStatus? Status, EventCategory? Category, DateTimeOffset? From, DateTimeOffset? To);

public sealed record EventStaffDto(Guid UserId, string Name, string Email, UserStatus Status);

public sealed record AssignStaffRequest(IReadOnlyList<Guid> UserIds);
