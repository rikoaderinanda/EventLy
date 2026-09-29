using System.Net;

namespace EventLy.Api.Entities;

/// <summary>Append-only record of security-relevant actions (sign-in, check-in, photo upload/delete...).</summary>
public sealed class AuditLog
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid? OrganizationId { get; init; }

    /// <summary>Null for guests and refused sign-ins.</summary>
    public Guid? UserId { get; init; }

    /// <summary>Stable action name, see <see cref="AuditActions"/>.</summary>
    public required string Action { get; init; }

    public DateTimeOffset Timestamp { get; init; }

    public string? EntityType { get; init; }

    public Guid? EntityId { get; init; }

    /// <summary>Extra details as JSON (no secrets, no tokens).</summary>
    public string? Metadata { get; init; }

    public IPAddress? IpAddress { get; init; }

    public string? UserAgent { get; init; }

    public string? CorrelationId { get; init; }
}

public static class AuditActions
{
    public const string SignIn = "auth.sign_in";
    public const string SignInRefused = "auth.sign_in_refused";
    public const string SignOut = "auth.sign_out";
    public const string RefreshTokenReuse = "auth.refresh_token_reuse";

    public const string OrganizationCreated = "organization.created";
    public const string OrganizationUpdated = "organization.updated";
    public const string OrganizationSuspended = "organization.suspended";
    public const string OrganizationReactivated = "organization.reactivated";

    public const string UserInvited = "user.invited";
    public const string UserUpdated = "user.updated";
    public const string UserInvitationCancelled = "user.invitation_cancelled";
}
