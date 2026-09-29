using EventLy.Api.Common.Errors;
using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace EventLy.Api.Auth;

/// <summary>Who Google (or the Development test sign-in) says the user is.</summary>
public sealed record ExternalIdentity(string Subject, string Email, string Name, string? AvatarUrl);

/// <summary>
/// Validates a Google ID token. It is an interface because tests can't obtain real Google tokens,
/// so integration tests swap in a fake.
/// </summary>
public interface IGoogleTokenValidator
{
    Task<ExternalIdentity> ValidateAsync(string idToken, CancellationToken cancellationToken);
}

public sealed class GoogleTokenValidator(IOptions<AuthOptions> options, ILogger<GoogleTokenValidator> logger)
    : IGoogleTokenValidator
{
    public async Task<ExternalIdentity> ValidateAsync(string idToken, CancellationToken cancellationToken)
    {
        var clientId = options.Value.GoogleClientId;
        if (string.IsNullOrWhiteSpace(clientId))
        {
            throw new AppException(StatusCodes.Status503ServiceUnavailable, "auth.google_not_configured",
                "Google sign-in is not configured on this server.");
        }

        GoogleJsonWebSignature.Payload payload;
        try
        {
            // Checks the signature against Google's keys, the issuer, the expiry and that the audience is our client id.
            payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
                new GoogleJsonWebSignature.ValidationSettings { Audience = [clientId] });
        }
        catch (InvalidJwtException ex)
        {
            logger.LogInformation("Rejected Google ID token: {Reason}", ex.Message);
            throw new UnauthorizedException("auth.invalid_google_token", "The Google sign-in could not be verified.");
        }

        cancellationToken.ThrowIfCancellationRequested();

        if (!payload.EmailVerified || string.IsNullOrWhiteSpace(payload.Email))
        {
            throw new UnauthorizedException("auth.email_not_verified", "The Google account has no verified email.");
        }

        return new ExternalIdentity(payload.Subject, payload.Email, payload.Name ?? payload.Email, payload.Picture);
    }
}
