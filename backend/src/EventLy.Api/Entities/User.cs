namespace EventLy.Api.Entities;

public enum UserRole
{
    Root,
    Owner,
    Admin,
    Staff,
}

public enum UserStatus
{
    /// <summary>Registered by an Owner (Admin/Staff); becomes Active on the first Google sign-in.</summary>
    Invited,
    Active,
    Disabled,
}

/// <summary>
/// An account. Everyone signs in with Google, so there is no password.
/// Root has no organization; an Owner has none until they create one (Phase 3).
/// </summary>
public sealed class User : IHasTimestamps
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid? OrganizationId { get; set; }

    public required string Name { get; set; }

    public required string Email { get; set; }

    /// <summary>Google account id ("sub"); set on the first sign-in.</summary>
    public string? GoogleSubject { get; set; }

    public string? AvatarUrl { get; set; }

    public UserRole Role { get; set; }

    public UserStatus Status { get; set; } = UserStatus.Active;

    /// <summary>Changing it invalidates every refresh token of the user (role change, suspension).</summary>
    public Guid SecurityStamp { get; set; } = Guid.NewGuid();

    public DateTimeOffset? LastSignInAt { get; set; }

    /// <summary>Version of the Terms &amp; Privacy Policy the Owner accepted (UU PDP), and when.</summary>
    public string? TermsVersion { get; set; }

    public DateTimeOffset? TermsAcceptedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
