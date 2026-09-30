namespace EventLy.Api.Entities;

public enum EventCategory
{
    Wedding,
    Corporate,
    Birthday,
    Community,
    Other,
}

/// <summary>
/// Lifecycle (decision Q-4): Draft → PendingPayment → Active → Completed, or Cancelled.
/// PendingPayment and Active are reached through payment (Phase 5).
/// </summary>
public enum EventStatus
{
    Draft,
    PendingPayment,
    Active,
    Completed,
    Cancelled,
}

public sealed class Event : ITenantOwned, ISoftDeletable, IHasTimestamps
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public required string Name { get; set; }

    public EventCategory Category { get; set; }

    /// <summary>Couple's names and greeting shown on the invitation page.</summary>
    public string? Description { get; set; }

    /// <summary>IANA time zone of the venue (WIB/WITA/WIT). Session times are entered in it.</summary>
    public string TimeZone { get; set; } = EventTimeZones.Default;

    /// <summary>Start of the check-in session (the spec's Event.Date), kept in sync with <see cref="Sessions"/>.</summary>
    public DateTimeOffset Date { get; set; }

    /// <summary>Venue of the check-in session (the spec's Event.Venue), kept in sync.</summary>
    public string Venue { get; set; } = "";

    /// <summary>Chosen package; set when paying (Phase 5).</summary>
    public Guid? PackageId { get; set; }

    public EventStatus Status { get; set; } = EventStatus.Draft;

    public DateTimeOffset? ActivatedAt { get; set; }

    /// <summary>Object key of the cover photo in storage (upload arrives with storage in Phase 9).</summary>
    public string? CoverImageKey { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    /// <summary>PostgreSQL xmin, used as an optimistic concurrency token.</summary>
    public uint Version { get; set; }

    public List<EventSession> Sessions { get; init; } = [];

    public List<EventStaffAssignment> StaffAssignments { get; init; } = [];

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public EventSession CheckInSession => Sessions.Single(s => s.IsCheckInSession);

    /// <summary>Copies the check-in session's start and venue into <see cref="Date"/> and <see cref="Venue"/>.</summary>
    public void SyncFromCheckInSession()
    {
        var checkIn = CheckInSession;
        Date = checkIn.StartsAt;
        Venue = checkIn.Venue;
    }
}

/// <summary>A part of the event, for example "Akad Nikah" or "Resepsi" (decision Q-28).</summary>
public sealed class EventSession : ITenantOwned
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public Guid EventId { get; init; }

    public required string Name { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public required string Venue { get; set; }

    public string? MapsUrl { get; set; }

    /// <summary>Exactly one per event: where guests check in (the resepsi).</summary>
    public bool IsCheckInSession { get; set; }

    public int SortOrder { get; set; }
}

/// <summary>A Staff member who may check in guests and take photos at this event.</summary>
public sealed class EventStaffAssignment : ITenantOwned
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public Guid EventId { get; init; }

    public Guid UserId { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>Indonesian time zones offered for events (WIB, WITA, WIT).</summary>
public static class EventTimeZones
{
    public const string Default = "Asia/Jakarta";

    public static readonly IReadOnlyList<string> Allowed = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"];

    public static TimeZoneInfo Find(string id) => TimeZoneInfo.FindSystemTimeZoneById(id);
}
