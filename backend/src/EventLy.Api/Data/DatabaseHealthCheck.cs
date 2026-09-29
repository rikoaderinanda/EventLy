using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace EventLy.Api.Data;

/// <summary>
/// Readiness check that opens one raw connection and runs <c>SELECT 1</c>.
/// It deliberately bypasses the EF Core retry strategy: with retries a down database made
/// /health/ready hang for over a minute, which a Cloud Run probe would treat as a timeout.
/// </summary>
public sealed class DatabaseHealthCheck(IConfiguration configuration) : IHealthCheck
{
    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(Timeout);

        try
        {
            await using var connection = new NpgsqlConnection(PersistenceSetup.GetConnectionString(configuration));
            await connection.OpenAsync(timeout.Token);
            await using var command = new NpgsqlCommand("SELECT 1", connection);
            await command.ExecuteScalarAsync(timeout.Token);
            return HealthCheckResult.Healthy();
        }
        catch (Exception ex) when (ex is NpgsqlException or OperationCanceledException or TimeoutException)
        {
            return new HealthCheckResult(context.Registration.FailureStatus, "Database is unreachable.", ex);
        }
    }
}
