using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EventLy.Api.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace EventLy.Api.Auth;

public sealed record AccessToken(string Token, DateTimeOffset ExpiresAt);

public sealed record NewRefreshToken(string RawToken, string Hash);

/// <summary>Issues EventLy's own tokens after Google has confirmed who the user is.</summary>
public sealed class TokenService(IOptions<AuthOptions> options, TimeProvider timeProvider)
{
    private readonly AuthOptions _options = options.Value;

    public static SymmetricSecurityKey SigningKey(JwtSettings jwt) => new(Encoding.UTF8.GetBytes(jwt.SigningKey));

    public AccessToken CreateAccessToken(User user)
    {
        var now = timeProvider.GetUtcNow();
        var expiresAt = now.AddMinutes(_options.Jwt.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(AuthClaims.UserId, user.Id.ToString()),
            new(AuthClaims.Email, user.Email),
            new(AuthClaims.Name, user.Name),
            new(AuthClaims.Role, user.Role.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        if (user.OrganizationId is { } orgId)
        {
            claims.Add(new Claim(AuthClaims.OrganizationId, orgId.ToString()));
        }

        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = _options.Jwt.Issuer,
            Audience = _options.Jwt.Audience,
            Subject = new ClaimsIdentity(claims),
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = new SigningCredentials(SigningKey(_options.Jwt), SecurityAlgorithms.HmacSha256),
        });

        return new AccessToken(token, expiresAt);
    }

    /// <summary>A 256-bit random token for the cookie, and the hash that is stored.</summary>
    public static NewRefreshToken CreateRefreshToken()
    {
        var raw = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
        return new NewRefreshToken(raw, Hash(raw));
    }

    public static string Hash(string rawToken) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
}
