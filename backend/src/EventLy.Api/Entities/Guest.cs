using System.Security.Cryptography;

namespace EventLy.Api.Entities;

/// <summary>A group invitation stores only the number of people, no member names (decision Q-5).</summary>
public enum GuestType
{
    Individual,
    Group,
}

/// <summary>
/// Someone the organizer invites. Creating a guest creates their <see cref="Invitation"/> (1:1), which is
/// what the guest actually uses: link, QR, RSVP, check-in and photos all key off the invitation.
/// </summary>
public sealed class Guest : ITenantOwned, ISoftDeletable, IHasTimestamps
{
    public const int MaxPeoplePerGroup = 50;

    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public Guid EventId { get; init; }

    public required string Name { get; set; }

    /// <summary>For "Kirim via WhatsApp". Stored as entered; normalised when the link is built.</summary>
    public string? Phone { get; set; }

    public string? Email { get; set; }

    public GuestType Type { get; set; }

    /// <summary>1 for an individual, 2..50 for a group.</summary>
    public int NumberOfPeople { get; set; } = 1;

    /// <summary>The sessions this guest is invited to (decision Q-38).</summary>
    public List<GuestSession> Sessions { get; init; } = [];

    public Invitation? Invitation { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>Link between a guest and an event session they are invited to.</summary>
public sealed class GuestSession : ITenantOwned
{
    public Guid GuestId { get; init; }

    public Guid SessionId { get; init; }

    public Guid OrganizationId { get; set; }
}

public enum InvitationStatus
{
    Active,

    /// <summary>The link and QR no longer work. Regenerating the code makes it active again.</summary>
    Revoked,
}

/// <summary>
/// The guest's identity: the random <see cref="Code"/> in the link and the QR is their credential
/// (docs/architecture/01-system-architecture.md §6.2). The QR payload is the invitation URL, built from the code.
/// </summary>
public sealed class Invitation : ITenantOwned, IHasTimestamps
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public Guid EventId { get; init; }

    public Guid GuestId { get; init; }

    public string Code { get; set; } = InvitationCode.New();

    /// <summary>Follows the guest's type.</summary>
    public GuestType Type { get; set; }

    public InvitationStatus Status { get; set; } = InvitationStatus.Active;

    /// <summary>First time the guest opened the invitation page (Phase 7).</summary>
    public DateTimeOffset? OpenedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

public static class InvitationCode
{
    public const int Length = 22;

    /// <summary>128 bits from the CSPRNG as base64url: 22 characters that can't be guessed.</summary>
    public static string New() => Base64UrlEncode(RandomNumberGenerator.GetBytes(16));

    /// <summary>A cheap shape check before any database lookup.</summary>
    public static bool IsWellFormed(string? code) =>
        code is { Length: Length } && code.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
