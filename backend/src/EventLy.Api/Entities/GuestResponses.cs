namespace EventLy.Api.Entities;

public enum RsvpStatus
{
    /// <summary>No answer yet. An invitation without an RSVP row is pending too.</summary>
    Pending,
    Attending,
    NotAttending,
}

/// <summary>The guest's answer, one row per invitation, changed in place until the cut-off.</summary>
public sealed class Rsvp : ITenantOwned, IHasTimestamps
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public Guid InvitationId { get; init; }

    public RsvpStatus Status { get; set; } = RsvpStatus.Pending;

    public DateTimeOffset? RespondedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>Ucapan &amp; doa (decision Q-42): one message per invitation, seen by every guest of the event.</summary>
public sealed class Wish : ITenantOwned, IHasTimestamps
{
    public const int MaxLength = 500;

    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public Guid EventId { get; init; }

    public Guid InvitationId { get; init; }

    /// <summary>Plain text; the page escapes it when it is shown.</summary>
    public required string Message { get; set; }

    /// <summary>Hidden by Owner/Admin: guests no longer see it.</summary>
    public bool IsHidden { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

public enum GiftAccountKind
{
    Bank,
    EWallet,
}

/// <summary>
/// Amplop digital (decision Q-41): an account guests transfer to directly. Display only, EventLy never
/// holds the money.
/// </summary>
public sealed class GiftAccount : ITenantOwned
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public Guid EventId { get; init; }

    public GiftAccountKind Kind { get; set; }

    /// <summary>For example BSI, BCA, GoPay, DANA.</summary>
    public required string Provider { get; set; }

    public required string AccountNumber { get; set; }

    public required string AccountHolder { get; set; }

    public int SortOrder { get; set; }
}

/// <summary>Optional "konfirmasi hadiah" from a guest, visible only to Owner/Admin (Q-41).</summary>
public sealed class GiftConfirmation : ITenantOwned
{
    public const int MaxPerInvitation = 5;

    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public Guid EventId { get; init; }

    public Guid InvitationId { get; init; }

    public required string SenderName { get; init; }

    public decimal? Amount { get; init; }

    public string? Note { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
