using EventLy.Api.Data;
using EventLy.Api.Data.Interceptors;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Shouldly;
using Testcontainers.PostgreSql;

namespace EventLy.IntegrationTests;

/// <summary>
/// The UniqueGuestNameAndPhone migration runs on databases that already hold duplicate names and numbers
/// (local data from before Q-55). It must tidy them up instead of failing to create the unique indexes.
/// </summary>
public sealed class GuestUniquenessMigrationTests : IAsyncLifetime
{
    private const string Before = "20261001032635_AddCheckIns";
    private PostgreSqlContainer? _container;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        try
        {
            _container = new PostgreSqlBuilder("postgres:17-alpine").Build();
            await _container.StartAsync(Ct);
        }
        catch (Exception) when (Environment.GetEnvironmentVariable("CI") is null)
        {
            _container = null;
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    private AppDbContext Context()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        PersistenceSetup.Configure(options, _container!.GetConnectionString());
        options.AddInterceptors(new TimestampsInterceptor(TimeProvider.System), new TenantInterceptor());
        return new AppDbContext(options.Options);
    }

    [Fact]
    public async Task Existing_duplicates_are_renamed_and_the_indexes_are_created()
    {
        if (_container is null)
        {
            Assert.Skip("Docker is not available.");
        }

        await using var db = Context();
        await db.GetService<IMigrator>().MigrateAsync(Before, Ct);
        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO users (id, name, email, role, status, security_stamp, created_at, updated_at)
            VALUES ('00000000-0000-0000-0000-000000000001', 'Owner', 'owner@x.test', 'Owner', 'Active', gen_random_uuid(), now(), now());
            INSERT INTO organizations (id, name, owner_user_id, status, created_at, updated_at)
            VALUES ('00000000-0000-0000-0000-0000000000a1', 'WO', '00000000-0000-0000-0000-000000000001', 'Active', now(), now());
            INSERT INTO events (id, organization_id, name, category, time_zone, date, venue, status, created_at, updated_at)
            VALUES ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'Resepsi', 'Wedding',
                    'Asia/Jakarta', now(), 'Gedung', 'Draft', now(), now());
            INSERT INTO guests (id, organization_id, event_id, name, phone, guest_type, number_of_people, created_at, updated_at)
            VALUES
              ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1',
               'Budi Santoso', '0812-3456-7890', 'Individual', 1, now() - interval '3 min', now()),
              ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1',
               'budi  santoso', '+62 812 3456 7890', 'Individual', 1, now() - interval '2 min', now()),
              ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1',
               'Sari', '12', 'Individual', 1, now() - interval '1 min', now());
            """, Ct);

        await db.Database.MigrateAsync(Ct);

        var guests = await db.Database.SqlQueryRaw<GuestRow>(
                "SELECT name::text AS name, phone_key FROM guests ORDER BY created_at")
            .ToListAsync(Ct);
        guests.ShouldBe(
        [
            new GuestRow("Budi Santoso", "6281234567890"),
            new GuestRow("budi santoso (2)", null), // second of the same number keeps its phone, not the key
            new GuestRow("Sari", null),              // too short to be a WhatsApp number
        ]);
    }

    private sealed record GuestRow(string Name, string? PhoneKey);
}
