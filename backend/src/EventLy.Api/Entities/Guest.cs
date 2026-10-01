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

    /// <summary>
    /// <see cref="Phone"/> as international digits (628…), so "0812-3456-7890" and "+62 812 3456 7890" are
    /// one number. Unique per event (decision Q-55); null without a phone.
    /// </summary>
    public string? PhoneKey { get; set; }

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

/// <summary>How guest names are compared and stored: trimmed, single spaces. Case is ignored by the column (citext).</summary>
public static class GuestNames
{
    public static string Normalize(string name) =>
        string.Join(' ', name.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}

public static class InvitationCode
{
    public const int Length = 22;

    /// <summary>128 bits from the CSPRNG as base64url: 22 characters that can't be guessed.</summary>
    public static string New() => Base64UrlEncode(RandomNumberGenerator.GetBytes(16));

    /// <summary>
    /// The code from what a scanner read: the invitation URL <c>https://host/i/{code}</c> (the QR payload,
    /// Q-8) or the bare code typed in. Anything else is returned trimmed and then fails <see cref="IsWellFormed"/>.
    /// </summary>
    public static string FromScan(string? scanned)
    {
        var text = (scanned ?? "").Trim();
        var marker = text.LastIndexOf("/i/", StringComparison.Ordinal);
        if (marker >= 0)
        {
            text = text[(marker + 3)..];
        }
        var end = text.IndexOfAny(['?', '#', '/']);
        return end >= 0 ? text[..end] : text;
    }

    /// <summary>A cheap shape check before any database lookup.</summary>
    public static bool IsWellFormed(string? code) =>
        code is { Length: Length } && code.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
