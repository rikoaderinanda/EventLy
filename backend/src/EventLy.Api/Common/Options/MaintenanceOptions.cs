namespace EventLy.Api.Common.Options;

/// <summary>
/// Settings under <c>Maintenance</c>. Scheduled jobs (Cloud Scheduler in production) call the
/// maintenance endpoints with this key in the <c>X-Maintenance-Key</c> header. Empty turns them off.
/// </summary>
public sealed class MaintenanceOptions
{
    public const string SectionName = "Maintenance";

    public const string KeyHeader = "X-Maintenance-Key";

    /// <summary>Secret. At least 32 characters.</summary>
    public string Key { get; init; } = "";
}
