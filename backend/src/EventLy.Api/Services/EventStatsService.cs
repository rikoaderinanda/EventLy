using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Services;

/// <summary>
/// Read-only numbers for the organizer dashboard and the statistics page (Q-60). Owner/Admin only;
/// the tenant filter keeps every query inside the caller's organization.
/// </summary>
public sealed class EventStatsService(AppDbContext db)
{
    public async Task<EventStatsDto> GetAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await db.Events.AsNoTracking().SingleOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new NotFoundException("event.not_found", "Event not found.");

        var invitations = await (
                from i in db.Invitations.AsNoTracking()
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where i.EventId == ev.Id && i.Status == InvitationStatus.Active
                select new
                {
                    g.NumberOfPeople,
                    Opened = i.OpenedAt != null,
                    Rsvp = db.Rsvps.Where(r => r.InvitationId == i.Id).Select(r => (RsvpStatus?)r.Status).FirstOrDefault(),
                    CheckedInAt = db.CheckIns.Where(c => c.InvitationId == i.Id).Select(c => (DateTimeOffset?)c.CheckedInAt)
                        .FirstOrDefault(),
                })
            .ToListAsync(ct);

        var attending = invitations.Where(i => i.Rsvp == RsvpStatus.Attending).ToList();
        var checkedIn = invitations.Where(i => i.CheckedInAt != null).ToList();
        var byHour = checkedIn
            .GroupBy(i => TruncateToHour(i.CheckedInAt!.Value))
            .OrderBy(g => g.Key)
            .Select(g => new HourCountDto(g.Key, g.Sum(i => i.NumberOfPeople)))
            .ToList();

        var gifts = await db.GiftConfirmations.AsNoTracking().Where(g => g.EventId == ev.Id)
            .GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Amount = g.Sum(x => x.Amount ?? 0) })
            .SingleOrDefaultAsync(ct);
        var features = ev.PackageSnapshot?.Features;

        return new EventStatsDto(
            ev.Id,
            new GuestStatsDto(invitations.Count, invitations.Sum(i => i.NumberOfPeople), features?.MaxGuests,
                invitations.Count(i => i.Opened)),
            new RsvpStatsDto(
                attending.Count,
                invitations.Count(i => i.Rsvp == RsvpStatus.NotAttending),
                invitations.Count(i => i.Rsvp is null or RsvpStatus.Pending),
                attending.Sum(i => i.NumberOfPeople)),
            new CheckInStatsDto(checkedIn.Count, checkedIn.Sum(i => i.NumberOfPeople), byHour),
            await db.Wishes.CountAsync(w => w.EventId == ev.Id && !w.IsHidden, ct),
            new GiftStatsDto(gifts?.Count ?? 0, gifts?.Amount ?? 0),
            new PhotoStatsDto(await db.Photos.CountAsync(p => p.EventId == ev.Id, ct), features?.MaxPhotos),
            await db.EventStaffAssignments.CountAsync(a => a.EventId == ev.Id, ct));
    }

    /// <summary>
    /// Per-event counts for the event list (cards and the dashboard hero): invitations, people, RSVP answered
    /// and people checked in. Three grouped queries for the whole list.
    /// </summary>
    public async Task<Dictionary<Guid, EventCountsDto>> CountsAsync(IReadOnlyCollection<Guid> eventIds, CancellationToken ct)
    {
        if (eventIds.Count == 0)
        {
            return [];
        }

        var guests = await (
                from i in db.Invitations.AsNoTracking()
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where eventIds.Contains(i.EventId) && i.Status == InvitationStatus.Active
                group g by i.EventId into e
                select new { EventId = e.Key, Invitations = e.Count(), People = e.Sum(g => g.NumberOfPeople) })
            .ToListAsync(ct);
        var answered = await (
                from r in db.Rsvps.AsNoTracking()
                join i in db.Invitations.AsNoTracking() on r.InvitationId equals i.Id
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where eventIds.Contains(i.EventId) && i.Status == InvitationStatus.Active && r.Status != RsvpStatus.Pending
                group r by i.EventId into e
                select new { EventId = e.Key, Count = e.Count() })
            .ToDictionaryAsync(x => x.EventId, x => x.Count, ct);
        var checkedIn = await (
                from c in db.CheckIns.AsNoTracking()
                join i in db.Invitations.AsNoTracking() on c.InvitationId equals i.Id
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where eventIds.Contains(c.EventId)
                group g by c.EventId into e
                select new { EventId = e.Key, People = e.Sum(g => g.NumberOfPeople) })
            .ToDictionaryAsync(x => x.EventId, x => x.People, ct);

        return guests.ToDictionary(
            g => g.EventId,
            g => new EventCountsDto(g.Invitations, g.People, answered.GetValueOrDefault(g.EventId),
                checkedIn.GetValueOrDefault(g.EventId)));
    }

    private static DateTimeOffset TruncateToHour(DateTimeOffset at)
    {
        var utc = at.ToUniversalTime();
        return new DateTimeOffset(utc.Year, utc.Month, utc.Day, utc.Hour, 0, 0, TimeSpan.Zero);
    }
}
