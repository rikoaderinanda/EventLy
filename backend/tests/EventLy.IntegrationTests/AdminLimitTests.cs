using System.Net;
using EventLy.Api.Data.Seed;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Dtos.Users;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;
using Events = EventLy.IntegrationTests.Infrastructure.EventRequests;

namespace EventLy.IntegrationTests;

/// <summary>
/// The Admin limit (Q-54): the largest maxAdmins among the organization's Active events, or the largest
/// offered package before the first payment. Each tenant starts with one Admin (TenantBuilder).
/// </summary>
public sealed class AdminLimitTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private Task<HttpResponseMessage> Invite(Tenant tenant, UserRole role = UserRole.Admin) =>
        SendAsync(_client, HttpMethod.Post, "/api/v1/users", tenant.Owner.AccessToken,
            new InviteUserRequest($"{role} baru", UniqueEmail("limit"), role));

    /// <summary>A tenant whose only Active event is on a package allowing <paramref name="maxAdmins"/> Admins.</summary>
    private async Task<Tenant> TenantWithPaidEventAsync(int maxAdmins)
    {
        var root = (await DevSignInAsync(_client, ApiFactory.RootEmail)).Body.AccessToken;
        var features = PackageSeed.Initial()[0].Features.Copy();
        features.MaxAdmins = maxAdmins;
        var package = await ReadAsync<PackageDto>(await SendAsync(_client, HttpMethod.Post, "/api/v1/platform/packages", root,
            new CreatePackageRequest("ADM" + Guid.NewGuid().ToString("N")[..8], "Admins", 100_000m, "IDR", features, true)));
        var tenant = await CreateTenantAsync(_client, "Admin limit WO");
        var ev = await Events.CreateAsync(_client, tenant.Owner);
        await PayAsync(_factory, _client, await StartCheckoutAsync(_client, tenant.Owner, ev.Id, package.Id));
        return tenant;
    }

    [Fact]
    public async Task Before_the_first_payment_the_largest_offered_package_applies()
    {
        var tenant = await CreateTenantAsync(_client, "Unpaid WO"); // 1 Admin already
        var enterprise = PackageSeed.Initial().Max(p => p.Features.MaxAdmins);

        for (var i = 1; i < enterprise; i++)
        {
            (await Invite(tenant)).StatusCode.ShouldBe(HttpStatusCode.Created);
        }
        var over = await Invite(tenant);

        over.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemCodeAsync(over)).ShouldBe("user.admin_limit_exceeded");
        (await Invite(tenant, UserRole.Staff)).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task A_paid_event_sets_the_limit_and_disabled_admins_dont_count()
    {
        var tenant = await TenantWithPaidEventAsync(maxAdmins: 2);

        (await Invite(tenant)).StatusCode.ShouldBe(HttpStatusCode.Created);
        (await Invite(tenant)).StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);

        (await SendAsync(_client, HttpMethod.Put, $"/api/v1/users/{tenant.Admin.UserId}", tenant.Owner.AccessToken,
            new UpdateUserRequest("Admin lama", UserRole.Admin, UserStatus.Disabled))).EnsureSuccessStatusCode();
        (await Invite(tenant)).StatusCode.ShouldBe(HttpStatusCode.Created);

        // Re-enabling the disabled Admin would make three.
        var reenable = await SendAsync(_client, HttpMethod.Put, $"/api/v1/users/{tenant.Admin.UserId}", tenant.Owner.AccessToken,
            new UpdateUserRequest("Admin lama", UserRole.Admin, UserStatus.Active));
        reenable.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Promoting_staff_to_admin_needs_a_free_place()
    {
        var tenant = await TenantWithPaidEventAsync(maxAdmins: 1);

        var promote = await SendAsync(_client, HttpMethod.Put, $"/api/v1/users/{tenant.Staff.UserId}", tenant.Owner.AccessToken,
            new UpdateUserRequest("Staff", UserRole.Admin, UserStatus.Active));

        promote.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await SendAsync(_client, HttpMethod.Put, $"/api/v1/users/{tenant.Admin.UserId}", tenant.Owner.AccessToken,
            new UpdateUserRequest("Admin, nama baru", UserRole.Admin, UserStatus.Active))).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Invitations_at_the_same_moment_never_exceed_the_limit()
    {
        var tenant = await TenantWithPaidEventAsync(maxAdmins: 2);

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Invite(tenant)));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).ShouldBe(1);
        responses.Count(r => r.StatusCode == HttpStatusCode.UnprocessableEntity).ShouldBe(4);
    }
}
