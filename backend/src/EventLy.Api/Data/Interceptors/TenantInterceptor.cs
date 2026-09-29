using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EventLy.Api.Data.Interceptors;

/// <summary>
/// Second line of tenant defence, next to the query filter: new tenant-owned rows get the caller's
/// organization, and a change to a row of another organization (or moving a row between
/// organizations) is refused before it reaches the database.
/// </summary>
public sealed class TenantInterceptor : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Enforce(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Enforce(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    private static void Enforce(DbContext? context)
    {
        if (context is not AppDbContext db)
        {
            return;
        }

        foreach (var entry in db.ChangeTracker.Entries<ITenantOwned>())
        {
            switch (entry.State)
            {
                case EntityState.Added when entry.Entity.OrganizationId == Guid.Empty:
                    entry.Entity.OrganizationId = db.CurrentOrganizationId != Guid.Empty
                        ? db.CurrentOrganizationId
                        : throw new InvalidOperationException(
                            $"Cannot add {entry.Metadata.ClrType.Name} without an organization.");
                    break;

                case EntityState.Added when entry.Entity.OrganizationId != db.CurrentOrganizationId:
                case EntityState.Modified or EntityState.Deleted
                    when entry.Property(e => e.OrganizationId).OriginalValue != db.CurrentOrganizationId
                         || entry.Entity.OrganizationId != db.CurrentOrganizationId:
                    throw new InvalidOperationException(
                        $"Refused to write {entry.Metadata.ClrType.Name} of another organization.");
            }
        }
    }
}
