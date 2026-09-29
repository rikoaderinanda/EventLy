namespace EventLy.Api.Auth;

/// <summary>Claim names in EventLy access tokens (inbound claim mapping is off, so these arrive unchanged).</summary>
public static class AuthClaims
{
    public const string UserId = "sub";
    public const string Email = "email";
    public const string Name = "name";
    public const string Role = "role";

    /// <summary>The tenant. Absent for Root and for an Owner who hasn't created an organization yet.</summary>
    public const string OrganizationId = "org_id";
}
