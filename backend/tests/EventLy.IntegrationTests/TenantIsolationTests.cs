using System.Net;
using System.Net.Http.Json;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Dtos.Organizations;
using EventLy.Api.Dtos.Users;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.EventRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;

namespace EventLy.IntegrationTests;

/// <summary>
/// Two organizations side by side: nothing of tenant A is visible to, or changeable by, tenant B.
/// Cross-tenant ids answer 404 (not 403) so the API doesn't reveal that they exist.
/// Later phases add their endpoints here.
/// </summary>
public sealed class TenantIsolationTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Tenant _a = null!;
    private Tenant _b = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        (_a, _b) = await TwoTenantsAsync(_client);
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
    public async Task Each_member_sees_only_their_own_organization()
    {
        foreach (var (tenant, member) in new[] { (_a, _a.Staff), (_b, _b.Admin), (_b, _b.Owner) })
        {
            var profile = await (await SendAsync(_client, HttpMethod.Get, "/api/v1/organization", member.AccessToken))
                .Content.ReadFromJsonAsync<OrganizationDto>(Json, Ct);
            profile.ShouldNotBeNull().Id.ShouldBe(tenant.OrganizationId);
        }
    }

    [Fact]
    public async Task User_list_contains_only_the_callers_organization()
    {
        var users = await (await SendAsync(_client, HttpMethod.Get, "/api/v1/users", _b.Owner.AccessToken))
            .Content.ReadFromJsonAsync<List<OrganizationUserDto>>(Json, Ct);

        users.ShouldNotBeNull().Select(u => u.Id)
            .ShouldBe([_b.Owner.UserId, _b.Admin.UserId, _b.Staff.UserId], ignoreOrder: true);
    }

    [Fact]
    public async Task Another_tenants_user_cannot_be_changed_or_removed()
    {
        var update = await SendAsync(_client, HttpMethod.Put, $"/api/v1/users/{_a.Staff.UserId}", _b.Owner.AccessToken,
            new UpdateUserRequest("Hijacked", UserRole.Admin, UserStatus.Disabled));
        var delete = await SendAsync(_client, HttpMethod.Delete, $"/api/v1/users/{_a.Admin.UserId}", _b.Owner.AccessToken);

        update.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        delete.StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // Tenant A's staff member is untouched and can still refresh their session.
        (await RefreshAsync(_client, _a.Staff.RefreshToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Access_token_org_id_cannot_be_overridden_from_the_request()
    {
        // There is no organizationId in any route or body; the tenant only comes from the token.
        var response = await SendAsync(_client, HttpMethod.Get, $"/api/v1/organization?organizationId={_a.OrganizationId}",
            _b.Owner.AccessToken);

        (await response.Content.ReadFromJsonAsync<OrganizationDto>(Json, Ct)).ShouldNotBeNull().Id.ShouldBe(_b.OrganizationId);
    }

    [Fact]
    public async Task Another_tenants_event_is_not_found_for_every_operation()
    {
        var ev = await CreateAsync(_client, _a.Owner);
        var id = ev.Id;

        var attempts = new (HttpMethod Method, string Path, object? Body)[]
        {
            (HttpMethod.Get, $"/api/v1/events/{id}", null),
            (HttpMethod.Put, $"/api/v1/events/{id}", ToUpdate(ev) with { Name = "Hijacked" }),
            (HttpMethod.Delete, $"/api/v1/events/{id}", null),
            (HttpMethod.Post, $"/api/v1/events/{id}/cancel", null),
            (HttpMethod.Get, $"/api/v1/events/{id}/staff", null),
            (HttpMethod.Put, $"/api/v1/events/{id}/staff", new AssignStaffRequest([_b.Staff.UserId])),
        };
        foreach (var (method, path, body) in attempts)
        {
            var response = await SendAsync(_client, method, path, _b.Owner.AccessToken, body);
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, $"{method} {path}");
        }

        var listB = await (await SendAsync(_client, HttpMethod.Get, "/api/v1/events", _b.Owner.AccessToken))
            .Content.ReadFromJsonAsync<List<EventListItemDto>>(Json, Ct);
        listB.ShouldNotBeNull().ShouldNotContain(e => e.Id == id);
        (await GetAsync(_client, _a.Owner, id)).Name.ShouldBe(ev.Name);
    }

    [Fact]
    public async Task Tenant_filter_hides_and_interceptor_refuses_other_tenants_rows_at_the_database_level()
    {
        var ev = await CreateAsync(_client, _a.Owner);

        await using (var asB = postgres.CreateDbContext(_b.OrganizationId))
        {
            (await asB.Events.AnyAsync(e => e.Id == ev.Id, Ct)).ShouldBeFalse();
            (await asB.EventSessions.AnyAsync(s => s.EventId == ev.Id, Ct)).ShouldBeFalse();

            // Even when code bypasses the filter, writing another tenant's row is refused before it reaches SQL.
            var loaded = await asB.Events.IgnoreQueryFilters().SingleAsync(e => e.Id == ev.Id, Ct);
            loaded.Name = "Hijacked";
            await Should.ThrowAsync<InvalidOperationException>(() => asB.SaveChangesAsync(Ct));
        }

        await using var asNobody = postgres.CreateDbContext();
        (await asNobody.Events.AnyAsync(e => e.Id == ev.Id, Ct)).ShouldBeFalse();
    }

    [Fact]
    public async Task Another_tenants_payments_are_invisible_and_their_events_cant_be_paid_for()
    {
        var ev = await CreateAsync(_client, _a.Owner);
        var basic = await PaymentRequests.PackageAsync(_client, _a.Owner, "BASIC");
        var payment = await PaymentRequests.StartCheckoutAsync(_client, _a.Owner, ev.Id, basic.Id);

        var paths = new[]
        {
            $"/api/v1/payments/{payment.Id}",
            $"/api/v1/payments/{payment.Id}/receipt",
            $"/api/v1/events/{ev.Id}/payments",
        };
        foreach (var path in paths)
        {
            (await SendAsync(_client, HttpMethod.Get, path, _b.Owner.AccessToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        }
        (await PaymentRequests.CheckoutAsync(_client, _b.Owner, ev.Id, basic.Id)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await SendAsync(_client, HttpMethod.Post, $"/api/v1/payments/{payment.Id}/simulate", _b.Owner.AccessToken,
            new EventLy.Api.Dtos.Payments.SimulatePaymentRequest(EventLy.Api.Dtos.Payments.SimulatedOutcome.Paid)))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);

        (await GetAsync(_client, _a.Owner, ev.Id)).Status.ShouldBe(EventStatus.PendingPayment);
    }
}
