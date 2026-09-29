using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Platform;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Services;

/// <summary>
/// Root's view of Owner accounts (decision Q-24): list and suspend/reactivate.
/// Purchases per Owner are added with payments in Phase 5. Root never sees data inside an organization.
/// </summary>
public sealed class PlatformOwnerService(AppDbContext db, ICurrentUser currentUser, AuditService audit)
{
    public async Task<IReadOnlyList<PlatformOwnerDto>> ListAsync(string? search, CancellationToken ct)
    {
        var owners = db.Users.AsNoTracking().Where(u => u.Role == UserRole.Owner);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            owners = owners.Where(u => EF.Functions.ILike(u.Name, term) || EF.Functions.ILike(u.Email, term));
        }

        return await (
                from owner in owners
                join org in db.Organizations.AsNoTracking() on owner.OrganizationId equals org.Id into orgs
                from org in orgs.DefaultIfEmpty()
                orderby owner.CreatedAt descending
                select new PlatformOwnerDto(
                    owner.Id, owner.Name, owner.Email, owner.Status,
                    org == null ? null : new OwnerOrganizationDto(org.Id, org.Name, org.Status),
                    owner.CreatedAt, owner.LastSignInAt))
            .Take(200)
            .ToListAsync(ct);
    }

    /// <summary>Blocks the Owner and, when they have one, the whole organization (Admin and Staff included).</summary>
    public Task SuspendAsync(Guid ownerId, CancellationToken ct) => SetSuspendedAsync(ownerId, suspended: true, ct);

    public Task ReactivateAsync(Guid ownerId, CancellationToken ct) => SetSuspendedAsync(ownerId, suspended: false, ct);

    private async Task SetSuspendedAsync(Guid ownerId, bool suspended, CancellationToken ct)
    {
        var owner = await db.Users.SingleOrDefaultAsync(u => u.Id == ownerId && u.Role == UserRole.Owner, ct)
            ?? throw new NotFoundException("owner.not_found", "Owner not found.");

        owner.Status = suspended ? UserStatus.Disabled : UserStatus.Active;
        owner.SecurityStamp = Guid.NewGuid();

        if (owner.OrganizationId is { } organizationId)
        {
            var organization = await db.Organizations.SingleAsync(o => o.Id == organizationId, ct);
            organization.Status = suspended ? OrganizationStatus.Suspended : OrganizationStatus.Active;

            if (suspended)
            {
                // End every member's session now, not just at their next sign-in.
                var members = await db.Users.Where(u => u.OrganizationId == organizationId && u.Id != owner.Id).ToListAsync(ct);
                foreach (var member in members)
                {
                    member.SecurityStamp = Guid.NewGuid();
                }
            }
        }

        audit.Add(suspended ? AuditActions.OrganizationSuspended : AuditActions.OrganizationReactivated,
            currentUser.UserId, owner.OrganizationId, nameof(User), owner.Id);
        await db.SaveChangesAsync(ct);
    }
}
