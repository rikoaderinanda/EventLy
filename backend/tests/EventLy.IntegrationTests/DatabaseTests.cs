using System.Net;
using EventLy.Api.Data;
using EventLy.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;

namespace EventLy.IntegrationTests;

/// <summary>Runs against a real PostgreSQL container (skipped when Docker is unavailable).</summary>
public sealed class DatabaseTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Migrations_apply_and_readiness_reports_healthy()
    {
        postgres.SkipIfUnavailable();
        await using var factory = new ApiFactory(postgres.ConnectionString);
        var ct = TestContext.Current.CancellationToken;

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.MigrateAsync(ct);

            (await db.Database.GetPendingMigrationsAsync(ct)).ShouldBeEmpty();
            var citextInstalled = await db.Database
                .SqlQuery<bool>($"SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') AS \"Value\"")
                .SingleAsync(ct);
            citextInstalled.ShouldBeTrue();
        }

        using var client = factory.CreateClient();
        var response = await client.GetAsync("/health/ready", ct);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
