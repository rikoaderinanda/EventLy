using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Services;

/// <summary>
/// Events of the caller's organization. The tenant filter on <see cref="Event"/> limits every query to
/// the caller's organization; Staff additionally see only events they are assigned to (others are 404).
/// </summary>
public sealed class EventService(AppDbContext db, ICurrentUser currentUser, AuditService audit, TimeProvider timeProvider)
{
    public async Task<IReadOnlyList<EventListItemDto>> ListAsync(EventListQuery filter, CancellationToken ct)
    {
        var query = VisibleEvents().AsNoTracking();
        if (filter.Status is { } status)
        {
            query = query.Where(e => e.Status == status);
        }
        if (filter.Category is { } category)
        {
            query = query.Where(e => e.Category == category);
        }
        if (filter.From is { } from)
        {
            query = query.Where(e => e.Date >= from);
        }
        if (filter.To is { } to)
        {
            query = query.Where(e => e.Date <= to);
        }

        return await query
            .OrderByDescending(e => e.Date)
            .Select(e => new EventListItemDto(e.Id, e.Name, e.Category, e.TimeZone, e.Date, e.Venue, e.Status))
            .Take(500)
            .ToListAsync(ct);
    }

    public async Task<EventDto> GetAsync(Guid id, CancellationToken ct) =>
        ToDto(await LoadAsync(id, VisibleEvents().AsNoTracking(), ct));

    public async Task<EventDto> CreateAsync(CreateEventRequest request, CancellationToken ct)
    {
        var timeZone = EventTimeZones.Find(request.TimeZone);
        var ev = new Event
        {
            Name = request.Name.Trim(),
            Category = request.Category,
            TimeZone = request.TimeZone,
            Description = Normalize(request.Description),
        };
        ApplySessions(ev, request.Sessions, timeZone);
        ev.SyncFromCheckInSession();

        db.Events.Add(ev);
        audit.Add(AuditActions.EventCreated, currentUser.UserId, currentUser.OrganizationId, nameof(Event), ev.Id);
        await db.SaveChangesAsync(ct);
        return ToDto(ev);
    }

    public async Task<EventDto> UpdateAsync(Guid id, UpdateEventRequest request, CancellationToken ct)
    {
        var ev = await LoadAsync(id, db.Events, ct);
        if (!EventLifecycle.IsEditable(ev.Status))
        {
            throw new ConflictException("event.not_editable", "A completed or cancelled event can't be changed.");
        }

        // Optimistic concurrency: the update only succeeds if nobody changed the event since it was read.
        db.Entry(ev).Property(e => e.Version).OriginalValue = request.Version;

        var timeZone = EventTimeZones.Find(request.TimeZone);
        ev.Name = request.Name.Trim();
        ev.Category = request.Category;
        ev.TimeZone = request.TimeZone;
        ev.Description = Normalize(request.Description);
        ApplySessions(ev, request.Sessions, timeZone);
        ev.SyncFromCheckInSession();
        audit.Add(AuditActions.EventUpdated, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id);

        await SaveWithConcurrencyCheckAsync(ct);
        return ToDto(ev);
    }

    /// <summary>Soft delete. Only drafts and cancelled events; paid events keep their history.</summary>
    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var ev = await LoadAsync(id, db.Events, ct);
        if (!EventLifecycle.IsDeletable(ev.Status))
        {
            throw new ConflictException("event.not_deletable", "Only a draft or a cancelled event can be deleted.");
        }

        ev.DeletedAt = timeProvider.GetUtcNow();
        audit.Add(AuditActions.EventDeleted, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Owner only. No refund in the MVP (decision Q-32).</summary>
    public Task<EventDto> CancelAsync(Guid id, CancellationToken ct) =>
        ChangeStatusAsync(id, EventStatus.Cancelled, ct);

    public Task<EventDto> CompleteAsync(Guid id, CancellationToken ct) =>
        ChangeStatusAsync(id, EventStatus.Completed, ct);

    public async Task<IReadOnlyList<EventStaffDto>> GetStaffAsync(Guid eventId, CancellationToken ct)
    {
        await LoadAsync(eventId, db.Events.AsNoTracking(), ct);
        return await (
                from assignment in db.EventStaffAssignments.AsNoTracking()
                join user in db.Users.AsNoTracking() on assignment.UserId equals user.Id
                where assignment.EventId == eventId
                orderby user.Name
                select new EventStaffDto(user.Id, user.Name, user.Email, user.Status))
            .ToListAsync(ct);
    }

    /// <summary>Replaces the Staff assigned to the event. Only Staff of the same organization qualify.</summary>
    public async Task<IReadOnlyList<EventStaffDto>> AssignStaffAsync(Guid eventId, AssignStaffRequest request, CancellationToken ct)
    {
        var ev = await LoadAsync(eventId, db.Events, ct);
        var organizationId = currentUser.RequireOrganizationId();
        var requested = request.UserIds.Distinct().ToHashSet();

        var validIds = await db.Users
            .Where(u => requested.Contains(u.Id) && u.OrganizationId == organizationId
                && u.Role == UserRole.Staff && u.Status != UserStatus.Disabled)
            .Select(u => u.Id)
            .ToListAsync(ct);
        if (validIds.Count != requested.Count)
        {
            throw new AppException(StatusCodes.Status400BadRequest, "event.invalid_staff",
                "Only active Staff members of your organization can be assigned.");
        }

        ev.StaffAssignments.RemoveAll(a => !requested.Contains(a.UserId));
        var now = timeProvider.GetUtcNow();
        foreach (var userId in requested.Where(id => ev.StaffAssignments.All(a => a.UserId != id)))
        {
            ev.StaffAssignments.Add(new EventStaffAssignment { EventId = ev.Id, UserId = userId, CreatedAt = now });
        }

        audit.Add(AuditActions.EventStaffAssigned, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id,
            new { staff = requested.Count });
        await db.SaveChangesAsync(ct);
        return await GetStaffAsync(eventId, ct);
    }

    private async Task<EventDto> ChangeStatusAsync(Guid id, EventStatus target, CancellationToken ct)
    {
        var ev = await LoadAsync(id, db.Events, ct);
        if (!EventLifecycle.CanChange(ev.Status, target))
        {
            throw new ConflictException("event.invalid_status_change",
                $"An event that is {ev.Status} can't become {target}.");
        }

        var previous = ev.Status;
        ev.Status = target;
        audit.Add(AuditActions.EventStatusChanged, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id,
            new { from = previous.ToString(), to = target.ToString() });
        await db.SaveChangesAsync(ct);
        return ToDto(ev);
    }

    /// <summary>Events the caller may see: the organization's (tenant filter), and for Staff only assigned ones.</summary>
    private IQueryable<Event> VisibleEvents()
    {
        var events = db.Events.AsQueryable();
        if (currentUser.Role == UserRole.Staff)
        {
            var userId = currentUser.RequireUserId();
            events = events.Where(e => e.StaffAssignments.Any(a => a.UserId == userId));
        }
        return events;
    }

    private static async Task<Event> LoadAsync(Guid id, IQueryable<Event> source, CancellationToken ct) =>
        await source.Include(e => e.Sessions).Include(e => e.StaffAssignments).SingleOrDefaultAsync(e => e.Id == id, ct)
        ?? throw new NotFoundException("event.not_found", "Event not found.");

    /// <summary>
    /// Updates sessions in place by id, adds new ones and removes missing ones, so references to a
    /// session (guest invitations per session, from Phase 6) survive an edit.
    /// </summary>
    private static void ApplySessions(Event ev, IReadOnlyList<EventSessionInput> inputs, TimeZoneInfo timeZone)
    {
        var keep = inputs.Where(i => i.Id is not null).Select(i => i.Id!.Value).ToHashSet();
        if (keep.Any(id => ev.Sessions.All(s => s.Id != id)))
        {
            throw new AppException(StatusCodes.Status400BadRequest, "event.unknown_session",
                "A session doesn't belong to this event.");
        }
        ev.Sessions.RemoveAll(s => !keep.Contains(s.Id));

        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            var session = input.Id is { } existingId ? ev.Sessions.Single(s => s.Id == existingId) : null;
            if (session is null)
            {
                session = new EventSession { EventId = ev.Id, Name = input.Name, Venue = input.Venue };
                ev.Sessions.Add(session);
            }

            session.Name = input.Name.Trim();
            session.Venue = input.Venue.Trim();
            session.MapsUrl = Normalize(input.MapsUrl);
            session.StartsAt = ToUtc(input.StartsAtLocal, timeZone);
            session.EndsAt = ToUtc(input.EndsAtLocal, timeZone);
            session.IsCheckInSession = input.IsCheckInSession;
            session.SortOrder = i;
        }
    }

    private async Task SaveWithConcurrencyCheckAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("event.modified_elsewhere",
                "Someone else changed this event. Reload it and apply your changes again.");
        }
    }

    private static DateTimeOffset ToUtc(DateTime local, TimeZoneInfo timeZone) =>
        new(TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), timeZone), TimeSpan.Zero);

    private static DateTime ToLocal(DateTimeOffset utc, TimeZoneInfo timeZone) =>
        TimeZoneInfo.ConvertTimeFromUtc(utc.UtcDateTime, timeZone);

    private static EventDto ToDto(Event e)
    {
        var timeZone = EventTimeZones.Find(e.TimeZone);
        return new EventDto(
            e.Id, e.Name, e.Category, e.Description, e.TimeZone, e.Date, e.Venue, e.Status,
            [.. e.Sessions.OrderBy(s => s.SortOrder).Select(s => new EventSessionDto(
                s.Id, s.Name, s.StartsAt, s.EndsAt, ToLocal(s.StartsAt, timeZone), ToLocal(s.EndsAt, timeZone),
                s.Venue, s.MapsUrl, s.IsCheckInSession))],
            e.StaffAssignments.Count, e.CreatedAt, e.UpdatedAt, e.Version);
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
