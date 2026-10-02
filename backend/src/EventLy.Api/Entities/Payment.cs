namespace EventLy.Api.Entities;

public enum PaymentStatus
{
    Pending,
    Paid,
    Failed,
    Expired,

    /// <summary>Replaced by a newer checkout, or the event was cancelled before payment.</summary>
    Cancelled,
}

public enum PaymentProvider
{
    /// <summary>Simulated gateway for development and tests (decision Q-1b).</summary>
    Fake,
    Xendit,

    /// <summary>Paid outside the gateway and confirmed by Root (decision Q-24).</summary>
    Manual,
}

/// <summary>
/// One attempt to pay for an event's package. The amount always comes from the server-side package,
/// never from the client. At most one Paid payment per event (unique partial index).
/// </summary>
public sealed class Payment : ITenantOwned, IHasTimestamps
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public Guid EventId { get; init; }

    public Guid PackageId { get; init; }

    /// <summary>The package at checkout; copied to the event when the payment settles.</summary>
    public required PackageSnapshot PackageSnapshot { get; init; }

    public decimal Amount { get; init; }

    public string Currency { get; init; } = Currencies.Idr;

    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;

    public PaymentProvider Provider { get; init; }

    /// <summary>The provider's id for this payment; unique per provider, which makes webhooks idempotent.</summary>
    public string? ProviderReference { get; set; }

    public string? CheckoutUrl { get; set; }

    public DateTimeOffset? ExpiresAt { get; init; }

    /// <summary>When the money was received (the spec's payment_date).</summary>
    public DateTimeOffset? PaidAt { get; set; }

    /// <summary>Root user who confirmed a <see cref="PaymentProvider.Manual"/> payment.</summary>
    public Guid? ConfirmedBy { get; set; }

    /// <summary>For manual payments, for example the bank transfer reference.</summary>
    public string? Note { get; set; }

    /// <summary>PostgreSQL xmin: two webhooks for the same payment can't both settle it.</summary>
    public uint Version { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
