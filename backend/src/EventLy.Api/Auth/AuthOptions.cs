namespace EventLy.Api.Auth;

/// <summary>Settings under <c>Auth</c>. Secrets (the signing key) come from environment variables / Secret Manager.</summary>
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>Marker that only the Development key contains; refused outside Development/Testing.</summary>
    public const string DevelopmentKeyMarker = "dev-only";

    public JwtSettings Jwt { get; init; } = new();

    /// <summary>OAuth client id from Google Cloud Console. Public (it is sent to the browser), not a secret.</summary>
    public string GoogleClientId { get; init; } = "";

    /// <summary>The single Google email that signs in as Root.</summary>
    public string RootEmail { get; init; } = "";

    /// <summary>Test sign-in without Google. Only honoured in Development and Testing.</summary>
    public bool DevSignInEnabled { get; init; }

    public string RefreshCookieName { get; init; } = "evently_rt";

    public int RefreshTokenDays { get; init; } = 14;
}

public sealed class JwtSettings
{
    public string Issuer { get; init; } = "evently";

    public string Audience { get; init; } = "evently-api";

    /// <summary>HMAC-SHA256 key, at least 32 bytes.</summary>
    public string SigningKey { get; init; } = "";

    public int AccessTokenMinutes { get; init; } = 15;
}
