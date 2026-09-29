using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Data;

public static class PersistenceSetup
{
    public const string ConnectionStringName = "Database";

    public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Connection string 'ConnectionStrings:{ConnectionStringName}' is not configured.");

        services.AddDbContext<AppDbContext>(options => Configure(options, connectionString));
        return services;
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
