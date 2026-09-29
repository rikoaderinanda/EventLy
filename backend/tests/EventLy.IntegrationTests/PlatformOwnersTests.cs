using System.Net;
using System.Net.Http.Json;
using EventLy.Api.Dtos.Auth;
using EventLy.Api.Dtos.Platform;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;

namespace EventLy.IntegrationTests;

/// <summary>Root lists Owners and suspends/reactivates them (with their whole organization).</summary>
public sealed class PlatformOwnersTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private string _rootToken = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        _rootToken = (await DevSignInAsync(_client, ApiFactory.RootEmail)).Body.AccessToken;
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    [Fact]
    public async Task Root_lists_owners_with_their_organization()
    {
        var tenant = await CreateTenantAsync(_client, "Listed WO");

        var owners = await (await SendAsync(_client, HttpMethod.Get, $"/api/v1/platform/owners?search={tenant.Owner.Email}", _rootToken))
            .Content.ReadFromJsonAsync<List<PlatformOwnerDto>>(Json, Ct);

        var owner = owners.ShouldNotBeNull().ShouldHaveSingleItem();
        owner.Id.ShouldBe(tenant.Owner.UserId);
        owner.Organization.ShouldNotBeNull().Name.ShouldBe("Listed WO");
    }

    [Fact]
    public async Task Suspending_an_owner_blocks_everyone_in_the_organization_until_reactivated()
    {
        var tenant = await CreateTenantAsync(_client, "Suspended WO");

        (await SendAsync(_client, HttpMethod.Post, $"/api/v1/platform/owners/{tenant.Owner.UserId}/suspend", _rootToken))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await RefreshAsync(_client, tenant.Staff.RefreshToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var ownerSignIn = await _client.PostAsJsonAsync("/api/v1/auth/dev-sign-in", new DevSignInRequest(tenant.Owner.Email, null), Ct);
        var staffSignIn = await _client.PostAsJsonAsync("/api/v1/auth/dev-sign-in", new DevSignInRequest(tenant.Staff.Email, null), Ct);
        ownerSignIn.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(staffSignIn)).ShouldBe("auth.organization_suspended");

        (await SendAsync(_client, HttpMethod.Post, $"/api/v1/platform/owners/{tenant.Owner.UserId}/reactivate", _rootToken))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await DevSignInAsync(_client, tenant.Staff.Email)).Body.User.Status.ShouldBe(UserStatus.Active);
        (await DevSignInAsync(_client, tenant.Owner.Email)).Body.User.Status.ShouldBe(UserStatus.Active);
    }

    [Fact]
    public async Task Only_root_can_use_platform_endpoints()
    {
        var tenant = await CreateTenantAsync(_client, "Nosy WO");

        (await SendAsync(_client, HttpMethod.Get, "/api/v1/platform/owners", tenant.Owner.AccessToken))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await SendAsync(_client, HttpMethod.Post, $"/api/v1/platform/owners/{tenant.Owner.UserId}/suspend", tenant.Admin.AccessToken))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Root_has_no_access_to_organization_data()
    {
        (await SendAsync(_client, HttpMethod.Get, "/api/v1/users", _rootToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await SendAsync(_client, HttpMethod.Get, "/api/v1/organization", _rootToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
