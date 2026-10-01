using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.CheckIns;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EventLy.Api.Services;

/// <summary>
/// Checking guests in at the venue (docs/architecture/01-system-architecture.md §6.3). Owner and Staff
/// check in; Staff only at events they are assigned to (others are 404). Only an Active event, only on
/// the date of the check-in session in the event's time zone (Q-35), only with a valid invitation (Q-49).
/// One invitation is checked in once: the unique index decides, and a repeat scan returns the first one.
/// </summary>
public sealed class CheckInService(AppDbContext db, ICurrentUser currentUser, AuditService audit, TimeProvider timeProvider)
{
    public const int SearchLimit = 20;

    private sealed record Found(Invitation Invitation, Guest Guest);

    /// <summary>Shows who was scanned before committing, with any warnings.</summary>
    public async Task<CheckInResultDto> LookupAsync(Guid eventId, string code, CancellationToken ct)
    {
        var ev = await OpenEventAsync(eventId, ct);
        var found = await FindAsync(ev, code, null, ct);
        return await ResultAsync(ev, found, ct);
    }

    /// <summary>
    /// Checks the guest in and sets their RSVP to Attending (Q-49). <c>Created</c> is false when the
    /// invitation was already checked in: the first check-in is returned unchanged.
    /// </summary>
    public async Task<(CheckInResultDto Result, bool Created)> CheckInAsync(Guid eventId, CheckInRequest request, CancellationToken ct)
    {
        var ev = await OpenEventAsync(eventId, ct);
        var found = await FindAsync(ev, request.Code, request.InvitationId, ct);
        if (await db.CheckIns.AnyAsync(c => c.InvitationId == found.Invitation.Id, ct))
        {
            return (await ResultAsync(ev, found, ct), false);
        }

        var now = timeProvider.GetUtcNow();
        var staffId = currentUser.RequireUserId();
        var method = request.InvitationId is not null ? CheckInMethod.Manual : CheckInMethod.Scan;
        var checkIn = new CheckIn
        {
            EventId = ev.Id,
            InvitationId = found.Invitation.Id,
            CheckedInBy = staffId,
            CheckedInAt = now,
            Method = method,
        };
        db.CheckIns.Add(checkIn);

        var rsvp = await db.Rsvps.SingleOrDefaultAsync(r => r.InvitationId == found.Invitation.Id, ct);
        var previousRsvp = rsvp?.Status ?? RsvpStatus.Pending;
        if (rsvp is null)
        {
            db.Rsvps.Add(new Rsvp { InvitationId = found.Invitation.Id, Status = RsvpStatus.Attending, RespondedAt = now });
        }
        else if (rsvp.Status != RsvpStatus.Attending)
        {
            rsvp.Status = RsvpStatus.Attending;
            rsvp.RespondedAt = now;
        }

        audit.Add(AuditActions.CheckInCreated, staffId, ev.OrganizationId, nameof(CheckIn), checkIn.Id,
            new { invitationId = found.Invitation.Id, method = method.ToString(), previousRsvp = previousRsvp.ToString() });

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Another scan of the same QR won the race: report its check-in.
            db.ChangeTracker.Clear();
            return (await ResultAsync(ev, found, ct), false);
        }

        // A fresh check-in: "already" is for repeat scans. Warn about the answer the guest gave before
        // this check-in changed it to attending.
        var result = await ResultAsync(ev, found, ct) with { AlreadyCheckedIn = false };
        return (previousRsvp == RsvpStatus.NotAttending
            ? result with { Warnings = [.. result.Warnings, CheckInWarnings.RsvpNotAttending] }
            : result, true);
    }

    /// <summary>Manual entry: active invitations of the event whose guest name matches.</summary>
    public async Task<IReadOnlyList<CheckInSearchItemDto>> SearchAsync(Guid eventId, string? query, CancellationToken ct)
    {
        var ev = await VisibleEventAsync(eventId, ct);
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
        {
            return [];
        }

        var term = $"%{query.Trim()}%";
        return await (
                from i in db.Invitations.AsNoTracking()
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where i.EventId == ev.Id && i.Status == InvitationStatus.Active && EF.Functions.ILike(g.Name, term)
                orderby g.Name
                select new CheckInSearchItemDto(i.Id, g.Name, g.Type, g.NumberOfPeople,
                    db.CheckIns.Any(c => c.InvitationId == i.Id)))
            .Take(SearchLimit)
            .ToListAsync(ct);
    }

    /// <summary>Arrivals so far, over active invitations of guests still on the list.</summary>
    public async Task<CheckInSummaryDto> GetSummaryAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await VisibleEventAsync(eventId, ct);
        var rows = await (
                from i in db.Invitations.AsNoTracking()
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where i.EventId == ev.Id && i.Status == InvitationStatus.Active
                select new { g.NumberOfPeople, CheckedIn = db.CheckIns.Any(c => c.InvitationId == i.Id) })
            .ToListAsync(ct);
        return new CheckInSummaryDto(
            rows.Count, rows.Sum(r => r.NumberOfPeople),
            rows.Count(r => r.CheckedIn), rows.Where(r => r.CheckedIn).Sum(r => r.NumberOfPeople));
    }

    /// <summary>Owner/Admin: the check-in log, newest first, optionally of one staff member.</summary>
    public async Task<IReadOnlyList<CheckInLogItemDto>> ListAsync(Guid eventId, Guid? staffId, CancellationToken ct)
    {
        var ev = await VisibleEventAsync(eventId, ct);
        return await Log(ev.Id, staffId).Take(5_000).ToListAsync(ct);
    }

    /// <summary>Staff activity: my own check-ins at an event.</summary>
    public async Task<IReadOnlyList<CheckInLogItemDto>> MyActivityAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await VisibleEventAsync(eventId, ct);
        return await Log(ev.Id, currentUser.RequireUserId()).Take(500).ToListAsync(ct);
    }

    private IQueryable<CheckInLogItemDto> Log(Guid eventId, Guid? staffId) =>
        from c in db.CheckIns.AsNoTracking()
        join i in db.Invitations.AsNoTracking() on c.InvitationId equals i.Id
        join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id // a checked-in guest can't be deleted
        join u in db.Users.AsNoTracking() on c.CheckedInBy equals u.Id
        where c.EventId == eventId && (staffId == null || c.CheckedInBy == staffId)
        orderby c.CheckedInAt descending
        select new CheckInLogItemDto(c.Id, c.InvitationId, g.Name, g.NumberOfPeople, c.CheckedInAt, u.Id, u.Name, c.Method);

    /// <summary>The event as the caller may see it: the organization's, and for Staff only an assigned one (else 404).</summary>
    private async Task<Event> VisibleEventAsync(Guid eventId, CancellationToken ct)
    {
        var events = db.Events.AsNoTracking().Include(e => e.Sessions).AsQueryable();
        if (currentUser.Role == UserRole.Staff)
        {
            var userId = currentUser.RequireUserId();
            events = events.Where(e => e.StaffAssignments.Any(a => a.UserId == userId));
        }
        return await events.SingleOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new NotFoundException("event.not_found", "Event not found.");
    }

    /// <summary>Check-in is open for an Active event on the date of its check-in session, in its time zone (Q-35).</summary>
    private async Task<Event> OpenEventAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await VisibleEventAsync(eventId, ct);
        if (ev.Status != EventStatus.Active)
        {
            throw new ConflictException("checkin.event_not_active", "Check-in is only possible for an active (paid) event.");
        }

        var timeZone = EventTimeZones.Find(ev.TimeZone);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), timeZone).DateTime);
        var eventDay = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(ev.CheckInSession.StartsAt, timeZone).DateTime);
        if (today != eventDay)
        {
            throw new ConflictException("checkin.not_event_day",
                $"Check-in is open on {eventDay:yyyy-MM-dd} only (event time zone).");
        }
        return ev;
    }

    /// <summary>
    /// An active invitation of this event whose guest is still on the list. Anything else, including a
    /// valid code of another event, is 404 <c>checkin.invitation_not_found</c>: no walk-ins (Q-31).
    /// </summary>
    private async Task<Found> FindAsync(Event ev, string? scanned, Guid? invitationId, CancellationToken ct)
    {
        var code = InvitationCode.FromScan(scanned);
        if (invitationId is null && !InvitationCode.IsWellFormed(code))
        {
            throw NotFound();
        }

        var invitation = await (
                from i in db.Invitations.AsNoTracking()
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where i.EventId == ev.Id && i.Status == InvitationStatus.Active
                    && (invitationId != null ? i.Id == invitationId : i.Code == code)
                select i)
            .SingleOrDefaultAsync(ct) ?? throw NotFound();
        var guest = await db.Guests.AsNoTracking().Include(g => g.Sessions).SingleAsync(g => g.Id == invitation.GuestId, ct);
        return new Found(invitation, guest);
    }

    private async Task<CheckInResultDto> ResultAsync(Event ev, Found found, CancellationToken ct)
    {
        var existing = await (
                from c in db.CheckIns.AsNoTracking()
                join u in db.Users.AsNoTracking() on c.CheckedInBy equals u.Id
                where c.InvitationId == found.Invitation.Id
                select new { c.CheckedInAt, u.Name })
            .SingleOrDefaultAsync(ct);
        var rsvp = await db.Rsvps.AsNoTracking().Where(r => r.InvitationId == found.Invitation.Id)
            .Select(r => (RsvpStatus?)r.Status).SingleOrDefaultAsync(ct) ?? RsvpStatus.Pending;

        var warnings = new List<string>();
        if (found.Guest.Sessions.All(s => s.SessionId != ev.CheckInSession.Id))
        {
            warnings.Add(CheckInWarnings.NotInvitedToCheckInSession);
        }
        if (rsvp == RsvpStatus.NotAttending)
        {
            warnings.Add(CheckInWarnings.RsvpNotAttending);
        }

        return new CheckInResultDto(found.Invitation.Id, found.Guest.Name, found.Guest.Type, found.Guest.NumberOfPeople,
            rsvp, existing is not null, existing?.CheckedInAt, existing?.Name, warnings);
    }

    private static NotFoundException NotFound() =>
        new("checkin.invitation_not_found", "No valid invitation for this event. Guests without an invitation can't check in.");
}
