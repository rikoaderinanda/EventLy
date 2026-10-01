using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.Payments;

public sealed record CreatePaymentRequest(Guid PackageId);

public sealed record PaymentDto(
    Guid Id,
    Guid EventId,
    Guid PackageId,
    string PackageName,
    decimal Amount,
    string Currency,
    PaymentStatus Status,
    PaymentProvider Provider,
    string? ProviderReference,
    string? CheckoutUrl,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? PaidAt,
    string? Note,
    DateTimeOffset CreatedAt);

/// <summary>Data for the printable receipt (decision Q-36). No tax invoice in the MVP.</summary>
public sealed record PaymentReceiptDto(
    Guid PaymentId,
    string Reference,
    string OrganizationName,
    string? OrganizationEmail,
    string OwnerName,
    string OwnerEmail,
    Guid EventId,
    string EventName,
    DateTimeOffset EventDate,
    string EventTimeZone,
    string PackageName,
    decimal Amount,
    string Currency,
    PaymentProvider Provider,
    DateTimeOffset PaidAt);

/// <summary>Development only: what the simulated checkout reports.</summary>
public enum SimulatedOutcome
{
    Paid,
    Failed,
}

public sealed record SimulatePaymentRequest(SimulatedOutcome Outcome);

/// <summary>Root activates an event paid outside the gateway, for example by bank transfer (Q-24).</summary>
public sealed record ManualActivationRequest(Guid PackageId, decimal Amount, string Note);

public sealed record ReconciliationResult(int Checked, int Paid, int Failed, int Expired);
