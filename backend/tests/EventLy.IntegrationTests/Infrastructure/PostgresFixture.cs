using EventLy.Api.Auth;
using EventLy.Api.Data;
using EventLy.Api.Data.Interceptors;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>
/// Starts one throwaway PostgreSQL container per test class and applies all migrations.
/// When Docker isn't available (a laptop without Docker Desktop), <see cref="SkipReason"/> is set and
/// database tests skip instead of failing. In CI (<c>CI</c> env var set, as on GitHub Actions) a missing
/// Docker is a failure.
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
            return;
        }

        await using var db = CreateDbContext();
        await db.Database.MigrateAsync();
    }

    /// <summary>
    /// A context acting as a member of <paramref name="organizationId"/> (tenant filter and interceptor apply),
    /// or with no organization at all. Use <c>IgnoreQueryFilters()</c> to look across tenants in assertions.
    /// </summary>
    public AppDbContext CreateDbContext(Guid? organizationId = null)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        PersistenceSetup.Configure(options, ConnectionString);
        options.AddInterceptors(new TimestampsInterceptor(TimeProvider.System), new TenantInterceptor());
        return new AppDbContext(options.Options, new FakeCurrentUser(organizationId));
    }

    private sealed class FakeCurrentUser(Guid? organizationId) : ICurrentUser
    {
        public bool IsAuthenticated => organizationId is not null;

        public Guid? UserId => null;

        public Guid? OrganizationId => organizationId;

        public UserRole? Role => organizationId is null ? null : UserRole.Owner;
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
