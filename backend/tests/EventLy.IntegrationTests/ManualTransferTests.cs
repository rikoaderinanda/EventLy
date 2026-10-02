using System.Net;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Dtos.Payments;
using EventLy.Api.Dtos.Platform;
using EventLy.Api.Entities;
using EventLy.Api.Payments;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;
using Events = EventLy.IntegrationTests.Infrastructure.EventRequests;

namespace EventLy.IntegrationTests;

/// <summary>
/// Bank transfer confirmed by Root (Q-73): the production payment mode until an online gateway exists.
/// The Owner's checkout shows the bank details and a reference; Root confirms that same checkout.
/// </summary>
public sealed class ManualTransferTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private static readonly Dictionary<string, string?> Manual = new()
    {
        ["Payments:Provider"] = "Manual",
        ["Payments:CheckoutMinutes"] = "4320",
        ["Payments:Manual:BankName"] = "BSI",
        ["Payments:Manual:AccountNumber"] = "7123456789",
        ["Payments:Manual:AccountHolder"] = "PT EventLy Indonesia",
        ["Payments:Manual:ConfirmationContact"] = "WhatsApp 0812 0000 0000",
    };

    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Tenant _tenant = null!;
    private PackageDto _basic = null!;
    private Member _root = null!;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString, Manual);
        _client = _factory.CreateClient();
        _tenant = await CreateTenantAsync(_client, "Transfer WO");
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

    [Fact]
    public async Task The_checkout_waits_for_a_transfer_and_shows_the_bank_details()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);

        var payment = await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, _basic.Id);

        payment.Provider.ShouldBe(PaymentProvider.Manual);
        payment.Status.ShouldBe(PaymentStatus.Pending);
        payment.ProviderReference.ShouldBe(ManualTransferGateway.ReferenceFor(payment.Id));
        payment.ProviderReference!.ShouldMatch("^EVL-[0-9A-F]{8}$");
        payment.CheckoutUrl.ShouldBe($"/app/payments/{payment.Id}");
        (await Events.GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.PendingPayment);

        var transfer = await ReadAsync<ManualTransferDto>(await SendAsync(_client, HttpMethod.Get,
            $"/api/v1/payments/{payment.Id}/transfer", _tenant.Owner.AccessToken));
        transfer.BankName.ShouldBe("BSI");
        transfer.AccountNumber.ShouldBe("7123456789");
        transfer.AccountHolder.ShouldBe("PT EventLy Indonesia");
        transfer.ConfirmationContact.ShouldBe("WhatsApp 0812 0000 0000");
        transfer.Reference.ShouldBe(payment.ProviderReference);
        transfer.Amount.ShouldBe(150_000m);
        transfer.Currency.ShouldBe("IDR");
        // The database keeps microseconds, the checkout response had the full clock value.
        transfer.ExpiresAt!.Value.ShouldBe(payment.ExpiresAt!.Value, TimeSpan.FromMilliseconds(1));
    }

    [Fact]
    public async Task Root_confirms_the_owners_own_checkout()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var payment = await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, _basic.Id);

        var confirmed = await ReadAsync<PaymentDto>(await SendAsync(_client, HttpMethod.Post,
            $"/api/v1/platform/events/{ev.Id}/activate", _root.AccessToken,
            new ManualActivationRequest(_basic.Id, 150_000m, $"BSI, berita {payment.ProviderReference}")));

        confirmed.Id.ShouldBe(payment.Id, "the Owner's checkout is confirmed, not replaced");
        confirmed.Status.ShouldBe(PaymentStatus.Paid);
        confirmed.ProviderReference.ShouldBe(payment.ProviderReference);
        (await Events.GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.Active);
        var history = await ReadAsync<List<PaymentDto>>(await SendAsync(_client, HttpMethod.Get,
            $"/api/v1/events/{ev.Id}/payments", _tenant.Owner.AccessToken));
        history.ShouldHaveSingleItem().Status.ShouldBe(PaymentStatus.Paid);
        // The transfer page is gone once paid; the receipt takes over.
        (await SendAsync(_client, HttpMethod.Get, $"/api/v1/payments/{payment.Id}/transfer", _tenant.Owner.AccessToken))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await SendAsync(_client, HttpMethod.Get, $"/api/v1/payments/{payment.Id}/receipt", _tenant.Owner.AccessToken))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Root_sees_the_reference_of_a_pending_transfer()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var payment = await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, _basic.Id);

        var owner = await ReadAsync<PlatformOwnerDetailDto>(await SendAsync(_client, HttpMethod.Get,
            $"/api/v1/platform/owners/{_tenant.Owner.UserId}", _root.AccessToken));

        owner.Payments.Single(p => p.Id == payment.Id).Reference.ShouldBe(payment.ProviderReference);
    }

    [Fact]
    public async Task An_unpaid_transfer_expires_and_the_event_goes_back_to_draft()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var payment = await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, _basic.Id);

        _factory.Time.Advance(TimeSpan.FromMinutes(4320 + 1));
        (await ReconcileAsync(_client)).EnsureSuccessStatusCode();

        (await GetPaymentAsync(_client, _tenant.Owner, payment.Id)).Status.ShouldBe(PaymentStatus.Expired);
        (await Events.GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.Draft);
    }

    [Fact]
    public async Task Nothing_can_be_settled_through_a_webhook_or_the_simulator()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var payment = await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, _basic.Id);

        var webhook = await SendAsync(_client, HttpMethod.Post, "/api/v1/payments/webhooks/manual", null,
            new { reference = payment.ProviderReference, status = "Paid" });
        webhook.IsSuccessStatusCode.ShouldBeFalse();
        (await GetPaymentAsync(_client, _tenant.Owner, payment.Id)).Status.ShouldBe(PaymentStatus.Pending);
    }

    [Fact]
    public async Task The_app_refuses_to_start_without_the_bank_details()
    {
        var incomplete = new Dictionary<string, string?>(Manual) { ["Payments:Manual:AccountNumber"] = "" };
        await using var factory = new ApiFactory(postgres.ConnectionString, incomplete);

        // Program.cs logs the reason ("Payments:Provider 'Manual' needs Payments:Manual:...") and exits,
        // so the host never starts.
        Should.Throw<Exception>(() => factory.CreateClient())
            .Message.ShouldContain("exited without ever building an IHost");
    }
}
