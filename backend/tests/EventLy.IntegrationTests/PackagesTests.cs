using System.Net;
using EventLy.Api.Data.Seed;
using EventLy.Api.Dtos.Packages;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;

namespace EventLy.IntegrationTests;

/// <summary>The catalog Owners and Admins pick from, and Root's package management (decision Q-2).</summary>
public sealed class PackagesTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Tenant _tenant = null!;
    private string _rootToken = null!;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        _tenant = await CreateTenantAsync(_client, "Packages WO");
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

    private static CreatePackageRequest NewPackage(string code, decimal price = 250_000m) =>
        new(code, $"Paket {code}", price, "IDR", PackageSeed.Initial()[0].Features.Copy(), IsActive: true);

    private static string UniqueCode() => "T" + Guid.NewGuid().ToString("N")[..10].ToUpperInvariant();

    private Task<HttpResponseMessage> AsRoot(HttpMethod method, string path, object? body = null) =>
        SendAsync(_client, method, path, _rootToken, body);

    [Fact]
    public async Task Owner_and_admin_see_the_seeded_catalog_cheapest_first()
    {
        foreach (var member in new[] { _tenant.Owner, _tenant.Admin })
        {
            var packages = await ReadAsync<List<PackageDto>>(
                await SendAsync(_client, HttpMethod.Get, "/api/v1/packages", member.AccessToken));

            packages.Select(p => p.Code).Take(3).ShouldBe(["BASIC", "PREMIUM", "ENTERPRISE"]);
            var basic = packages[0];
            basic.Price.ShouldBe(150_000m);
            basic.Currency.ShouldBe("IDR");
            basic.Features.MaxGuests.ShouldBe(150);
            basic.Features.MaxStaff.ShouldBe(2);
            basic.Features.GuestUploadEnabled.ShouldBeFalse();
        }
    }

    [Fact]
    public async Task Staff_cannot_see_the_catalog_and_anonymous_is_refused()
    {
        (await SendAsync(_client, HttpMethod.Get, "/api/v1/packages", _tenant.Staff.AccessToken))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await SendAsync(_client, HttpMethod.Get, "/api/v1/packages", null)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Root_creates_a_package_that_owners_can_pick()
    {
        var code = UniqueCode();
        var response = await AsRoot(HttpMethod.Post, "/api/v1/platform/packages", NewPackage(code.ToLowerInvariant()));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = await ReadAsync<PackageDto>(response);
        created.Code.ShouldBe(code);
        (await PackageAsync(_client, _tenant.Owner, code)).Id.ShouldBe(created.Id);
    }

    [Fact]
    public async Task Codes_are_unique()
    {
        var code = UniqueCode();
        (await AsRoot(HttpMethod.Post, "/api/v1/platform/packages", NewPackage(code))).EnsureSuccessStatusCode();

        var again = await AsRoot(HttpMethod.Post, "/api/v1/platform/packages", NewPackage(code));

        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(again)).ShouldBe("package.code_taken");
    }

    [Fact]
    public async Task A_deactivated_package_leaves_the_catalog_but_root_still_sees_it()
    {
        var created = await ReadAsync<PackageDto>(await AsRoot(HttpMethod.Post, "/api/v1/platform/packages", NewPackage(UniqueCode())));
        await PackageAsync(_client, _tenant.Owner, created.Code); // now cached

        var update = new UpdatePackageRequest(created.Name, created.Price, "IDR", created.Features, IsActive: false);
        (await AsRoot(HttpMethod.Put, $"/api/v1/platform/packages/{created.Id}", update)).EnsureSuccessStatusCode();

        var catalog = await ReadAsync<List<PackageDto>>(
            await SendAsync(_client, HttpMethod.Get, "/api/v1/packages", _tenant.Owner.AccessToken));
        catalog.ShouldNotContain(p => p.Id == created.Id);
        (await SendAsync(_client, HttpMethod.Get, $"/api/v1/packages/{created.Id}", _tenant.Owner.AccessToken))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var all = await ReadAsync<List<PackageDto>>(await AsRoot(HttpMethod.Get, "/api/v1/platform/packages"));
        all.Single(p => p.Id == created.Id).IsActive.ShouldBeFalse();
    }

    [Fact]
    public async Task Invalid_packages_are_rejected()
    {
        var response = await AsRoot(HttpMethod.Post, "/api/v1/platform/packages", NewPackage(UniqueCode(), price: 0));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Only_root_manages_packages()
    {
        foreach (var member in new[] { _tenant.Owner, _tenant.Admin })
        {
            (await SendAsync(_client, HttpMethod.Get, "/api/v1/platform/packages", member.AccessToken))
                .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
            (await SendAsync(_client, HttpMethod.Post, "/api/v1/platform/packages", member.AccessToken, NewPackage(UniqueCode())))
                .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        }
    }
}
