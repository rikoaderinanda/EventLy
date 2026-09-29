namespace EventLy.Api.Entities;

/// <summary>
/// One issued refresh token. Only the SHA-256 hash is stored. Each use rotates it: the old row is
/// revoked and points to its replacement. Tokens issued from one sign-in share a <see cref="FamilyId"/>,
/// so presenting an already-revoked token (theft/reuse) revokes the whole family.
/// </summary>
public sealed class RefreshToken
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid UserId { get; init; }

    public User User { get; init; } = null!;

    public required string TokenHash { get; init; }

    public Guid FamilyId { get; init; }

    /// <summary>The user's security stamp at issue time; a later change invalidates the token.</summary>
    public Guid SecurityStamp { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset ExpiresAt { get; init; }

    public DateTimeOffset? RevokedAt { get; set; }

    public Guid? ReplacedById { get; set; }

    public bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;
}
