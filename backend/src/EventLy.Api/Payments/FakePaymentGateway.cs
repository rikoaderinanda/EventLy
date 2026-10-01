using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using EventLy.Api.Entities;

namespace EventLy.Api.Payments;

/// <summary>
/// Simulated gateway for development and tests. The checkout is a page of the PWA where the Owner
/// picks "paid" or "failed"; the result comes back as a signed webhook through the same endpoint and
/// checks as a real provider's. State is kept in memory, so after a restart unknown payments read as
/// pending and reconciliation expires them.
/// </summary>
public sealed class FakePaymentGateway(TimeProvider timeProvider) : IPaymentGateway
{
    public const string SignatureHeader = "X-Fake-Signature";

    // A new key per process: only this process signs and verifies fake webhooks.
    private readonly byte[] _webhookKey = RandomNumberGenerator.GetBytes(32);
    private readonly ConcurrentDictionary<string, GatewayPaymentState> _payments = new();

    public PaymentProvider Provider => PaymentProvider.Fake;

    public Task<GatewayCheckout> CreateCheckoutAsync(GatewayCheckoutRequest request, CancellationToken ct)
    {
        var reference = $"fake_{request.PaymentId:N}";
        _payments.TryAdd(reference, new GatewayPaymentState(GatewayStatus.Pending, request.Amount, null));
        return Task.FromResult(new GatewayCheckout(reference, $"/app/payments/{request.PaymentId}"));
    }

    public Task<GatewayPaymentState> GetStatusAsync(string providerReference, CancellationToken ct) =>
        Task.FromResult(_payments.GetValueOrDefault(providerReference, new GatewayPaymentState(GatewayStatus.Pending, null, null)));

    public Task ExpireAsync(string providerReference, CancellationToken ct)
    {
        _payments.AddOrUpdate(providerReference,
            new GatewayPaymentState(GatewayStatus.Expired, null, null),
            (_, state) => state.Status == GatewayStatus.Pending ? state with { Status = GatewayStatus.Expired } : state);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Records the outcome as the provider would and returns the webhook it would send.
    /// Tests can drop the webhook to simulate a lost callback (reconciliation then picks it up).
    /// </summary>
    public FakeWebhook Simulate(string providerReference, GatewayStatus outcome, decimal amount)
    {
        var paidAt = outcome == GatewayStatus.Paid ? timeProvider.GetUtcNow() : (DateTimeOffset?)null;
        _payments[providerReference] = new GatewayPaymentState(outcome, amount, paidAt);

        var body = JsonSerializer.Serialize(new FakeWebhookBody(providerReference, outcome.ToString(),
            amount.ToString(CultureInfo.InvariantCulture), paidAt));
        return new FakeWebhook(body, Sign(body));
    }

    public GatewayNotification? VerifyWebhook(string body, IHeaderDictionary headers)
    {
        var signature = headers[SignatureHeader].ToString();
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(signature), Encoding.ASCII.GetBytes(Sign(body))))
        {
            return null;
        }

        var parsed = JsonSerializer.Deserialize<FakeWebhookBody>(body);
        if (parsed is null || !Enum.TryParse<GatewayStatus>(parsed.Status, out var status))
        {
            return null;
        }
        return new GatewayNotification(parsed.Reference, status,
            decimal.Parse(parsed.Amount, CultureInfo.InvariantCulture), parsed.PaidAt);
    }

    public string Sign(string body) => Convert.ToHexStringLower(HMACSHA256.HashData(_webhookKey, Encoding.UTF8.GetBytes(body)));

    private sealed record FakeWebhookBody(string Reference, string Status, string Amount, DateTimeOffset? PaidAt);
}

public sealed record FakeWebhook(string Body, string Signature);
