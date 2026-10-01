using EventLy.Api.Entities;

namespace EventLy.Api.Payments;

/// <summary>
/// The payment provider behind one interface. This is an abstraction on purpose: the provider is
/// swappable (Xendit later, decision Q-1b), and development and CI need <see cref="FakePaymentGateway"/>
/// because real payments can't run there. Everything else about payments lives in PaymentService.
/// </summary>
public interface IPaymentGateway
{
    PaymentProvider Provider { get; }

    /// <summary>Creates the hosted checkout. <see cref="GatewayCheckoutRequest.PaymentId"/> is the idempotency key.</summary>
    Task<GatewayCheckout> CreateCheckoutAsync(GatewayCheckoutRequest request, CancellationToken ct);

    /// <summary>Asks the provider for the current state (reconciliation, when a webhook was lost).</summary>
    Task<GatewayPaymentState> GetStatusAsync(string providerReference, CancellationToken ct);

    /// <summary>Closes a checkout that is no longer wanted, so it can't be paid any more.</summary>
    Task ExpireAsync(string providerReference, CancellationToken ct);

    /// <summary>Checks the webhook's signature and reads it; null when the signature is wrong.</summary>
    GatewayNotification? VerifyWebhook(string body, IHeaderDictionary headers);
}

public sealed record GatewayCheckoutRequest(
    Guid PaymentId,
    decimal Amount,
    string Currency,
    string Description,
    DateTimeOffset ExpiresAt);

public sealed record GatewayCheckout(string ProviderReference, string CheckoutUrl);

public enum GatewayStatus
{
    Pending,
    Paid,
    Failed,
    Expired,
}

public sealed record GatewayPaymentState(GatewayStatus Status, decimal? Amount, DateTimeOffset? PaidAt);

public sealed record GatewayNotification(string ProviderReference, GatewayStatus Status, decimal? Amount, DateTimeOffset? PaidAt);
