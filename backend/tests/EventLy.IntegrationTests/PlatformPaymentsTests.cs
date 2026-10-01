using System.Net;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Dtos.Payments;
using EventLy.Api.Dtos.Platform;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.EventRequests;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;

namespace EventLy.IntegrationTests;

/// <summary>Root's view of purchases and manual activation of events paid outside the gateway (Q-24).</summary>
public sealed class PlatformPaymentsTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Tenant _tenant = null!;
    private PackageDto _basic = null!;
    private Member _root = null!;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        _tenant = await CreateTenantAsync(_client, "Manual WO");
        _basic = await PackageAsync(_client, _tenant.Owner, "BASIC");
        var root = await DevSignInAsync(_client, ApiFactory.RootEmail);
        _root = new Member(root.Body.User.Id, ApiFactory.RootEmail, UserRole.Root, root.Body.AccessToken, root.RefreshToken);
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private Task<HttpResponseMessage> Activate(Member member, Guid eventId, decimal amount = 150_000m) =>
        SendAsync(_client, HttpMethod.Post, $"/api/v1/platform/events/{eventId}/activate", member.AccessToken,
            new ManualActivationRequest(_basic.Id, amount, "Transfer BCA ref 8812"));

    [Fact]
    public async Task Root_activates_an_event_paid_by_bank_transfer()
    {
        var ev = await CreateAsync(_client, _tenant.Owner);
        var checkout = await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, _basic.Id);

        var payment = await ReadAsync<PaymentDto>(await Activate(_root, ev.Id, amount: 140_000m));

        payment.Provider.ShouldBe(PaymentProvider.Manual);
        payment.Status.ShouldBe(PaymentStatus.Paid);
        payment.Amount.ShouldBe(140_000m);
        payment.Note.ShouldBe("Transfer BCA ref 8812");
        var active = await GetAsync(_client, _tenant.Owner, ev.Id);
        active.Status.ShouldBe(EventStatus.Active);
        active.Package.ShouldNotBeNull().Code.ShouldBe("BASIC");
        (await GetPaymentAsync(_client, _tenant.Owner, checkout.Id)).Status.ShouldBe(PaymentStatus.Cancelled);
    }

    [Fact]
    public async Task An_active_event_cant_be_activated_again()
    {
        var ev = await CreateAsync(_client, _tenant.Owner);
        (await Activate(_root, ev.Id)).EnsureSuccessStatusCode();

        var again = await Activate(_root, ev.Id);

        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(again)).ShouldBe("event.invalid_status_change");
    }

    [Fact]
    public async Task Only_root_activates_manually()
    {
        var ev = await CreateAsync(_client, _tenant.Owner);

        (await Activate(_tenant.Owner, ev.Id)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await Activate(_tenant.Admin, ev.Id)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await Activate(_root, Guid.NewGuid())).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Root_sees_an_owners_events_and_purchases()
    {
        var owner = await CreateTenantAsync(_client, "Purchases WO");
        var paidEvent = await CreateAsync(_client, owner.Owner, Wedding("Paid wedding"));
        await PayAsync(_factory, _client, await StartCheckoutAsync(_client, owner.Owner, paidEvent.Id, _basic.Id));
        var pendingEvent = await CreateAsync(_client, owner.Owner, Wedding("Pending wedding"));
        await StartCheckoutAsync(_client, owner.Owner, pendingEvent.Id, _basic.Id);

        var listed = (await ReadAsync<List<PlatformOwnerDto>>(await SendAsync(_client, HttpMethod.Get,
            $"/api/v1/platform/owners?search={owner.Owner.Email}", _root.AccessToken))).ShouldHaveSingleItem();
        listed.Purchases.ShouldBe(new OwnerPurchaseSummaryDto(Events: 2, PaidEvents: 1, PendingPayments: 1));

        var detail = await ReadAsync<PlatformOwnerDetailDto>(await SendAsync(_client, HttpMethod.Get,
            $"/api/v1/platform/owners/{owner.Owner.UserId}", _root.AccessToken));
        detail.Events.Select(e => (e.Name, e.Status, e.PackageName)).ShouldBe(
            [("Paid wedding", EventStatus.Active, "Basic"), ("Pending wedding", EventStatus.PendingPayment, null)],
            ignoreOrder: true);
        detail.Payments.Select(p => (p.EventName, p.Status)).ShouldBe(
            [("Paid wedding", PaymentStatus.Paid), ("Pending wedding", PaymentStatus.Pending)], ignoreOrder: true);
    }

    [Fact]
    public async Task Root_never_sees_another_owners_data_by_mistake()
    {
        var other = await CreateTenantAsync(_client, "Other WO");
        await CreateAsync(_client, other.Owner, Wedding("Not mine"));

        var detail = await ReadAsync<PlatformOwnerDetailDto>(await SendAsync(_client, HttpMethod.Get,
            $"/api/v1/platform/owners/{_tenant.Owner.UserId}", _root.AccessToken));

        detail.Events.ShouldNotContain(e => e.Name == "Not mine");
    }
}
