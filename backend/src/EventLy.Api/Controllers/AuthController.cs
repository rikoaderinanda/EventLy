using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Dtos.Auth;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace EventLy.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(
    AuthService authService,
    IGoogleTokenValidator googleValidator,
    ICurrentUser currentUser,
    IOptions<AuthOptions> options,
    IHostEnvironment environment,
    TimeProvider timeProvider) : ControllerBase
{
    /// <summary>Cookie-based calls must send this header; a cross-site form can't, which blocks CSRF.</summary>
    public const string CsrfHeader = "X-Requested-With";

    public const string RefreshCookiePath = "/api/v1/auth";

    private readonly AuthOptions _options = options.Value;

    /// <summary>What the login page needs: the Google client id (public) and whether test sign-in is on.</summary>
    [HttpGet("config")]
    [AllowAnonymous]
    public AuthConfigResponse GetConfig() => new(
        string.IsNullOrWhiteSpace(_options.GoogleClientId) ? null : _options.GoogleClientId,
        AuthSetup.DevSignInAllowed(_options, environment));

    /// <summary>Sign in (or sign up as a new Owner) with a Google ID token.</summary>
    [HttpPost("google")]
    [AllowAnonymous]
    [EnableRateLimiting(AuthSetup.AuthRateLimitPolicy)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    public async Task<AuthResponse> SignInWithGoogle(GoogleSignInRequest request, CancellationToken ct)
    {
        var identity = await googleValidator.ValidateAsync(request.IdToken, ct);
        return Complete(await authService.SignInAsync(identity, ct));
    }

    /// <summary>Development/Testing only: sign in as an email without Google.</summary>
    [HttpPost("dev-sign-in")]
    [AllowAnonymous]
    [EnableRateLimiting(AuthSetup.AuthRateLimitPolicy)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    public async Task<AuthResponse> DevSignIn(DevSignInRequest request, CancellationToken ct)
    {
        if (!AuthSetup.DevSignInAllowed(_options, environment))
        {
            throw new NotFoundException("route.not_found", "Endpoint not found.");
        }

        var email = request.Email.Trim();
        var identity = new ExternalIdentity($"dev|{email.ToLowerInvariant()}", email,
            string.IsNullOrWhiteSpace(request.Name) ? email : request.Name.Trim(), AvatarUrl: null);
        return Complete(await authService.SignInAsync(identity, ct));
    }

    /// <summary>Swaps the refresh cookie for a new access token (and rotates the cookie).</summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting(AuthSetup.AuthRateLimitPolicy)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    public async Task<AuthResponse> Refresh(CancellationToken ct)
    {
        RequireCsrfHeader();
        try
        {
            return Complete(await authService.RefreshAsync(Request.Cookies[_options.RefreshCookieName], ct));
        }
        catch (UnauthorizedException)
        {
            ClearRefreshCookie();
            throw;
        }
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    [EnableRateLimiting(AuthSetup.AuthRateLimitPolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        RequireCsrfHeader();
        await authService.SignOutAsync(Request.Cookies[_options.RefreshCookieName], ct);
        ClearRefreshCookie();
        return NoContent();
    }

    [HttpGet("me")]
    [ProducesResponseType<CurrentUserDto>(StatusCodes.Status200OK)]
    public Task<CurrentUserDto> Me(CancellationToken ct) =>
        authService.GetCurrentUserAsync(currentUser.UserId!.Value, ct);

    private AuthResponse Complete(AuthResult result)
    {
        Response.Cookies.Append(_options.RefreshCookieName, result.RefreshToken, CookieOptions(result.RefreshExpiresAt));
        return result.Response;
    }

    private void ClearRefreshCookie() =>
        Response.Cookies.Delete(_options.RefreshCookieName, CookieOptions(timeProvider.GetUtcNow().AddDays(-1)));

    private void RequireCsrfHeader()
    {
        if (string.IsNullOrWhiteSpace(Request.Headers[CsrfHeader]))
        {
            throw new ForbiddenException("auth.csrf_header_missing", $"The {CsrfHeader} header is required.");
        }
    }

    private static CookieOptions CookieOptions(DateTimeOffset expires) => new()
    {
        HttpOnly = true,
        // Browsers treat http://localhost as a secure context, so Secure works in local development too.
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Path = RefreshCookiePath,
        Expires = expires,
        IsEssential = true,
    };
}
