using System.Net;
using EventLy.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Shouldly;

namespace EventLy.IntegrationTests;

/// <summary>Runs against a real PostgreSQL container (skipped when Docker is unavailable).</summary>
public sealed class DatabaseTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Migrations_are_applied_and_readiness_reports_healthy()
    {
        postgres.SkipIfUnavailable();
        var ct = TestContext.Current.CancellationToken;

        await using (var db = postgres.CreateDbContext())
        {
            (await db.Database.GetPendingMigrationsAsync(ct)).ShouldBeEmpty();
            var citextInstalled = await db.Database
                .SqlQuery<bool>($"SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') AS \"Value\"")
                .SingleAsync(ct);
            citextInstalled.ShouldBeTrue();
        }

        await using var factory = new ApiFactory(postgres.ConnectionString);
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/health/ready", ct);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
