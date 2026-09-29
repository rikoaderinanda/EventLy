using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Data;

/// <summary>
/// The single EF Core context. Services use it directly (no repository layer).
/// Entities, configurations and the tenant filter are added from Phase 2 onward.
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Case-insensitive text for email columns (users.email, guests.email).
        modelBuilder.HasPostgresExtension("citext");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
