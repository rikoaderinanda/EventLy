using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Services;

/// <summary>
/// Guests of an event. Creating a guest creates their invitation in the same save (1:1). The number of
/// people is limited by the package: the paid snapshot's <c>maxGuests</c>, or before payment the largest
/// offered package (the checkout then checks the chosen package). A group counts all its people.
/// </summary>
public sealed class GuestService(
    AppDbContext db, ICurrentUser currentUser, AuditService audit, InvitationLinks links, TimeProvider timeProvider)
{
    public async Task<GuestListDto> ListAsync(Guid eventId, GuestListQuery filter, CancellationToken ct)
    {
        var ev = await db.Events.AsNoTracking().SingleOrDefaultAsync(e => e.Id == eventId, ct) ?? throw EventNotFound();
        var all = db.Guests.AsNoTracking().Where(g => g.EventId == eventId);
        var total = await all.CountAsync(ct);
        var people = await all.SumAsync(g => g.NumberOfPeople, ct);

        var query = all;
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = $"%{filter.Search.Trim()}%";
            query = query.Where(g => EF.Functions.ILike(g.Name, term)
                || (g.Phone != null && EF.Functions.ILike(g.Phone, term))
                || (g.Email != null && EF.Functions.ILike(g.Email, term)));
        }
        if (filter.Type is { } type)
        {
            query = query.Where(g => g.Type == type);
        }
        if (filter.Status is { } status)
        {
            query = query.Where(g => g.Invitation!.Status == status);
        }

        var guests = await query
            .Include(g => g.Sessions).Include(g => g.Invitation).AsSplitQuery()
            .OrderBy(g => g.Name).ThenBy(g => g.CreatedAt)
            .Take(2_000)
            .ToListAsync(ct);
        return new GuestListDto([.. guests.Select(ToDto)], total, people, ev.PackageSnapshot?.Features.MaxGuests);
    }

    public async Task<GuestDto> GetAsync(Guid eventId, Guid guestId, CancellationToken ct) =>
        ToDto(await LoadGuestAsync(eventId, guestId, db.Guests.AsNoTracking(), ct));

    public Task<GuestDto> CreateAsync(Guid eventId, CreateGuestRequest request, CancellationToken ct) =>
        InLockedEventAsync(eventId, async ev =>
        {
            await RequirePlacesAsync(ev, request.NumberOfPeople, ct);

            var guest = new Guest
            {
                EventId = ev.Id,
                Name = request.Name.Trim(),
                Phone = Normalize(request.Phone),
                Email = Normalize(request.Email),
                Type = request.GuestType,
                NumberOfPeople = request.NumberOfPeople,
            };
            guest.Invitation = new Invitation { EventId = ev.Id, GuestId = guest.Id, Type = guest.Type };
            SetSessions(guest, ev, request.SessionIds ?? [.. ev.Sessions.Select(s => s.Id)]);
            db.Guests.Add(guest);
            audit.Add(AuditActions.GuestCreated, currentUser.UserId, ev.OrganizationId, nameof(Guest), guest.Id,
                new { invitationId = guest.Invitation.Id });
            return guest;
        }, ct);

    public Task<GuestDto> UpdateAsync(Guid eventId, Guid guestId, UpdateGuestRequest request, CancellationToken ct) =>
        InLockedEventAsync(eventId, async ev =>
        {
            var guest = await LoadGuestAsync(eventId, guestId, db.Guests, ct);
            if (request.NumberOfPeople > guest.NumberOfPeople)
            {
                await RequirePlacesAsync(ev, request.NumberOfPeople - guest.NumberOfPeople, ct);
            }

            guest.Name = request.Name.Trim();
            guest.Phone = Normalize(request.Phone);
            guest.Email = Normalize(request.Email);
            guest.Type = request.GuestType;
            guest.NumberOfPeople = request.NumberOfPeople;
            guest.Invitation!.Type = request.GuestType;
            if (request.SessionIds is not null)
            {
                SetSessions(guest, ev, request.SessionIds);
            }

            audit.Add(AuditActions.GuestUpdated, currentUser.UserId, ev.OrganizationId, nameof(Guest), guest.Id);
            return guest;
        }, ct);

    /// <summary>Soft delete; the invitation is revoked so the link and QR stop working.</summary>
    public async Task DeleteAsync(Guid eventId, Guid guestId, CancellationToken ct)
    {
        var ev = await LoadEditableEventAsync(eventId, ct);
        var guest = await LoadGuestAsync(eventId, guestId, db.Guests, ct);
        // Phase 8: a checked-in guest can't be deleted (409).

        guest.DeletedAt = timeProvider.GetUtcNow();
        guest.Invitation!.Status = InvitationStatus.Revoked;
        audit.Add(AuditActions.GuestDeleted, currentUser.UserId, ev.OrganizationId, nameof(Guest), guest.Id);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Runs a guest change in a transaction that holds a row lock on the event, so two requests can't both
    /// take the last places. A row lock leaves the event's xmin (its version) unchanged, so editing the
    /// event meanwhile isn't affected. The retrying execution strategy starts the whole unit over.
    /// </summary>
    private Task<GuestDto> InLockedEventAsync(Guid eventId, Func<Event, Task<Guest>> change, CancellationToken ct)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var ev = await LoadEditableEventAsync(eventId, ct);
            await db.Database.ExecuteSqlAsync($"SELECT 1 FROM events WHERE id = {ev.Id} FOR UPDATE", ct);

            var guest = await change(ev);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return ToDto(guest);
        });
    }

    /// <summary>
    /// <c>maxGuests</c> counts people (decided 2026-10-01): a group of 4 takes 4 places. 422 when
    /// <paramref name="extraPeople"/> more don't fit.
    /// </summary>
    private async Task RequirePlacesAsync(Event ev, int extraPeople, CancellationToken ct)
    {
        var limit = await GuestLimitAsync(ev, ct);
        var taken = await db.Guests.Where(g => g.EventId == ev.Id).SumAsync(g => g.NumberOfPeople, ct);
        if (taken + extraPeople > limit)
        {
            throw new QuotaExceededException("guest.quota_exceeded",
                $"This event can have at most {limit} guests (people); {Math.Max(limit - taken, 0)} places are left.",
                ev.PackageSnapshot is null
                    ? "No package offers more guests."
                    : $"The {ev.PackageSnapshot.Name} package allows {limit} guests.");
        }
    }

    /// <summary>The paid package's limit; before payment the largest offered package, so no checkout can fit more.</summary>
    private async Task<int> GuestLimitAsync(Event ev, CancellationToken ct)
    {
        if (ev.PackageSnapshot is { } paid)
        {
            return paid.Features.MaxGuests;
        }

        var offered = await db.Packages.AsNoTracking().Where(p => p.IsActive).ToListAsync(ct);
        return offered.Count == 0 ? 0 : offered.Max(p => p.Features.MaxGuests);
    }

    private static void SetSessions(Guest guest, Event ev, IReadOnlyCollection<Guid> sessionIds)
    {
        var wanted = sessionIds.ToHashSet();
        if (wanted.Count == 0)
        {
            throw new AppException(StatusCodes.Status400BadRequest, "guest.no_session",
                "Invite the guest to at least one session.");
        }
        if (wanted.Any(id => ev.Sessions.All(s => s.Id != id)))
        {
            throw new AppException(StatusCodes.Status400BadRequest, "guest.unknown_session",
                "A session doesn't belong to this event.");
        }

        guest.Sessions.RemoveAll(s => !wanted.Contains(s.SessionId));
        foreach (var id in wanted.Where(id => guest.Sessions.All(s => s.SessionId != id)))
        {
            guest.Sessions.Add(new GuestSession { GuestId = guest.Id, SessionId = id });
        }
    }

    private async Task<Event> LoadEditableEventAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await db.Events.Include(e => e.Sessions).SingleOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw EventNotFound();
        if (!EventLifecycle.IsEditable(ev.Status))
        {
            throw new ConflictException("event.not_editable", "A completed or cancelled event can't be changed.");
        }
        return ev;
    }

    private static async Task<Guest> LoadGuestAsync(Guid eventId, Guid guestId, IQueryable<Guest> source, CancellationToken ct) =>
        await source.Include(g => g.Sessions).Include(g => g.Invitation).AsSplitQuery()
            .SingleOrDefaultAsync(g => g.Id == guestId && g.EventId == eventId, ct)
        ?? throw new NotFoundException("guest.not_found", "Guest not found.");

    private GuestDto ToDto(Guest g)
    {
        var invitation = g.Invitation!;
        return new GuestDto(
            g.Id, g.EventId, g.Name, g.Phone, g.Email, g.Type, g.NumberOfPeople,
            [.. g.Sessions.Select(s => s.SessionId)],
            new InvitationSummaryDto(invitation.Id, invitation.Code, links.Url(invitation.Code), invitation.Status,
                invitation.OpenedAt),
            g.CreatedAt);
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static NotFoundException EventNotFound() => new("event.not_found", "Event not found.");
}
