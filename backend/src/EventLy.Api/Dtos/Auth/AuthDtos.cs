using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.Auth;

public sealed record GoogleSignInRequest(string IdToken);

/// <summary>Development/Testing only: signs in as this email without Google.</summary>
public sealed record DevSignInRequest(string Email, string? Name);

/// <summary>What the login and onboarding pages need. All values are public.</summary>
public sealed record AuthConfigResponse(string? GoogleClientId, bool DevSignInEnabled, string TermsVersion);

public sealed record CurrentUserDto(
    Guid Id,
    string Name,
    string Email,
    string? AvatarUrl,
    UserRole Role,
    UserStatus Status,
    Guid? OrganizationId,
    IReadOnlyList<string> Permissions);

/// <summary>Returned by sign-in and refresh. The refresh token itself travels only in the HttpOnly cookie.</summary>
public sealed record AuthResponse(string AccessToken, int ExpiresIn, CurrentUserDto User, bool IsNewUser = false);
