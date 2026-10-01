using EventLy.Api.Common.Localization;
using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Data.Configurations;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Entities;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EventLy.Api.Services;

/// <summary>
/// Guests of an event. Creating a guest creates their invitation in the same save (1:1). The number of
/// people is limited by the package: the paid snapshot's <c>maxGuests</c>, or before payment the largest
/// offered package (the checkout then checks the chosen package). A group counts all its people.
/// </summary>
public sealed class GuestService(
    AppDbContext db,
    ICurrentUser currentUser,
    AuditService audit,
    InvitationLinks links,
    TimeProvider timeProvider,
    IValidator<CreateGuestRequest> guestValidator)
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
        if (filter.Rsvp is { } rsvp)
        {
            // No RSVP row is the same as Pending.
            query = rsvp == RsvpStatus.Pending
                ? query.Where(g => !db.Rsvps.Any(r => r.InvitationId == g.Invitation!.Id && r.Status != RsvpStatus.Pending))
                : query.Where(g => db.Rsvps.Any(r => r.InvitationId == g.Invitation!.Id && r.Status == rsvp));
        }
        if (filter.CheckedIn is { } checkedIn)
        {
            query = query.Where(g => db.CheckIns.Any(c => c.InvitationId == g.Invitation!.Id) == checkedIn);
        }

        var guests = await query
            .Include(g => g.Sessions).Include(g => g.Invitation).AsSplitQuery()
            .OrderBy(g => g.Name).ThenBy(g => g.CreatedAt)
            .Take(2_000)
            .ToListAsync(ct);
        var invitationIds = guests.Select(g => g.Invitation!.Id).ToList();
        var answers = await db.Rsvps.AsNoTracking()
            .Where(r => invitationIds.Contains(r.InvitationId))
            .ToDictionaryAsync(r => r.InvitationId, r => r.Status, ct);
        var arrivals = await db.CheckIns.AsNoTracking()
            .Where(c => invitationIds.Contains(c.InvitationId))
            .ToDictionaryAsync(c => c.InvitationId, c => c.CheckedInAt, ct);
        return new GuestListDto(
            [.. guests.Select(g => ToDto(g, answers.GetValueOrDefault(g.Invitation!.Id, RsvpStatus.Pending),
                EventLifecycle.IsPublic(ev.Status),
                arrivals.TryGetValue(g.Invitation!.Id, out var at) ? at : null))],
            total, people, ev.PackageSnapshot?.Features.MaxGuests);
    }

    public async Task<GuestDto> GetAsync(Guid eventId, Guid guestId, CancellationToken ct)
    {
        var guest = await LoadGuestAsync(eventId, guestId, db.Guests.AsNoTracking(), ct);
        var status = await db.Events.Where(e => e.Id == eventId).Select(e => e.Status).SingleAsync(ct);
        return ToDto(guest, await RsvpOfAsync(guest, ct), EventLifecycle.IsPublic(status), await CheckedInAtAsync(guest, ct));
    }

    public Task<GuestDto> CreateAsync(Guid eventId, CreateGuestRequest request, CancellationToken ct) =>
        InLockedEventAsync(eventId, async ev =>
        {
            await RequireUniqueAsync(ev.Id, request.Name, request.Phone, exceptGuestId: null, ct);
            await RequirePlacesAsync(ev, request.NumberOfPeople, ct);
            var guest = AddGuest(ev, request);
            audit.Add(AuditActions.GuestCreated, currentUser.UserId, ev.OrganizationId, nameof(Guest), guest.Id,
                new { invitationId = guest.Invitation!.Id });
            return guest;
        }, ct);

    /// <summary>
    /// Excel import (decisions Q-12, Q-55): all or nothing. Every row is checked like a single guest, and
    /// names and WhatsApp numbers must be unique in the file and against the guest list. If any row is
    /// wrong, nothing is imported and every problem is reported by row number. The guest limit applies to
    /// the whole file. A group is a row with more than one person. Guests get all sessions.
    /// </summary>
    public async Task<GuestImportResultDto> ImportAsync(Guid eventId, Stream workbook, CancellationToken ct)
    {
        // The event first: another tenant's or a closed event answers 404/409 before the file is looked at.
        await LoadEditableEventAsync(eventId, ct);
        var (rows, fileError) = GuestSpreadsheet.Read(workbook);
        if (fileError is not null)
        {
            throw new AppException(StatusCodes.Status400BadRequest, "guest.import_invalid_file", fileError);
        }

        var existing = await db.Guests.AsNoTracking().Where(g => g.EventId == eventId)
            .Select(g => new { g.Name, g.PhoneKey }).ToListAsync(ct);
        var takenNames = existing.Select(g => NameKey(g.Name)).ToHashSet();
        var takenPhones = existing.Where(g => g.PhoneKey != null).Select(g => g.PhoneKey!).ToHashSet();
        var namesInFile = new Dictionary<string, int>();
        var phonesInFile = new Dictionary<string, int>();

        var requests = new List<CreateGuestRequest>();
        var errors = new List<GuestImportErrorDto>();
        foreach (var row in rows)
        {
            if (row.People is not { } people)
            {
                errors.Add(new GuestImportErrorDto(row.Line, row.Name, [Texts.T($"\"{row.PeopleText}\" bukan jumlah orang yang valid.", $"\"{row.PeopleText}\" is not a number of people.")]));
                continue;
            }

            var request = new CreateGuestRequest(row.Name, row.Phone, row.Email,
                people > 1 ? GuestType.Group : GuestType.Individual, people, null);
            var messages = (await guestValidator.ValidateAsync(request, ct)).Errors.Select(e => e.ErrorMessage).ToList();

            var name = NameKey(row.Name);
            if (name.Length > 0 && !namesInFile.TryAdd(name, row.Line))
            {
                messages.Add(Texts.T($"Nama sama dengan baris {namesInFile[name]}.", $"Same name as row {namesInFile[name]}."));
            }
            else if (takenNames.Contains(name))
            {
                messages.Add(Texts.T("Nama ini sudah ada di daftar tamu.", "A guest with this name is already on the list."));
            }

            if (WhatsAppMessage.NormalizePhone(row.Phone) is { } phone)
            {
                if (!phonesInFile.TryAdd(phone, row.Line))
                {
                    messages.Add(Texts.T($"Nomor WhatsApp sama dengan baris {phonesInFile[phone]}.", $"Same WhatsApp number as row {phonesInFile[phone]}."));
                }
                else if (takenPhones.Contains(phone))
                {
                    messages.Add(Texts.T("Nomor WhatsApp ini sudah dipakai tamu lain.", "This WhatsApp number already belongs to another guest."));
                }
            }

            if (messages.Count == 0)
            {
                requests.Add(request);
            }
            else
            {
                errors.Add(new GuestImportErrorDto(row.Line, row.Name, messages));
            }
        }
        if (errors.Count > 0)
        {
            return new GuestImportResultDto(0, 0, errors);
        }

        return await LockedAsync(eventId, async ev =>
        {
            await RequirePlacesAsync(ev, requests.Sum(r => r.NumberOfPeople), ct);
            foreach (var request in requests)
            {
                AddGuest(ev, request);
            }
            audit.Add(AuditActions.GuestsImported, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id,
                new { guests = requests.Count, people = requests.Sum(r => r.NumberOfPeople) });
            return new GuestImportResultDto(requests.Count, requests.Sum(r => r.NumberOfPeople), []);
        }, ct);
    }

    public Task<GuestDto> UpdateAsync(Guid eventId, Guid guestId, UpdateGuestRequest request, CancellationToken ct) =>
        InLockedEventAsync(eventId, async ev =>
        {
            var guest = await LoadGuestAsync(eventId, guestId, db.Guests, ct);
            await RequireUniqueAsync(ev.Id, request.Name, request.Phone, exceptGuestId: guest.Id, ct);
            if (request.NumberOfPeople > guest.NumberOfPeople)
            {
                await RequirePlacesAsync(ev, request.NumberOfPeople - guest.NumberOfPeople, ct);
            }

            guest.Name = GuestNames.Normalize(request.Name);
            guest.Phone = Normalize(request.Phone);
            guest.PhoneKey = WhatsAppMessage.NormalizePhone(request.Phone);
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
        if (await db.CheckIns.AnyAsync(c => c.InvitationId == guest.Invitation!.Id, ct))
        {
            throw new ConflictException("guest.checked_in", "A guest who has checked in can't be deleted.");
        }

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
    private Task<T> LockedAsync<T>(Guid eventId, Func<Event, Task<T>> change, CancellationToken ct)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var ev = await LoadEditableEventAsync(eventId, ct);
            await db.Database.ExecuteSqlAsync($"SELECT 1 FROM events WHERE id = {ev.Id} FOR UPDATE", ct);

            var result = await change(ev);
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg
                && pg.ConstraintName is GuestConfiguration.GuestNameIndex or GuestConfiguration.GuestPhoneIndex)
            {
                // Another request added the same name or number a moment earlier.
                throw pg.ConstraintName == GuestConfiguration.GuestNameIndex ? NameTaken() : PhoneTaken();
            }
            await transaction.CommitAsync(ct);
            return result;
        });
    }

    /// <summary>One name and one WhatsApp number per event among guests still on the list (decision Q-55).</summary>
    private async Task RequireUniqueAsync(Guid eventId, string name, string? phone, Guid? exceptGuestId, CancellationToken ct)
    {
        var normalized = GuestNames.Normalize(name);
        // The name column is citext, so this comparison ignores case.
        if (await db.Guests.AnyAsync(g => g.EventId == eventId && g.Name == normalized && g.Id != exceptGuestId, ct))
        {
            throw NameTaken();
        }
        if (WhatsAppMessage.NormalizePhone(phone) is { } key
            && await db.Guests.AnyAsync(g => g.EventId == eventId && g.PhoneKey == key && g.Id != exceptGuestId, ct))
        {
            throw PhoneTaken();
        }
    }

    private static string NameKey(string name) => GuestNames.Normalize(name).ToLowerInvariant();

    private static ConflictException NameTaken() =>
        new("guest.name_taken", "A guest with this name is already on the list of this event.");

    private static ConflictException PhoneTaken() =>
        new("guest.phone_taken", "This WhatsApp number already belongs to another guest of this event.");

    private async Task<GuestDto> InLockedEventAsync(Guid eventId, Func<Event, Task<Guest>> change, CancellationToken ct)
    {
        var (guest, sendable) = await LockedAsync(eventId,
            async ev => (Guest: await change(ev), Sendable: EventLifecycle.IsPublic(ev.Status)), ct);
        return ToDto(guest, await RsvpOfAsync(guest, ct), sendable, await CheckedInAtAsync(guest, ct));
    }

    /// <summary>A new guest with their invitation (1:1), invited to the chosen sessions or all of them.</summary>
    private Guest AddGuest(Event ev, CreateGuestRequest request)
    {
        var guest = new Guest
        {
            EventId = ev.Id,
            Name = GuestNames.Normalize(request.Name),
            Phone = Normalize(request.Phone),
            PhoneKey = WhatsAppMessage.NormalizePhone(request.Phone),
            Email = Normalize(request.Email),
            Type = request.GuestType,
            NumberOfPeople = request.NumberOfPeople,
        };
        guest.Invitation = new Invitation { EventId = ev.Id, GuestId = guest.Id, Type = guest.Type };
        SetSessions(guest, ev, request.SessionIds ?? [.. ev.Sessions.Select(s => s.Id)]);
        db.Guests.Add(guest);
        return guest;
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

    private async Task<RsvpStatus> RsvpOfAsync(Guest guest, CancellationToken ct) =>
        await db.Rsvps.AsNoTracking().Where(r => r.InvitationId == guest.Invitation!.Id)
            .Select(r => (RsvpStatus?)r.Status).SingleOrDefaultAsync(ct) ?? RsvpStatus.Pending;

    /// <summary><paramref name="sendable"/>: the event is paid, so the link may be shown and sent (Q-48).</summary>
    private async Task<DateTimeOffset?> CheckedInAtAsync(Guest guest, CancellationToken ct) =>
        await db.CheckIns.AsNoTracking().Where(c => c.InvitationId == guest.Invitation!.Id)
            .Select(c => (DateTimeOffset?)c.CheckedInAt).SingleOrDefaultAsync(ct);

    private GuestDto ToDto(Guest g, RsvpStatus rsvp, bool sendable, DateTimeOffset? checkedInAt)
    {
        var invitation = g.Invitation!;
        return new GuestDto(
            g.Id, g.EventId, g.Name, g.Phone, g.Email, g.Type, g.NumberOfPeople,
            [.. g.Sessions.Select(s => s.SessionId)],
            new InvitationSummaryDto(invitation.Id, invitation.Code, sendable ? links.Url(invitation.Code) : null, invitation.Status,
                invitation.OpenedAt),
            rsvp,
            checkedInAt,
            g.CreatedAt);
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static NotFoundException EventNotFound() => new("event.not_found", "Event not found.");
}
