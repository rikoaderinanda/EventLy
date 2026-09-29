using Testcontainers.PostgreSql;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>
/// Starts a throwaway PostgreSQL container. When Docker isn't available (for example a
/// laptop without Docker Desktop), <see cref="SkipReason"/> is set and database tests skip
/// instead of failing. In CI (<c>CI</c> env var set, as on GitHub Actions) a missing Docker is a failure.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private static readonly bool RunningInCi = Environment.GetEnvironmentVariable("CI") is not null;

    private PostgreSqlContainer? _container;

    public string ConnectionString =>
        _container?.GetConnectionString() ?? throw new InvalidOperationException("PostgreSQL container is not running.");

    public string? SkipReason { get; private set; }

    public async ValueTask InitializeAsync()
    {
        try
        {
            // Build() already validates that Docker is reachable.
            _container = new PostgreSqlBuilder("postgres:17-alpine").Build();
            await _container.StartAsync();
        }
        catch (Exception ex) when (!RunningInCi)
        {
            SkipReason = $"Docker is not available, so database tests are skipped ({ex.GetType().Name}).";
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    public void SkipIfUnavailable()
    {
        if (SkipReason is not null)
        {
            Assert.Skip(SkipReason);
        }
    }
}
