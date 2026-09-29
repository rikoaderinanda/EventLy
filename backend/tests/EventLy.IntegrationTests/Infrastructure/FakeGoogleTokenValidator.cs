using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>
/// Stands in for Google in tests. A token of the form <c>valid|subject|email|name</c> is accepted;
/// anything else is rejected the same way the real validator rejects a bad token.
/// </summary>
public sealed class FakeGoogleTokenValidator : IGoogleTokenValidator
{
    public const string ClientId = "test-client.apps.googleusercontent.com";

    public static string TokenFor(string subject, string email, string name = "Test User") =>
        $"valid|{subject}|{email}|{name}";

    public Task<ExternalIdentity> ValidateAsync(string idToken, CancellationToken cancellationToken)
    {
        var parts = idToken.Split('|');
        if (parts is not ["valid", var subject, var email, var name])
        {
            throw new UnauthorizedException("auth.invalid_google_token", "The Google sign-in could not be verified.");
        }

        return Task.FromResult(new ExternalIdentity(subject, email, name, "https://example.test/avatar.png"));
    }
}
