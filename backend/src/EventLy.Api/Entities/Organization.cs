namespace EventLy.Api.Entities;

public enum OrganizationStatus
{
    Active,

    /// <summary>Set by Root. Nobody in the organization can sign in.</summary>
    Suspended,
}

/// <summary>The tenant. One Owner has exactly one organization (unique <see cref="OwnerUserId"/>).</summary>
public sealed class Organization : IHasTimestamps
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public required string Name { get; set; }

    /// <summary>Optional contact details, so Root can reach the organization (and for payment receipts).</summary>
    public string? ContactEmail { get; set; }

    public string? ContactPhone { get; set; }

    public Guid OwnerUserId { get; init; }

    public OrganizationStatus Status { get; set; } = OrganizationStatus.Active;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
