using EventLy.Api.Auth;
using EventLy.Api.Entities;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using Microsoft.IdentityModel.JsonWebTokens;
using Shouldly;

namespace EventLy.UnitTests.Auth;

public sealed class TokenServiceTests
{
    private static readonly AuthOptions Options = new()
    {
        Jwt = new JwtSettings { SigningKey = "dev-only-unit-test-signing-key-0123456789", AccessTokenMinutes = 15 },
    };

    private static User NewUser(Guid? organizationId = null) => new()
    {
        Name = "Rina",
        Email = "rina@example.test",
        Role = UserRole.Owner,
        OrganizationId = organizationId,
    };

    [Fact]
    public void Access_token_carries_role_and_tenant_and_expires_after_15_minutes()
    {
        var time = new FakeTimeProvider(new DateTimeOffset(2026, 10, 10, 3, 0, 0, TimeSpan.Zero));
        var orgId = Guid.CreateVersion7();
        var user = NewUser(orgId);

        var token = new TokenService(Microsoft.Extensions.Options.Options.Create(Options), time).CreateAccessToken(user);

        token.ExpiresAt.ShouldBe(time.GetUtcNow().AddMinutes(15));
        var jwt = new JsonWebToken(token.Token);
        jwt.GetClaim(AuthClaims.UserId).Value.ShouldBe(user.Id.ToString());
        jwt.GetClaim(AuthClaims.Role).Value.ShouldBe("Owner");
        jwt.GetClaim(AuthClaims.OrganizationId).Value.ShouldBe(orgId.ToString());
        jwt.Alg.ShouldBe("HS256");
    }

    [Fact]
    public void Access_token_has_no_tenant_claim_before_the_organization_exists()
    {
        var token = new TokenService(Microsoft.Extensions.Options.Options.Create(Options), TimeProvider.System)
            .CreateAccessToken(NewUser());

        new JsonWebToken(token.Token).TryGetClaim(AuthClaims.OrganizationId, out _).ShouldBeFalse();
    }

    [Fact]
    public void Refresh_tokens_are_random_and_only_their_hash_is_kept()
    {
        var a = TokenService.CreateRefreshToken();
        var b = TokenService.CreateRefreshToken();

        a.RawToken.ShouldNotBe(b.RawToken);
        a.Hash.ShouldBe(TokenService.Hash(a.RawToken));
        a.Hash.Length.ShouldBe(64);
        a.Hash.ShouldNotContain(a.RawToken);
    }
}

public sealed class AuthSetupTests
{
    private static IHostEnvironment Env(string name) => new HostingEnvironment { EnvironmentName = name };

    private static AuthOptions WithKey(string key, string googleClientId = "", bool devSignIn = false) => new()
    {
        Jwt = new JwtSettings { SigningKey = key },
        GoogleClientId = googleClientId,
        DevSignInEnabled = devSignIn,
    };

    [Fact]
    public void Short_signing_key_is_refused() =>
        Should.Throw<InvalidOperationException>(() => AuthSetup.Validate(WithKey("too-short"), Env("Development")));

    [Fact]
    public void Development_key_is_refused_in_production() =>
        Should.Throw<InvalidOperationException>(() => AuthSetup.Validate(
            WithKey("dev-only-signing-key-NOT-FOR-PRODUCTION-0123456789", "client-id"), Env("Production")));

    [Fact]
    public void Production_requires_a_google_client_id() =>
        Should.Throw<InvalidOperationException>(() => AuthSetup.Validate(
            WithKey("a-real-production-key-with-more-than-32-bytes!"), Env("Production")));

    [Fact]
    public void Valid_production_configuration_passes() =>
        Should.NotThrow(() => AuthSetup.Validate(
            WithKey("a-real-production-key-with-more-than-32-bytes!", "client-id"), Env("Production")));

    [Theory]
    [InlineData("Development", true)]
    [InlineData("Testing", true)]
    [InlineData("Production", false)]
    [InlineData("Staging", false)]
    public void Dev_sign_in_is_only_possible_in_development_and_testing(string environment, bool allowed) =>
        AuthSetup.DevSignInAllowed(WithKey("k", devSignIn: true), Env(environment)).ShouldBe(allowed);
}
