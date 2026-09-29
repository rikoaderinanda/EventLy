using System.Reflection;
using EventLy.Api.Auth;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Data;

/// <summary>
/// The single EF Core context. Services use it directly (no repository layer).
/// Every <see cref="ITenantOwned"/> entity gets a global filter on the caller's organization,
/// taken from the validated access token (<see cref="ICurrentUser"/>).
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser? currentUser = null)
    : DbContext(options)
{
    private static readonly MethodInfo ApplyTenantFilterMethod =
        typeof(AppDbContext).GetMethod(nameof(ApplyTenantFilter), BindingFlags.NonPublic | BindingFlags.Instance)!;

    public DbSet<Organization> Organizations => Set<Organization>();

    public DbSet<User> Users => Set<User>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    /// <summary>
    /// The organization tenant-owned queries are limited to. <see cref="Guid.Empty"/> when there is none
    /// (anonymous, Root, Owner before onboarding), which matches no rows.
    /// </summary>
    public Guid CurrentOrganizationId => currentUser?.OrganizationId ?? Guid.Empty;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Case-insensitive text for email columns (users.email, guests.email).
        modelBuilder.HasPostgresExtension("citext");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes()
                     .Where(t => typeof(ITenantOwned).IsAssignableFrom(t.ClrType)))
        {
            ApplyTenantFilterMethod.MakeGenericMethod(entityType.ClrType).Invoke(this, [modelBuilder]);
        }
    }

    // EF evaluates CurrentOrganizationId per query (it is a member of this context instance).
    private void ApplyTenantFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : class, ITenantOwned =>
        modelBuilder.Entity<TEntity>().HasQueryFilter(e => e.OrganizationId == CurrentOrganizationId);
}
