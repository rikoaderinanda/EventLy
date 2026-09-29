using EventLy.Api.Common.Errors;
using EventLy.Api.Entities;

namespace EventLy.Api.Auth;

/// <summary>
/// The signed-in user, read only from the validated access token (never from the route or body).
/// It is an interface because the tenant filter (Phase 3) and background work need to supply it
/// without an HTTP request.
/// </summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }

    Guid? UserId { get; }

    Guid? OrganizationId { get; }

    UserRole? Role { get; }
}

public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private System.Security.Claims.ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid? UserId => ParseGuid(AuthClaims.UserId);

    public Guid? OrganizationId => ParseGuid(AuthClaims.OrganizationId);

    public UserRole? Role =>
        IsAuthenticated && Enum.TryParse<UserRole>(Principal!.FindFirst(AuthClaims.Role)?.Value, out var role)
            ? role
            : null;

    private Guid? ParseGuid(string claim) =>
        IsAuthenticated && Guid.TryParse(Principal!.FindFirst(claim)?.Value, out var value) ? value : null;
}

public static class CurrentUserExtensions
{
    public static Guid RequireUserId(this ICurrentUser user) =>
        user.UserId ?? throw new UnauthorizedException("auth.unauthenticated", "Sign-in required.");

    /// <summary>The caller's organization, or 403 <c>organization.required</c> (Root, or an Owner before onboarding).</summary>
    public static Guid RequireOrganizationId(this ICurrentUser user) =>
        user.OrganizationId ?? throw new ForbiddenException(
            "organization.required", "Create or join an organization first.");
}
