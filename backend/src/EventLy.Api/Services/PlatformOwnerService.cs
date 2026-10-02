using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Platform;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Services;

/// <summary>
/// Root's view of Owner accounts (decision Q-24): list with purchase counts, details with events and
/// payments, and suspend/reactivate. Root never sees guests, invitations or photos.
/// Root belongs to no organization, so reading events and payments is an allow-listed tenant filter bypass.
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

        var events = AllEvents();
        var payments = AllPayments();
        return await (
                from owner in owners
                join org in db.Organizations.AsNoTracking() on owner.OrganizationId equals org.Id into orgs
                from org in orgs.DefaultIfEmpty()
                orderby owner.CreatedAt descending
                select new PlatformOwnerDto(
                    owner.Id, owner.Name, owner.Email, owner.Status,
                    org == null ? null : new OwnerOrganizationDto(org.Id, org.Name, org.Status),
                    new OwnerPurchaseSummaryDto(
                        events.Count(e => e.OrganizationId == owner.OrganizationId),
                        payments.Count(p => p.OrganizationId == owner.OrganizationId && p.Status == PaymentStatus.Paid),
                        payments.Count(p => p.OrganizationId == owner.OrganizationId && p.Status == PaymentStatus.Pending)),
                    owner.CreatedAt, owner.LastSignInAt))
            .Take(200)
            .ToListAsync(ct);
    }

    public async Task<PlatformOwnerDetailDto> GetAsync(Guid ownerId, CancellationToken ct)
    {
        var owner = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == ownerId && u.Role == UserRole.Owner, ct)
            ?? throw new NotFoundException("owner.not_found", "Owner not found.");
        var organization = owner.OrganizationId is { } orgId
            ? await db.Organizations.AsNoTracking().SingleAsync(o => o.Id == orgId, ct)
            : null;
        if (organization is null)
        {
            return new PlatformOwnerDetailDto(ToDto(owner, null, new OwnerPurchaseSummaryDto(0, 0, 0)), [], []);
        }

        var events = await AllEvents()
            .Where(e => e.OrganizationId == organization.Id)
            .OrderByDescending(e => e.Date)
            .Select(e => new PlatformEventDto(e.Id, e.Name, e.Date, e.TimeZone, e.Status,
                e.PackageSnapshot == null ? null : e.PackageSnapshot.Name))
            .ToListAsync(ct);

        var payments = await (
                from p in AllPayments().Where(p => p.OrganizationId == organization.Id)
                join e in db.Events.IgnoreQueryFilters([AppDbContext.TenantFilter, AppDbContext.SoftDeleteFilter]).AsNoTracking()
                    on p.EventId equals e.Id
                orderby p.CreatedAt descending
                select new { Payment = p, EventName = e.Name })
            .Take(200)
            .ToListAsync(ct);

        var summary = new OwnerPurchaseSummaryDto(
            events.Count,
            payments.Count(p => p.Payment.Status == PaymentStatus.Paid),
            payments.Count(p => p.Payment.Status == PaymentStatus.Pending));
        return new PlatformOwnerDetailDto(
            ToDto(owner, organization, summary),
            events,
            [.. payments.Select(x => new PlatformPaymentDto(
                x.Payment.Id, x.Payment.EventId, x.EventName, x.Payment.PackageSnapshot.Name, x.Payment.Amount,
                x.Payment.Currency, x.Payment.Status, x.Payment.Provider, x.Payment.ProviderReference, x.Payment.PaidAt, x.Payment.Note,
                x.Payment.CreatedAt))]);
    }

    /// <summary>Blocks the Owner and, when they have one, the whole organization (Admin and Staff included).</summary>
    public Task SuspendAsync(Guid ownerId, CancellationToken ct) => SetSuspendedAsync(ownerId, suspended: true, ct);

    public Task ReactivateAsync(Guid ownerId, CancellationToken ct) => SetSuspendedAsync(ownerId, suspended: false, ct);

    // Allow-listed tenant filter bypass (Root has no organization). Soft-deleted events stay hidden.
    private IQueryable<Event> AllEvents() =>
        db.Events.IgnoreQueryFilters([AppDbContext.TenantFilter]).AsNoTracking();

    private IQueryable<Payment> AllPayments() =>
        db.Payments.IgnoreQueryFilters([AppDbContext.TenantFilter]).AsNoTracking();

    private static PlatformOwnerDto ToDto(User owner, Organization? org, OwnerPurchaseSummaryDto purchases) =>
        new(owner.Id, owner.Name, owner.Email, owner.Status,
            org is null ? null : new OwnerOrganizationDto(org.Id, org.Name, org.Status),
            purchases, owner.CreatedAt, owner.LastSignInAt);

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
