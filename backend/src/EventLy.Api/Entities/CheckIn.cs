namespace EventLy.Api.Entities;

public enum CheckInMethod
{
    /// <summary>The invitation QR was scanned.</summary>
    Scan,

    /// <summary>Staff found the guest by name (no QR at hand, weak signal for the camera...).</summary>
    Manual,
}

/// <summary>
/// The guest arrived. One invitation is checked in once (unique index); a second scan returns this row.
/// </summary>
public sealed class CheckIn : ITenantOwned
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public Guid EventId { get; init; }

    public Guid InvitationId { get; init; }

    /// <summary>The Staff member (or Owner) who checked the guest in.</summary>
    public Guid CheckedInBy { get; init; }

    public DateTimeOffset CheckedInAt { get; init; }

    public CheckInMethod Method { get; init; }
}
