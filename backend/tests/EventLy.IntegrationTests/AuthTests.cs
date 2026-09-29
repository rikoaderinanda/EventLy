using System.Net;
using System.Net.Http.Json;
using EventLy.Api.Auth;
using EventLy.Api.Dtos.Auth;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;

namespace EventLy.IntegrationTests;

/// <summary>Sign-in rules, refresh rotation and logout against a real database.</summary>
public sealed class AuthTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private static string UniqueEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@example.test";

    [Fact]
    public async Task First_sign_in_creates_an_owner_without_organization_and_sets_a_safe_cookie()
    {
        var email = UniqueEmail("owner");

        var signedIn = await DevSignInAsync(_client, email, "Rina Santoso");

        signedIn.Body.IsNewUser.ShouldBeTrue();
        signedIn.Body.User.Role.ShouldBe(UserRole.Owner);
        signedIn.Body.User.OrganizationId.ShouldBeNull();
        signedIn.Body.User.Permissions.ShouldContain(Permissions.PaymentManage);
        signedIn.Body.ExpiresIn.ShouldBe(15 * 60);
        signedIn.SetCookieHeader.ShouldContain("httponly", Case.Insensitive);
        signedIn.SetCookieHeader.ShouldContain("secure", Case.Insensitive);
        signedIn.SetCookieHeader.ShouldContain("samesite=strict", Case.Insensitive);
        signedIn.SetCookieHeader.ShouldContain("path=/api/v1/auth", Case.Insensitive);

        await using var db = postgres.CreateDbContext();
        var audit = await db.AuditLogs.SingleAsync(a => a.UserId == signedIn.Body.User.Id, Ct);
        audit.Action.ShouldBe(AuditActions.SignIn);
        var storedHashes = await db.RefreshTokens.Where(t => t.UserId == signedIn.Body.User.Id)
            .Select(t => t.TokenHash).ToListAsync(Ct);
        storedHashes.ShouldHaveSingleItem().ShouldNotBe(signedIn.RefreshToken); // only the hash is stored
    }

    [Fact]
    public async Task Second_sign_in_returns_the_same_user()
    {
        var email = UniqueEmail("again");
        var first = await DevSignInAsync(_client, email);

        var second = await DevSignInAsync(_client, email.ToUpperInvariant());

        second.Body.IsNewUser.ShouldBeFalse();
        second.Body.User.Id.ShouldBe(first.Body.User.Id);
    }

    [Fact]
    public async Task Configured_root_email_signs_in_as_root_with_platform_permissions_only()
    {
        var signedIn = await DevSignInAsync(_client, ApiFactory.RootEmail);

        signedIn.Body.User.Role.ShouldBe(UserRole.Root);
        signedIn.Body.User.Permissions.ShouldBe(
            [Permissions.PlatformEventsActivateManual, Permissions.PlatformOwnersManage, Permissions.PlatformPackagesManage]);
    }

    [Fact]
    public async Task Invited_staff_is_matched_by_email_and_becomes_active()
    {
        var email = UniqueEmail("staff");
        var owner = await DevSignInAsync(_client, UniqueEmail("owner"));
        var orgId = (await TenantBuilder.CreateOrganizationAsync(_client, owner.Body.AccessToken, "Santoso WO"))
            .Organization.Id;
        await using (var db = postgres.CreateDbContext())
        {
            db.Users.Add(new User
            {
                Name = "Budi (staff)", Email = email, Role = UserRole.Staff, Status = UserStatus.Invited,
                OrganizationId = orgId,
            });
            await db.SaveChangesAsync(Ct);
        }

        var signedIn = await DevSignInAsync(_client, email);

        signedIn.Body.IsNewUser.ShouldBeFalse();
        signedIn.Body.User.Role.ShouldBe(UserRole.Staff);
        signedIn.Body.User.Status.ShouldBe(UserStatus.Active);
        signedIn.Body.User.OrganizationId.ShouldBe(orgId);
        signedIn.Body.User.Name.ShouldBe("Budi (staff)"); // the Owner's name for the staff member is kept
    }

    [Fact]
    public async Task Disabled_user_is_refused_and_the_refusal_is_audited()
    {
        var email = UniqueEmail("disabled");
        var first = await DevSignInAsync(_client, email);
        await using (var db = postgres.CreateDbContext())
        {
            await db.Users.Where(u => u.Id == first.Body.User.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.Status, UserStatus.Disabled), Ct);
        }

        var response = await _client.PostAsJsonAsync("/api/v1/auth/dev-sign-in", new DevSignInRequest(email, null), Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(response)).ShouldBe("auth.account_disabled");
        await using var check = postgres.CreateDbContext();
        (await check.AuditLogs.AnyAsync(a => a.UserId == first.Body.User.Id && a.Action == AuditActions.SignInRefused, Ct))
            .ShouldBeTrue();
    }

    [Fact]
    public async Task Google_sign_in_accepts_a_verified_token_and_rejects_an_invalid_one()
    {
        var email = UniqueEmail("google");
        var ok = await _client.PostAsJsonAsync("/api/v1/auth/google",
            new GoogleSignInRequest(FakeGoogleTokenValidator.TokenFor("google-sub-1-" + email, email, "Sari")), Ct);
        var signedIn = await ReadSignedInAsync(ok);
        signedIn.Body.User.Email.ShouldBe(email);
        signedIn.Body.User.AvatarUrl.ShouldNotBeNull();

        var bad = await _client.PostAsJsonAsync("/api/v1/auth/google", new GoogleSignInRequest("forged-token"), Ct);
        bad.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await ProblemCodeAsync(bad)).ShouldBe("auth.invalid_google_token");
    }

    [Fact]
    public async Task Another_google_account_with_the_same_email_is_refused()
    {
        var email = UniqueEmail("mismatch");
        await ReadSignedInAsync(await _client.PostAsJsonAsync("/api/v1/auth/google",
            new GoogleSignInRequest(FakeGoogleTokenValidator.TokenFor("sub-A-" + email, email)), Ct));

        var other = await _client.PostAsJsonAsync("/api/v1/auth/google",
            new GoogleSignInRequest(FakeGoogleTokenValidator.TokenFor("sub-B-" + email, email)), Ct);

        other.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(other)).ShouldBe("auth.google_account_mismatch");
    }

    [Fact]
    public async Task Me_requires_a_token_and_returns_the_signed_in_user()
    {
        var signedIn = await DevSignInAsync(_client, UniqueEmail("me"));

        var anonymous = await GetMeAsync(_client, accessToken: null);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await ProblemCodeAsync(anonymous)).ShouldBe("auth.unauthenticated");

        var me = await (await GetMeAsync(_client, signedIn.Body.AccessToken))
            .Content.ReadFromJsonAsync<CurrentUserDto>(Json, Ct);
        me.ShouldNotBeNull().Id.ShouldBe(signedIn.Body.User.Id);
    }

    [Fact]
    public async Task Refresh_rotates_the_cookie_and_the_old_token_stops_working()
    {
        var signedIn = await DevSignInAsync(_client, UniqueEmail("rotate"));

        var refreshed = await ReadSignedInAsync(await RefreshAsync(_client, signedIn.RefreshToken));
        refreshed.RefreshToken.ShouldNotBe(signedIn.RefreshToken);
        refreshed.Body.User.Id.ShouldBe(signedIn.Body.User.Id);

        // Within the grace period a second use is treated as a race: refused, but the new token keeps working.
        (await RefreshAsync(_client, signedIn.RefreshToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await RefreshAsync(_client, refreshed.RefreshToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Reusing_an_old_refresh_token_after_the_grace_period_ends_the_whole_session()
    {
        var signedIn = await DevSignInAsync(_client, UniqueEmail("reuse"));
        var refreshed = await ReadSignedInAsync(await RefreshAsync(_client, signedIn.RefreshToken));

        _factory.Time.Advance(TimeSpan.FromSeconds(30));
        var reuse = await RefreshAsync(_client, signedIn.RefreshToken);

        reuse.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await RefreshAsync(_client, refreshed.RefreshToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        await using var db = postgres.CreateDbContext();
        (await db.AuditLogs.AnyAsync(a => a.UserId == signedIn.Body.User.Id && a.Action == AuditActions.RefreshTokenReuse, Ct))
            .ShouldBeTrue();
    }

    [Fact]
    public async Task Refresh_without_the_csrf_header_is_refused()
    {
        var signedIn = await DevSignInAsync(_client, UniqueEmail("csrf"));

        var response = await RefreshAsync(_client, signedIn.RefreshToken, withCsrfHeader: false);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(response)).ShouldBe("auth.csrf_header_missing");
    }

    [Fact]
    public async Task Refresh_fails_after_the_refresh_token_expires()
    {
        var signedIn = await DevSignInAsync(_client, UniqueEmail("expired"));

        _factory.Time.Advance(TimeSpan.FromDays(15));

        (await RefreshAsync(_client, signedIn.RefreshToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Logout_ends_the_session_and_clears_the_cookie()
    {
        var signedIn = await DevSignInAsync(_client, UniqueEmail("logout"));

        var logout = await LogoutAsync(_client, signedIn.RefreshToken);

        logout.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        logout.Headers.GetValues("Set-Cookie").ShouldContain(h => h.StartsWith(CookieName + "=;", StringComparison.Ordinal));
        (await RefreshAsync(_client, signedIn.RefreshToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Invalid_request_body_returns_validation_problem()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/dev-sign-in", new DevSignInRequest("not-an-email", null), Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemCodeAsync(response)).ShouldBe("validation.failed");
    }
}
