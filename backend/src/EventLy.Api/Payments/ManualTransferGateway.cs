using EventLy.Api.Entities;

namespace EventLy.Api.Payments;

/// <summary>
/// Bank transfer confirmed by Root (decision Q-73), until an online gateway exists. A checkout is a page of
/// the PWA that shows the transfer details and a reference to put in the transfer note; nothing is sent to a
/// provider. The payment stays pending until Root confirms it with the manual activation, and the
/// reconciliation job expires it after <see cref="PaymentOptions.CheckoutMinutes"/> like any checkout.
/// </summary>
public sealed class ManualTransferGateway : IPaymentGateway
{
    public PaymentProvider Provider => PaymentProvider.Manual;

    /// <summary>The reference the Owner writes in the transfer note, so Root can match the money to the event.</summary>
    public static string ReferenceFor(Guid paymentId) => $"EVL-{paymentId.ToString("N")[^8..].ToUpperInvariant()}";

    public Task<GatewayCheckout> CreateCheckoutAsync(GatewayCheckoutRequest request, CancellationToken ct) =>
        Task.FromResult(new GatewayCheckout(ReferenceFor(request.PaymentId), $"/app/payments/{request.PaymentId}"));

    /// <summary>The state lives only in our database: Root's confirmation is the "settlement".</summary>
    public Task<GatewayPaymentState> GetStatusAsync(string providerReference, CancellationToken ct) =>
        Task.FromResult(new GatewayPaymentState(GatewayStatus.Pending, null, null));

    public Task ExpireAsync(string providerReference, CancellationToken ct) => Task.CompletedTask;

    /// <summary>No provider, so no webhooks: anything posted to the Manual webhook is refused.</summary>
    public GatewayNotification? VerifyWebhook(string body, IHeaderDictionary headers) => null;
}

/// <summary>Where the Owner transfers to (settings under <c>Payments:Manual</c>). Shown on the checkout page.</summary>
public sealed class ManualTransferOptions
{
    public string BankName { get; init; } = "";

    public string AccountNumber { get; init; } = "";

    public string AccountHolder { get; init; } = "";

    /// <summary>Where the Owner sends the proof of transfer: a WhatsApp number or an e-mail address.</summary>
    public string ConfirmationContact { get; init; } = "";

    public bool IsComplete =>
        !string.IsNullOrWhiteSpace(BankName) && !string.IsNullOrWhiteSpace(AccountNumber)
        && !string.IsNullOrWhiteSpace(AccountHolder) && !string.IsNullOrWhiteSpace(ConfirmationContact);
}
