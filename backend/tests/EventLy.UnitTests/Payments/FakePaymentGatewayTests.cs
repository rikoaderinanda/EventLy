using EventLy.Api.Payments;
using Microsoft.AspNetCore.Http;
using Shouldly;

namespace EventLy.UnitTests.Payments;

public sealed class FakePaymentGatewayTests
{
    private readonly FakePaymentGateway _gateway = new(TimeProvider.System);

    private static HeaderDictionary Signed(string signature) => new() { [FakePaymentGateway.SignatureHeader] = signature };

    [Fact]
    public void A_signed_webhook_is_read()
    {
        var webhook = _gateway.Simulate("fake_1", GatewayStatus.Paid, 150_000m);

        var notification = _gateway.VerifyWebhook(webhook.Body, Signed(webhook.Signature)).ShouldNotBeNull();

        notification.ProviderReference.ShouldBe("fake_1");
        notification.Status.ShouldBe(GatewayStatus.Paid);
        notification.Amount.ShouldBe(150_000m);
        notification.PaidAt.ShouldNotBeNull();
    }

    [Fact]
    public void A_tampered_body_is_refused()
    {
        var webhook = _gateway.Simulate("fake_1", GatewayStatus.Paid, 150_000m);
        var tampered = webhook.Body.Replace("150000", "1", StringComparison.Ordinal);

        _gateway.VerifyWebhook(tampered, Signed(webhook.Signature)).ShouldBeNull();
    }

    [Fact]
    public void A_missing_or_foreign_signature_is_refused()
    {
        var webhook = _gateway.Simulate("fake_1", GatewayStatus.Paid, 150_000m);
        var otherProcess = new FakePaymentGateway(TimeProvider.System);

        _gateway.VerifyWebhook(webhook.Body, new HeaderDictionary()).ShouldBeNull();
        otherProcess.VerifyWebhook(webhook.Body, Signed(webhook.Signature)).ShouldBeNull();
    }

    [Fact]
    public async Task Status_follows_checkout_simulation_and_expiry()
    {
        var checkout = await _gateway.CreateCheckoutAsync(
            new GatewayCheckoutRequest(Guid.NewGuid(), 150_000m, "IDR", "Basic", DateTimeOffset.UtcNow.AddDays(1)),
            TestContext.Current.CancellationToken);
        (await _gateway.GetStatusAsync(checkout.ProviderReference, TestContext.Current.CancellationToken))
            .Status.ShouldBe(GatewayStatus.Pending);

        await _gateway.ExpireAsync(checkout.ProviderReference, TestContext.Current.CancellationToken);

        (await _gateway.GetStatusAsync(checkout.ProviderReference, TestContext.Current.CancellationToken))
            .Status.ShouldBe(GatewayStatus.Expired);
    }

    [Fact]
    public async Task Expiring_a_paid_checkout_keeps_it_paid()
    {
        _gateway.Simulate("fake_paid", GatewayStatus.Paid, 150_000m);

        await _gateway.ExpireAsync("fake_paid", TestContext.Current.CancellationToken);

        (await _gateway.GetStatusAsync("fake_paid", TestContext.Current.CancellationToken)).Status.ShouldBe(GatewayStatus.Paid);
    }
}
