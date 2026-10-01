using System.Net;
using EventLy.Api.Data.Seed;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Dtos.Payments;
using EventLy.Api.Entities;
using EventLy.Api.Payments;
using EventLy.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.EventRequests;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;

namespace EventLy.IntegrationTests;

/// <summary>Checkout, signed webhooks, reconciliation and the event lifecycle around payment.</summary>
public sealed class PaymentsTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Tenant _tenant = null!;
    private PackageDto _basic = null!;
    private PackageDto _premium = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        _tenant = await CreateTenantAsync(_client, "Payments WO");
        _basic = await PackageAsync(_client, _tenant.Owner, "BASIC");
        _premium = await PackageAsync(_client, _tenant.Owner, "PREMIUM");
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private Task<HttpResponseMessage> Send(HttpMethod method, string path, Member member, object? body = null) =>
        SendAsync(_client, method, path, member.AccessToken, body);

    private async Task<(EventDto Event, PaymentDto Payment)> CheckoutNewEventAsync(PackageDto? package = null)
    {
        var ev = await CreateAsync(_client, _tenant.Owner);
        var payment = await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, (package ?? _basic).Id);
        return (ev, payment);
    }

    private async Task<int> AuditCountAsync(Guid entityId, string action)
    {
        await using var db = postgres.CreateDbContext();
        return await db.AuditLogs.CountAsync(a => a.EntityId == entityId && a.Action == action, Ct);
    }

    [Fact]
    public async Task Checkout_charges_the_package_price_and_waits_for_payment()
    {
        var ev = await CreateAsync(_client, _tenant.Owner);

        var response = await CheckoutAsync(_client, _tenant.Owner, ev.Id, _basic.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var payment = await ReadAsync<PaymentDto>(response);
        payment.Amount.ShouldBe(150_000m);
        payment.Currency.ShouldBe("IDR");
        payment.Status.ShouldBe(PaymentStatus.Pending);
        payment.Provider.ShouldBe(PaymentProvider.Fake);
        payment.PackageName.ShouldBe("Basic");
        payment.CheckoutUrl.ShouldBe($"/app/payments/{payment.Id}");
        payment.ExpiresAt.ShouldNotBeNull().ShouldBeGreaterThan(_factory.Time.GetUtcNow().AddHours(23));
        (await GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.PendingPayment);
    }

    [Fact]
    public async Task Asking_again_reuses_the_open_checkout_and_another_package_replaces_it()
    {
        var (ev, first) = await CheckoutNewEventAsync();

        var again = await CheckoutAsync(_client, _tenant.Owner, ev.Id, _basic.Id);
        again.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadAsync<PaymentDto>(again)).Id.ShouldBe(first.Id);

        var premium = await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, _premium.Id);
        premium.Amount.ShouldBe(350_000m);
        (await GetPaymentAsync(_client, _tenant.Owner, first.Id)).Status.ShouldBe(PaymentStatus.Cancelled);
        (await GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.PendingPayment);
        (await Gateway(_factory).GetStatusAsync(first.ProviderReference!, Ct)).Status.ShouldBe(GatewayStatus.Expired);
    }

    [Fact]
    public async Task The_paid_webhook_activates_the_event_with_the_package_it_paid_for()
    {
        var (ev, payment) = await CheckoutNewEventAsync();

        await PayAsync(_factory, _client, payment);

        var paid = await GetPaymentAsync(_client, _tenant.Owner, payment.Id);
        paid.Status.ShouldBe(PaymentStatus.Paid);
        paid.PaidAt.ShouldNotBeNull();
        var active = await GetAsync(_client, _tenant.Owner, ev.Id);
        active.Status.ShouldBe(EventStatus.Active);
        active.ActivatedAt.ShouldNotBeNull();
        var package = active.Package.ShouldNotBeNull();
        package.Code.ShouldBe("BASIC");
        package.Features.MaxStaff.ShouldBe(2);
    }

    [Fact]
    public async Task A_replayed_webhook_changes_nothing()
    {
        var (ev, payment) = await CheckoutNewEventAsync();
        var webhook = Gateway(_factory).Simulate(payment.ProviderReference!, GatewayStatus.Paid, payment.Amount);

        (await DeliverAsync(_client, webhook)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await DeliverAsync(_client, webhook)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var late = Gateway(_factory).Simulate(payment.ProviderReference!, GatewayStatus.Failed, payment.Amount);
        (await DeliverAsync(_client, late)).StatusCode.ShouldBe(HttpStatusCode.OK);

        (await GetPaymentAsync(_client, _tenant.Owner, payment.Id)).Status.ShouldBe(PaymentStatus.Paid);
        (await GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.Active);
        (await AuditCountAsync(payment.Id, AuditActions.PaymentStatusChanged)).ShouldBe(1);
    }

    [Fact]
    public async Task Duplicate_webhooks_arriving_together_settle_once()
    {
        var (ev, payment) = await CheckoutNewEventAsync();
        var webhook = Gateway(_factory).Simulate(payment.ProviderReference!, GatewayStatus.Paid, payment.Amount);

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => DeliverAsync(_client, webhook)));

        responses.ShouldAllBe(r => r.IsSuccessStatusCode);
        (await GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.Active);
        (await AuditCountAsync(payment.Id, AuditActions.PaymentStatusChanged)).ShouldBe(1);
    }

    [Fact]
    public async Task A_tampered_webhook_is_refused()
    {
        var (ev, payment) = await CheckoutNewEventAsync();
        var webhook = Gateway(_factory).Simulate(payment.ProviderReference!, GatewayStatus.Paid, payment.Amount);

        var tampered = await DeliverAsync(_client, webhook with { Body = webhook.Body.Replace("150000", "1", StringComparison.Ordinal) });
        var unsigned = await DeliverAsync(_client, webhook, signature: "0000");

        tampered.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await ProblemCodeAsync(tampered)).ShouldBe("payment.invalid_signature");
        unsigned.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.PendingPayment);
    }

    [Fact]
    public async Task Unknown_providers_are_404_and_unknown_payments_are_acknowledged()
    {
        var unknownProvider = await _client.PostAsync("/api/v1/payments/webhooks/paypal", new StringContent("{}"), Ct);
        var unknownPayment = Gateway(_factory).Simulate("fake_does_not_exist", GatewayStatus.Paid, 1m);

        unknownProvider.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await DeliverAsync(_client, unknownPayment)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task A_paid_webhook_with_the_wrong_amount_leaves_the_payment_pending()
    {
        var (ev, payment) = await CheckoutNewEventAsync();
        var webhook = Gateway(_factory).Simulate(payment.ProviderReference!, GatewayStatus.Paid, 1_000m);

        (await DeliverAsync(_client, webhook)).StatusCode.ShouldBe(HttpStatusCode.OK);

        (await GetPaymentAsync(_client, _tenant.Owner, payment.Id)).Status.ShouldBe(PaymentStatus.Pending);
        (await GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.PendingPayment);
        (await AuditCountAsync(payment.Id, AuditActions.PaymentAmountMismatch)).ShouldBe(1);
    }

    [Fact]
    public async Task A_failed_payment_puts_the_event_back_to_draft_and_it_can_be_tried_again()
    {
        var (ev, payment) = await CheckoutNewEventAsync();

        var failed = await ReadAsync<PaymentDto>(await Send(HttpMethod.Post, $"/api/v1/payments/{payment.Id}/simulate",
            _tenant.Owner, new SimulatePaymentRequest(SimulatedOutcome.Failed)));

        failed.Status.ShouldBe(PaymentStatus.Failed);
        (await GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.Draft);
        var retry = await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, _basic.Id);
        retry.Id.ShouldNotBe(payment.Id);
    }

    [Fact]
    public async Task The_simulated_checkout_pays_through_the_webhook_path()
    {
        var (ev, payment) = await CheckoutNewEventAsync();

        var paid = await ReadAsync<PaymentDto>(await Send(HttpMethod.Post, $"/api/v1/payments/{payment.Id}/simulate",
            _tenant.Owner, new SimulatePaymentRequest(SimulatedOutcome.Paid)));

        paid.Status.ShouldBe(PaymentStatus.Paid);
        (await GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.Active);
        (await Send(HttpMethod.Post, $"/api/v1/payments/{payment.Id}/simulate", _tenant.Owner,
            new SimulatePaymentRequest(SimulatedOutcome.Paid))).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Only_draft_or_pending_events_can_be_paid_for()
    {
        var (active, payment) = await CheckoutNewEventAsync();
        await PayAsync(_factory, _client, payment);
        var cancelled = await CreateAsync(_client, _tenant.Owner);
        (await Send(HttpMethod.Post, $"/api/v1/events/{cancelled.Id}/cancel", _tenant.Owner)).EnsureSuccessStatusCode();

        foreach (var ev in new[] { active.Id, cancelled.Id })
        {
            var response = await CheckoutAsync(_client, _tenant.Owner, ev, _basic.Id);
            response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
            (await ProblemCodeAsync(response)).ShouldBe("payment.event_not_payable");
        }
    }

    [Fact]
    public async Task Cancelling_an_event_closes_its_open_checkout()
    {
        var (ev, payment) = await CheckoutNewEventAsync();

        (await Send(HttpMethod.Post, $"/api/v1/events/{ev.Id}/cancel", _tenant.Owner)).EnsureSuccessStatusCode();

        (await GetPaymentAsync(_client, _tenant.Owner, payment.Id)).Status.ShouldBe(PaymentStatus.Cancelled);
        // Money that still arrives is recorded for Root, but the cancelled event stays cancelled.
        await PayAsync(_factory, _client, payment);
        (await GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.Cancelled);
        (await AuditCountAsync(payment.Id, AuditActions.PaymentLateSettlement)).ShouldBe(1);
    }

    [Fact]
    public async Task Admin_and_staff_cannot_pay_or_see_payments()
    {
        var (ev, payment) = await CheckoutNewEventAsync();

        foreach (var member in new[] { _tenant.Admin, _tenant.Staff })
        {
            (await CheckoutAsync(_client, member, ev.Id, _basic.Id)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
            (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/payments", member)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
            (await Send(HttpMethod.Get, $"/api/v1/payments/{payment.Id}", member)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        }
    }

    [Fact]
    public async Task Staff_never_see_the_package_of_an_event()
    {
        var (ev, payment) = await CheckoutNewEventAsync();
        await PayAsync(_factory, _client, payment);
        (await Send(HttpMethod.Put, $"/api/v1/events/{ev.Id}/staff", _tenant.Owner,
            new AssignStaffRequest([_tenant.Staff.UserId]))).EnsureSuccessStatusCode();

        (await GetAsync(_client, _tenant.Admin, ev.Id)).Package.ShouldNotBeNull();
        (await GetAsync(_client, _tenant.Staff, ev.Id)).Package.ShouldBeNull();
    }

    [Fact]
    public async Task The_package_limits_how_many_staff_work_at_the_event()
    {
        var root = (await DevSignInAsync(_client, ApiFactory.RootEmail)).Body.AccessToken;
        var features = PackageSeed.Initial()[0].Features.Copy();
        features.MaxStaff = 0;
        var noStaff = await ReadAsync<PackageDto>(await SendAsync(_client, HttpMethod.Post, "/api/v1/platform/packages", root,
            new CreatePackageRequest("NOSTAFF" + Guid.NewGuid().ToString("N")[..6], "No staff", 100_000m, "IDR", features, true)));
        var ev = await CreateAsync(_client, _tenant.Owner);
        (await Send(HttpMethod.Put, $"/api/v1/events/{ev.Id}/staff", _tenant.Owner,
            new AssignStaffRequest([_tenant.Staff.UserId]))).EnsureSuccessStatusCode();

        var tooSmall = await CheckoutAsync(_client, _tenant.Owner, ev.Id, noStaff.Id);
        tooSmall.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(tooSmall)).ShouldBe("payment.staff_limit_exceeded");

        // Basic allows 2 staff once paid.
        await PayAsync(_factory, _client, await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, _basic.Id));
        var second = await AddMemberAsync(_client, _tenant.Owner, UserRole.Staff);
        var third = await AddMemberAsync(_client, _tenant.Owner, UserRole.Staff);
        var overLimit = await Send(HttpMethod.Put, $"/api/v1/events/{ev.Id}/staff", _tenant.Owner,
            new AssignStaffRequest([_tenant.Staff.UserId, second.UserId, third.UserId]));
        overLimit.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(overLimit)).ShouldBe("event.staff_limit_exceeded");
    }

    [Fact]
    public async Task Root_editing_a_package_doesnt_change_events_that_already_paid()
    {
        var root = (await DevSignInAsync(_client, ApiFactory.RootEmail)).Body.AccessToken;
        var package = await ReadAsync<PackageDto>(await SendAsync(_client, HttpMethod.Post, "/api/v1/platform/packages", root,
            new CreatePackageRequest("SNAP" + Guid.NewGuid().ToString("N")[..6], "Snapshot", 200_000m, "IDR",
                PackageSeed.Initial()[0].Features.Copy(), true)));
        var (ev, payment) = await CheckoutNewEventAsync(package);
        await PayAsync(_factory, _client, payment);

        var features = package.Features;
        features.MaxGuests = 9_999;
        (await SendAsync(_client, HttpMethod.Put, $"/api/v1/platform/packages/{package.Id}", root,
            new UpdatePackageRequest("Snapshot v2", 999_000m, "IDR", features, true))).EnsureSuccessStatusCode();

        var paid = await GetAsync(_client, _tenant.Owner, ev.Id);
        paid.Package.ShouldNotBeNull().Name.ShouldBe("Snapshot");
        paid.Package.Features.MaxGuests.ShouldBe(150);
        (await GetPaymentAsync(_client, _tenant.Owner, payment.Id)).Amount.ShouldBe(200_000m);
    }

    [Fact]
    public async Task Reconciliation_settles_a_payment_whose_webhook_was_lost()
    {
        var (ev, payment) = await CheckoutNewEventAsync();
        Gateway(_factory).Simulate(payment.ProviderReference!, GatewayStatus.Paid, payment.Amount); // never delivered
        _factory.Time.Advance(TimeSpan.FromMinutes(6));

        var result = await ReadAsync<ReconciliationResult>(await ReconcileAsync(_client));

        result.Paid.ShouldBeGreaterThanOrEqualTo(1);
        (await GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.Active);
    }

    [Fact]
    public async Task Reconciliation_expires_an_unpaid_checkout_and_the_event_goes_back_to_draft()
    {
        var (ev, payment) = await CheckoutNewEventAsync();
        _factory.Time.Advance(TimeSpan.FromHours(25));

        (await ReconcileAsync(_client)).EnsureSuccessStatusCode();

        (await GetPaymentAsync(_client, _tenant.Owner, payment.Id)).Status.ShouldBe(PaymentStatus.Expired);
        (await GetAsync(_client, _tenant.Owner, ev.Id)).Status.ShouldBe(EventStatus.Draft);
    }

    [Fact]
    public async Task An_overdue_checkout_expires_when_the_owner_looks_at_it()
    {
        var (_, payment) = await CheckoutNewEventAsync();
        _factory.Time.Advance(TimeSpan.FromHours(25));

        (await GetPaymentAsync(_client, _tenant.Owner, payment.Id)).Status.ShouldBe(PaymentStatus.Expired);
    }

    [Fact]
    public async Task Reconciliation_needs_the_maintenance_key()
    {
        (await ReconcileAsync(_client, key: null)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await ReconcileAsync(_client, key: "wrong")).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task The_receipt_is_available_once_paid()
    {
        var (ev, payment) = await CheckoutNewEventAsync();
        var path = $"/api/v1/payments/{payment.Id}/receipt";

        var early = await Send(HttpMethod.Get, path, _tenant.Owner);
        early.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(early)).ShouldBe("payment.not_paid");

        await PayAsync(_factory, _client, payment);
        var receipt = await ReadAsync<PaymentReceiptDto>(await Send(HttpMethod.Get, path, _tenant.Owner));
        receipt.OrganizationName.ShouldBe("Payments WO");
        receipt.OwnerEmail.ShouldBe(_tenant.Owner.Email);
        receipt.EventId.ShouldBe(ev.Id);
        receipt.PackageName.ShouldBe("Basic");
        receipt.Amount.ShouldBe(150_000m);
        receipt.Reference.ShouldBe(payment.ProviderReference);
    }

    [Fact]
    public async Task The_event_lists_its_payments_newest_first()
    {
        var (ev, first) = await CheckoutNewEventAsync();
        _factory.Time.Advance(TimeSpan.FromSeconds(1));
        var second = await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, _premium.Id);

        var payments = await ReadAsync<List<PaymentDto>>(await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/payments", _tenant.Owner));

        payments.Select(p => p.Id).ShouldBe([second.Id, first.Id]);
    }
}
