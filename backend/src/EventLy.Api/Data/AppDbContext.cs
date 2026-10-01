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
    /// <summary>Names of the global query filters, so one can be switched off without the other.</summary>
    public const string TenantFilter = "tenant";
    public const string SoftDeleteFilter = "soft_delete";

    private static readonly MethodInfo ApplyTenantFilterMethod =
        typeof(AppDbContext).GetMethod(nameof(ApplyTenantFilter), BindingFlags.NonPublic | BindingFlags.Instance)!;

    private static readonly MethodInfo ApplySoftDeleteFilterMethod =
        typeof(AppDbContext).GetMethod(nameof(ApplySoftDeleteFilter), BindingFlags.NonPublic | BindingFlags.Static)!;

    public DbSet<Organization> Organizations => Set<Organization>();

    public DbSet<User> Users => Set<User>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    public DbSet<Event> Events => Set<Event>();

    public DbSet<EventSession> EventSessions => Set<EventSession>();

    public DbSet<EventStaffAssignment> EventStaffAssignments => Set<EventStaffAssignment>();

    public DbSet<Guest> Guests => Set<Guest>();

    public DbSet<GuestSession> GuestSessions => Set<GuestSession>();

    public DbSet<Invitation> Invitations => Set<Invitation>();

    public DbSet<Package> Packages => Set<Package>();

    public DbSet<Payment> Payments => Set<Payment>();

    private Guid? _actingOrganizationId;

    /// <summary>
    /// The organization tenant-owned queries are limited to. <see cref="Guid.Empty"/> when there is none
    /// (anonymous, Root, Owner before onboarding), which matches no rows.
    /// </summary>
    public Guid CurrentOrganizationId => _actingOrganizationId ?? currentUser?.OrganizationId ?? Guid.Empty;

    /// <summary>
    /// Work done for an organization without one of its members signed in: the payment webhook,
    /// payment reconciliation and Root's manual activation. From here on, the tenant filter and the
    /// tenant interceptor use <paramref name="organizationId"/>, so the work still can't touch another
    /// organization's rows. Call it only after looking up the row that names the organization.
    /// </summary>
    public void ActAsOrganization(Guid organizationId) => _actingOrganizationId = organizationId;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Case-insensitive text for email columns (users.email, guests.email).
        modelBuilder.HasPostgresExtension("citext");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        foreach (var clrType in modelBuilder.Model.GetEntityTypes().Select(t => t.ClrType).ToList())
        {
            if (typeof(ITenantOwned).IsAssignableFrom(clrType))
            {
                ApplyTenantFilterMethod.MakeGenericMethod(clrType).Invoke(this, [modelBuilder]);
            }
            if (typeof(ISoftDeletable).IsAssignableFrom(clrType))
            {
                ApplySoftDeleteFilterMethod.MakeGenericMethod(clrType).Invoke(null, [modelBuilder]);
            }
        }
    }

    // EF evaluates CurrentOrganizationId per query (it is a member of this context instance).
    private void ApplyTenantFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : class, ITenantOwned =>
        modelBuilder.Entity<TEntity>().HasQueryFilter(TenantFilter, e => e.OrganizationId == CurrentOrganizationId);

    private static void ApplySoftDeleteFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : class, ISoftDeletable =>
        modelBuilder.Entity<TEntity>().HasQueryFilter(SoftDeleteFilter, e => e.DeletedAt == null);
}
