using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Auth;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EventLy.Api.Services;

/// <summary>Result of a sign-in or refresh: the response body plus the new refresh token for the cookie.</summary>
public sealed record AuthResult(AuthResponse Response, string RefreshToken, DateTimeOffset RefreshExpiresAt);

/// <summary>
/// Sign-in rules (decision Q-39: everyone signs in with Google):
/// <list type="bullet">
/// <item>A known Google account signs in to its user.</item>
/// <item>An Invited user (Admin/Staff registered by an Owner) is matched by email and becomes Active.</item>
/// <item>The configured Root email becomes the Root user.</item>
/// <item>Any other verified Google account becomes a new Owner without an organization.</item>
/// </list>
/// </summary>
public sealed class AuthService(
    AppDbContext db,
    TokenService tokens,
    AuditService audit,
    IOptions<AuthOptions> options,
    TimeProvider timeProvider)
{
    /// <summary>
    /// A token rotated this recently is treated as a harmless race (two requests refreshing at once)
    /// rather than as theft, so the session family is not revoked.
    /// </summary>
    public static readonly TimeSpan RotationGracePeriod = TimeSpan.FromSeconds(10);

    private readonly AuthOptions _options = options.Value;

    public async Task<AuthResult> SignInAsync(ExternalIdentity identity, CancellationToken ct)
    {
        var email = identity.Email.Trim();
        var isRootEmail = IsRootEmail(email);

        var user = await db.Users.SingleOrDefaultAsync(u => u.GoogleSubject == identity.Subject, ct)
            ?? await db.Users.SingleOrDefaultAsync(u => u.Email == email, ct);
        var isNewUser = user is null;

        if (user is null)
        {
            user = new User
            {
                Name = Truncate(identity.Name, 100),
                Email = email,
                GoogleSubject = identity.Subject,
                AvatarUrl = identity.AvatarUrl,
                Role = isRootEmail ? UserRole.Root : UserRole.Owner,
                Status = UserStatus.Active,
            };
            db.Users.Add(user);
        }
        else
        {
            await EnsureMaySignInAsync(user, identity, isRootEmail, ct);

            user.GoogleSubject ??= identity.Subject;
            user.AvatarUrl = identity.AvatarUrl ?? user.AvatarUrl;
            if (user.Status == UserStatus.Invited)
            {
                user.Status = UserStatus.Active;
            }
        }

        user.LastSignInAt = timeProvider.GetUtcNow();
        audit.Add(AuditActions.SignIn, user.Id, user.OrganizationId, nameof(User), user.Id,
            new { isNewUser, role = user.Role.ToString() });

        var result = IssueTokens(user, familyId: Guid.CreateVersion7(), isNewUser);
        await db.SaveChangesAsync(ct);
        return result;
    }

    public async Task<AuthResult> RefreshAsync(string? rawToken, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(rawToken))
        {
            throw InvalidRefreshToken();
        }

        var now = timeProvider.GetUtcNow();
        var hash = TokenService.Hash(rawToken);
        var token = await db.RefreshTokens.Include(t => t.User).SingleOrDefaultAsync(t => t.TokenHash == hash, ct)
            ?? throw InvalidRefreshToken();

        if (token.RevokedAt is { } revokedAt)
        {
            var isRecentRotation = token.ReplacedById is not null && now - revokedAt < RotationGracePeriod;
            if (!isRecentRotation)
            {
                // A revoked token came back: assume it was stolen and end every session in its family.
                await RevokeFamilyAsync(token.FamilyId, now, ct);
                audit.Add(AuditActions.RefreshTokenReuse, token.UserId, token.User.OrganizationId,
                    nameof(RefreshToken), token.Id);
                await db.SaveChangesAsync(ct);
            }
            throw InvalidRefreshToken();
        }

        if (token.ExpiresAt <= now
            || token.User.Status != UserStatus.Active
            || token.SecurityStamp != token.User.SecurityStamp
            || (token.User.Role == UserRole.Root && !IsRootEmail(token.User.Email)))
        {
            token.RevokedAt = now;
            await db.SaveChangesAsync(ct);
            throw InvalidRefreshToken();
        }

        var result = IssueTokens(token.User, token.FamilyId, isNewUser: false, out var replacement);
        token.RevokedAt = now;
        token.ReplacedById = replacement.Id;
        await db.SaveChangesAsync(ct);
        return result;
    }

    /// <summary>Ends the session the cookie belongs to. Unknown tokens are ignored (logout always succeeds).</summary>
    public async Task SignOutAsync(string? rawToken, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(rawToken))
        {
            return;
        }

        var hash = TokenService.Hash(rawToken);
        var token = await db.RefreshTokens.Include(t => t.User).SingleOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null)
        {
            return;
        }

        await RevokeFamilyAsync(token.FamilyId, timeProvider.GetUtcNow(), ct);
        audit.Add(AuditActions.SignOut, token.UserId, token.User.OrganizationId, nameof(User), token.UserId);
        await db.SaveChangesAsync(ct);
    }

    public async Task<CurrentUserDto> GetCurrentUserAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new UnauthorizedException("auth.unauthenticated", "Sign-in required.");
        return ToDto(user);
    }

    public static CurrentUserDto ToDto(User user) => new(
        user.Id, user.Name, user.Email, user.AvatarUrl, user.Role, user.Status, user.OrganizationId,
        Permissions.For(user.Role));

    private async Task EnsureMaySignInAsync(User user, ExternalIdentity identity, bool isRootEmail, CancellationToken ct)
    {
        string? refusal = null;
        if (user.GoogleSubject is not null && user.GoogleSubject != identity.Subject)
        {
            refusal = "google_account_mismatch";
        }
        else if (user.Status == UserStatus.Disabled)
        {
            refusal = "account_disabled";
        }
        else if (user.Role == UserRole.Root && !isRootEmail)
        {
            // Root is whoever Auth:RootEmail names; a former Root email loses access when the setting changes.
            refusal = "not_root_anymore";
        }

        if (refusal is null)
        {
            return;
        }

        audit.Add(AuditActions.SignInRefused, user.Id, user.OrganizationId, nameof(User), user.Id, new { reason = refusal });
        await db.SaveChangesAsync(ct);
        throw new ForbiddenException("auth." + refusal, "This account can't sign in. Contact your administrator.");
    }

    private AuthResult IssueTokens(User user, Guid familyId, bool isNewUser) =>
        IssueTokens(user, familyId, isNewUser, out _);

    private AuthResult IssueTokens(User user, Guid familyId, bool isNewUser, out RefreshToken refreshToken)
    {
        var now = timeProvider.GetUtcNow();
        var access = tokens.CreateAccessToken(user);
        var newRefresh = TokenService.CreateRefreshToken();

        refreshToken = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = newRefresh.Hash,
            FamilyId = familyId,
            SecurityStamp = user.SecurityStamp,
            CreatedAt = now,
            ExpiresAt = now.AddDays(_options.RefreshTokenDays),
        };
        db.RefreshTokens.Add(refreshToken);

        var response = new AuthResponse(
            access.Token, (int)(access.ExpiresAt - now).TotalSeconds, ToDto(user), isNewUser);
        return new AuthResult(response, newRefresh.RawToken, refreshToken.ExpiresAt);
    }

    private async Task RevokeFamilyAsync(Guid familyId, DateTimeOffset now, CancellationToken ct)
    {
        var active = await db.RefreshTokens.Where(t => t.FamilyId == familyId && t.RevokedAt == null).ToListAsync(ct);
        foreach (var t in active)
        {
            t.RevokedAt = now;
        }
    }

    private bool IsRootEmail(string email) =>
        !string.IsNullOrWhiteSpace(_options.RootEmail)
        && string.Equals(email.Trim(), _options.RootEmail.Trim(), StringComparison.OrdinalIgnoreCase);

    private static UnauthorizedException InvalidRefreshToken() =>
        new("auth.invalid_refresh_token", "Your session has ended. Please sign in again.");

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
