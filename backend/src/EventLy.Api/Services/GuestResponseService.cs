using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Dtos.Public;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Services;

/// <summary>
/// The organizer's view of what guests sent back: the RSVP monitor, wish moderation (Q-42), and the
/// digital gift accounts with their confirmations (Q-41).
/// </summary>
public sealed class GuestResponseService(AppDbContext db, ICurrentUser currentUser, AuditService audit)
{
    public const int MaxGiftAccounts = 5;

    public async Task<IReadOnlyList<RsvpListItemDto>> ListRsvpsAsync(Guid eventId, RsvpStatus? status, CancellationToken ct)
    {
        await RequireEventAsync(eventId, ct);
        var rows = Rows(eventId);
        if (status is { } wanted)
        {
            rows = rows.Where(r => r.Status == wanted);
        }
        return await rows.OrderBy(r => r.GuestName).Take(2_000)
            .Select(r => new RsvpListItemDto(r.InvitationId, r.GuestId, r.GuestName, r.GuestType, r.NumberOfPeople,
                r.Status, r.RespondedAt, r.OpenedAt, r.InvitationStatus))
            .ToListAsync(ct);
    }

    /// <summary>Counts over active invitations; a revoked invitation no longer counts.</summary>
    public async Task<RsvpSummaryDto> GetSummaryAsync(Guid eventId, CancellationToken ct)
    {
        await RequireEventAsync(eventId, ct);
        var rows = await Rows(eventId).Where(r => r.InvitationStatus == InvitationStatus.Active)
            .Select(r => new { r.Status, r.NumberOfPeople, r.OpenedAt })
            .ToListAsync(ct);
        return new RsvpSummaryDto(
            rows.Count,
            rows.Count(r => r.OpenedAt != null),
            rows.Count(r => r.Status == RsvpStatus.Pending),
            rows.Count(r => r.Status == RsvpStatus.Attending),
            rows.Count(r => r.Status == RsvpStatus.NotAttending),
            rows.Where(r => r.Status == RsvpStatus.Attending).Sum(r => r.NumberOfPeople));
    }

    /// <summary>Every wish, hidden ones included, newest first.</summary>
    public async Task<IReadOnlyList<OrganizerWishDto>> ListWishesAsync(Guid eventId, CancellationToken ct)
    {
        await RequireEventAsync(eventId, ct);
        return await (
                from w in db.Wishes.AsNoTracking()
                join i in db.Invitations.AsNoTracking() on w.InvitationId equals i.Id
                join g in db.Guests.IgnoreQueryFilters([AppDbContext.SoftDeleteFilter]).AsNoTracking() on i.GuestId equals g.Id
                where w.EventId == eventId
                orderby w.CreatedAt descending
                select new OrganizerWishDto(w.Id, w.InvitationId, g.Name, w.Message, w.IsHidden, w.CreatedAt, w.UpdatedAt))
            .Take(2_000)
            .ToListAsync(ct);
    }

    public async Task SetWishHiddenAsync(Guid eventId, Guid wishId, bool hidden, CancellationToken ct)
    {
        var wish = await FindWishAsync(eventId, wishId, ct);
        if (wish.IsHidden == hidden)
        {
            return;
        }

        wish.IsHidden = hidden;
        audit.Add(hidden ? AuditActions.WishHidden : AuditActions.WishShown, currentUser.UserId, wish.OrganizationId,
            nameof(Wish), wish.Id);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteWishAsync(Guid eventId, Guid wishId, CancellationToken ct)
    {
        var wish = await FindWishAsync(eventId, wishId, ct);
        db.Wishes.Remove(wish);
        audit.Add(AuditActions.WishDeleted, currentUser.UserId, wish.OrganizationId, nameof(Wish), wish.Id);
        await db.SaveChangesAsync(ct);
    }

    public async Task<EventGiftsDto> GetGiftsAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await RequireEventAsync(eventId, ct);
        var accounts = await db.GiftAccounts.AsNoTracking()
            .Where(a => a.EventId == eventId)
            .OrderBy(a => a.SortOrder)
            .Select(a => new GiftAccountDto(a.Kind, a.Provider, a.AccountNumber, a.AccountHolder))
            .ToListAsync(ct);
        return new EventGiftsDto(accounts, ev.GiftAddress);
    }

    /// <summary>Replaces the accounts (in the given order) and the gift address.</summary>
    public async Task<EventGiftsDto> UpdateGiftsAsync(Guid eventId, UpdateEventGiftsRequest request, CancellationToken ct)
    {
        var ev = await db.Events.SingleOrDefaultAsync(e => e.Id == eventId, ct) ?? throw EventNotFound();
        if (!EventLifecycle.IsEditable(ev.Status))
        {
            throw new ConflictException("event.not_editable", "A completed or cancelled event can't be changed.");
        }

        // Remove and add in the same SaveChanges, so a failure leaves the old accounts in place.
        db.GiftAccounts.RemoveRange(await db.GiftAccounts.Where(a => a.EventId == eventId).ToListAsync(ct));
        db.GiftAccounts.AddRange(request.Accounts.Select((a, i) => new GiftAccount
        {
            EventId = eventId,
            Kind = a.Kind,
            Provider = a.Provider.Trim(),
            AccountNumber = a.AccountNumber.Trim(),
            AccountHolder = a.AccountHolder.Trim(),
            SortOrder = i,
        }));
        ev.GiftAddress = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        audit.Add(AuditActions.GiftsUpdated, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id,
            new { accounts = request.Accounts.Count });
        await db.SaveChangesAsync(ct);
        return await GetGiftsAsync(eventId, ct);
    }

    public async Task<IReadOnlyList<GiftConfirmationDto>> ListGiftConfirmationsAsync(Guid eventId, CancellationToken ct)
    {
        await RequireEventAsync(eventId, ct);
        return await (
                from c in db.GiftConfirmations.AsNoTracking()
                join i in db.Invitations.AsNoTracking() on c.InvitationId equals i.Id
                join g in db.Guests.IgnoreQueryFilters([AppDbContext.SoftDeleteFilter]).AsNoTracking() on i.GuestId equals g.Id
                where c.EventId == eventId
                orderby c.CreatedAt descending
                select new GiftConfirmationDto(c.Id, c.InvitationId, g.Name, c.SenderName, c.Amount, c.Note, c.CreatedAt))
            .Take(2_000)
            .ToListAsync(ct);
    }

    /// <summary>
    /// One row per invitation of a guest still on the list; no RSVP row means pending. A class with init
    /// properties (not the DTO record) so EF can still filter on it in SQL.
    /// </summary>
    private IQueryable<RsvpRow> Rows(Guid eventId) =>
        from i in db.Invitations.AsNoTracking()
        join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
        join r in db.Rsvps.AsNoTracking() on i.Id equals r.InvitationId into rsvps
        from r in rsvps.DefaultIfEmpty()
        where i.EventId == eventId
        select new RsvpRow
        {
            InvitationId = i.Id,
            GuestId = g.Id,
            GuestName = g.Name,
            GuestType = g.Type,
            NumberOfPeople = g.NumberOfPeople,
            Status = r == null ? RsvpStatus.Pending : r.Status,
            RespondedAt = r == null ? null : r.RespondedAt,
            OpenedAt = i.OpenedAt,
            InvitationStatus = i.Status,
        };

    private sealed class RsvpRow
    {
        public Guid InvitationId { get; init; }

        public Guid GuestId { get; init; }

        public string GuestName { get; init; } = "";

        public GuestType GuestType { get; init; }

        public int NumberOfPeople { get; init; }

        public RsvpStatus Status { get; init; }

        public DateTimeOffset? RespondedAt { get; init; }

        public DateTimeOffset? OpenedAt { get; init; }

        public InvitationStatus InvitationStatus { get; init; }
    }

    private async Task<Wish> FindWishAsync(Guid eventId, Guid wishId, CancellationToken ct)
    {
        await RequireEventAsync(eventId, ct);
        return await db.Wishes.SingleOrDefaultAsync(w => w.Id == wishId && w.EventId == eventId, ct)
            ?? throw new NotFoundException("wish.not_found", "Wish not found.");
    }

    private async Task<Event> RequireEventAsync(Guid eventId, CancellationToken ct) =>
        await db.Events.AsNoTracking().SingleOrDefaultAsync(e => e.Id == eventId, ct) ?? throw EventNotFound();

    private static NotFoundException EventNotFound() => new("event.not_found", "Event not found.");
}
