using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EventLy.Api.Data;

public static class PersistenceSetup
{
    public const string ConnectionStringName = "Database";

    private static readonly string[] GssEncryptionModeKeys = ["GSS Encryption Mode", "GssEncryptionMode", "GssEncMode"];

    public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = GetConnectionString(configuration);
        services.AddDbContext<AppDbContext>(options => Configure(options, connectionString));
        return services;
    }

    /// <summary>
    /// Reads and normalises the PostgreSQL connection string. GSS (Kerberos) encryption is turned
    /// off unless the connection string sets it: EventLy uses password + TLS (Neon, local PostgreSQL),
    /// and the default "Prefer" makes Npgsql look for libgssapi, which the container image doesn't have.
    /// </summary>
    public static string GetConnectionString(IConfiguration configuration)
    {
        var raw = configuration.GetConnectionString(ConnectionStringName);
        if (string.IsNullOrWhiteSpace(raw))
        {
            throw new InvalidOperationException(
                $"Connection string 'ConnectionStrings:{ConnectionStringName}' is not configured.");
        }

        var builder = new NpgsqlConnectionStringBuilder(raw);
        // NpgsqlConnectionStringBuilder.ContainsKey is true for every known keyword,
        // so look at the keys actually written in the raw string instead.
        var written = new DbConnectionStringBuilder { ConnectionString = raw };
        if (!GssEncryptionModeKeys.Any(written.ContainsKey))
        {
            builder.GssEncryptionMode = GssEncryptionMode.Disable;
        }

        return builder.ConnectionString;
    }

    /// <summary>Shared by the runtime registration and the design-time factory.</summary>
    public static void Configure(DbContextOptionsBuilder options, string connectionString)
    {
        options
            .UseNpgsql(connectionString, npgsql =>
            {
                npgsql.MigrationsHistoryTable("__ef_migrations_history");
                npgsql.EnableRetryOnFailure();
            })
            .UseSnakeCaseNamingConvention();
    }

    public static async Task MigrateDatabaseAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();

        var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
        logger.LogInformation("Applying {Count} pending migration(s): {Migrations}", pending.Count, pending);
        await db.Database.MigrateAsync();
        logger.LogInformation("Database is up to date");
    }
}
