using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Public;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using EventLy.Api.Storage;
using Npgsql;

namespace EventLy.Api.Services;

/// <summary>
/// The guest's side, keyed by the invitation code (no sign-in). An unknown or revoked code, a deleted
/// guest, and an event that isn't Active or Completed all answer the same 404, so nothing is revealed.
/// Everything returned belongs to this invitation or is the event's public content.
/// </summary>
public sealed class PublicInvitationService(AppDbContext db, InvitationLinks links, TimeProvider timeProvider, IFileStorage storage)
{
    public const int WishPageSize = 20;

    /// <summary>The invitation behind a code, with its guest and event, acting as their organization.</summary>
    public sealed record Context(Invitation Invitation, Guest Guest, Event Event)
    {
        public PackageFeatures Features => Event.PackageSnapshot?.Features ?? new PackageFeatures();
    }

    /// <summary>The invitation page. The first view sets <c>opened_at</c> (invitation statistics, Q-13).</summary>
    public async Task<PublicInvitationDto> GetAsync(string code, CancellationToken ct)
    {
        var context = await ResolveAsync(code, ct);
        if (context.Invitation.OpenedAt is null)
        {
            // Set only if still empty, so two first views at once don't overwrite each other.
            await db.Invitations.Where(i => i.Id == context.Invitation.Id && i.OpenedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.OpenedAt, timeProvider.GetUtcNow()), ct);
        }

        var rsvp = await db.Rsvps.AsNoTracking().SingleOrDefaultAsync(r => r.InvitationId == context.Invitation.Id, ct);
        var wish = await db.Wishes.AsNoTracking().Where(w => w.InvitationId == context.Invitation.Id)
            .Select(w => w.Message).SingleOrDefaultAsync(ct);
        var checkedIn = await db.CheckIns.AnyAsync(c => c.InvitationId == context.Invitation.Id, ct);
        return ToDto(context, rsvp, wish, checkedIn);
    }

    /// <summary>Attending or not, changeable until the event is over (then 409 <c>rsvp.closed</c>), decided 2026-10-01.</summary>
    public async Task<PublicRsvpDto> SetRsvpAsync(string code, UpdateRsvpRequest request, CancellationToken ct)
    {
        var context = await ResolveAsync(code, ct, tracking: true);
        if (!RsvpOpen(context.Event))
        {
            throw new ConflictException("rsvp.closed", "RSVP is closed for this event.");
        }

        var now = timeProvider.GetUtcNow();
        var rsvp = await UpsertAsync(
            () => db.Rsvps.SingleOrDefaultAsync(r => r.InvitationId == context.Invitation.Id, ct),
            () => new Rsvp { InvitationId = context.Invitation.Id },
            r => db.Rsvps.Add(r),
            r =>
            {
                r.Status = request.Status;
                r.RespondedAt = now;
            },
            ct);
        return new PublicRsvpDto(rsvp.Status, rsvp.RespondedAt, true, context.Event.EndsAt);
    }

    /// <summary>The invitation link as a QR, to show at the entrance.</summary>
    public async Task<byte[]> GetQrAsync(string code, int size, CancellationToken ct)
    {
        var context = await ResolveAsync(code, ct);
        return InvitationService.Png(links.Url(context.Invitation.Code), size);
    }

    /// <summary>Visible wishes of the event, newest first. Only names and messages, no other data.</summary>
    public async Task<PublicWishPageDto> GetWishesAsync(string code, int page, CancellationToken ct)
    {
        var context = await ResolveAsync(code, ct);
        if (!context.Features.WishesEnabled)
        {
            throw FeatureOff();
        }

        page = Math.Max(page, 1);
        var rows = await (
                from w in db.Wishes.AsNoTracking()
                join i in db.Invitations.AsNoTracking() on w.InvitationId equals i.Id
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where w.EventId == context.Event.Id && !w.IsHidden
                orderby w.CreatedAt descending
                select new { g.Name, w.Message, w.CreatedAt, w.InvitationId })
            .Skip((page - 1) * WishPageSize)
            .Take(WishPageSize + 1)
            .ToListAsync(ct);

        return new PublicWishPageDto(
            [.. rows.Take(WishPageSize).Select(r =>
                new PublicWishDto(r.Name, r.Message, r.CreatedAt, r.InvitationId == context.Invitation.Id))],
            page, rows.Count > WishPageSize);
    }

    /// <summary>Creates or edits this invitation's one wish (Q-42), while wishes are open.</summary>
    public async Task<PublicWishDto> SetWishAsync(string code, UpdateWishRequest request, CancellationToken ct)
    {
        var context = await ResolveAsync(code, ct, tracking: true);
        if (!context.Features.WishesEnabled)
        {
            throw FeatureOff();
        }
        if (!WishesOpen(context.Event))
        {
            throw new ConflictException("wish.closed", "Wishes are closed for this event.");
        }

        var message = request.Message.Trim();
        var wish = await UpsertAsync(
            () => db.Wishes.SingleOrDefaultAsync(w => w.InvitationId == context.Invitation.Id, ct),
            () => new Wish { EventId = context.Event.Id, InvitationId = context.Invitation.Id, Message = message },
            w => db.Wishes.Add(w),
            w => w.Message = message,
            ct);
        return new PublicWishDto(context.Guest.Name, wish.Message, wish.CreatedAt, true);
    }

    public async Task<PublicGiftsDto> GetGiftsAsync(string code, CancellationToken ct)
    {
        var context = await ResolveAsync(code, ct);
        if (!context.Features.DigitalGiftEnabled)
        {
            throw FeatureOff();
        }

        var accounts = await db.GiftAccounts.AsNoTracking()
            .Where(a => a.EventId == context.Event.Id)
            .OrderBy(a => a.SortOrder)
            .Select(a => new GiftAccountDto(a.Kind, a.Provider, a.AccountNumber, a.AccountHolder))
            .ToListAsync(ct);
        return new PublicGiftsDto(accounts, context.Event.GiftAddress, Url(context.Event.GiftQrisKey));
    }

    /// <summary>"Konfirmasi hadiah" (Q-41): only Owner/Admin see it. At most a few per invitation.</summary>
    public async Task ConfirmGiftAsync(string code, CreateGiftConfirmationRequest request, CancellationToken ct)
    {
        var context = await ResolveAsync(code, ct);
        if (!context.Features.DigitalGiftEnabled)
        {
            throw FeatureOff();
        }
        if (await db.GiftConfirmations.CountAsync(c => c.InvitationId == context.Invitation.Id, ct) >= GiftConfirmation.MaxPerInvitation)
        {
            throw new QuotaExceededException("gift.confirmation_limit",
                $"At most {GiftConfirmation.MaxPerInvitation} confirmations per invitation.");
        }

        db.GiftConfirmations.Add(new GiftConfirmation
        {
            EventId = context.Event.Id,
            InvitationId = context.Invitation.Id,
            SenderName = request.SenderName.Trim(),
            Amount = request.Amount,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            CreatedAt = timeProvider.GetUtcNow(),
        });
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Open while the event is Active and its last session hasn't ended (Q-47).</summary>
    /// <summary>The event's background music, when the package allows it and the Owner uploaded one.</summary>
    public async Task<string> MusicUrlAsync(string code, CancellationToken ct)
    {
        var context = await ResolveAsync(code, ct);
        if (!context.Features.BackgroundMusicEnabled || context.Event.MusicKey is null)
        {
            throw FeatureOff();
        }
        return storage.GetReadUrl(context.Event.MusicKey, PhotoService.UrlLifetime);
    }

    private string? Url(string? key) => key is null ? null : storage.GetReadUrl(key, PhotoService.UrlLifetime);

    private bool RsvpOpen(Event ev) => ev.Status == EventStatus.Active && timeProvider.GetUtcNow() < ev.EndsAt;

    private bool WishesOpen(Event ev) =>
        timeProvider.GetUtcNow() < ev.CheckInSession.EndsAt + EventLifecycle.WishesOpenAfterEvent;

    /// <summary>
    /// Finds the invitation by its code. Allow-listed tenant filter bypass: a guest has no sign-in, so the
    /// invitation row names the organization, and the rest of the request acts as that organization.
    /// </summary>
    public async Task<Context> ResolveAsync(string code, CancellationToken ct, bool tracking = false)
    {
        if (!InvitationCode.IsWellFormed(code))
        {
            throw NotFound();
        }

        var invitations = db.Invitations.IgnoreQueryFilters([AppDbContext.TenantFilter]);
        var invitation = await (tracking ? invitations : invitations.AsNoTracking())
            .SingleOrDefaultAsync(i => i.Code == code && i.Status == InvitationStatus.Active, ct) ?? throw NotFound();
        db.ActAsOrganization(invitation.OrganizationId);

        var guest = await db.Guests.AsNoTracking().Include(g => g.Sessions)
            .SingleOrDefaultAsync(g => g.Id == invitation.GuestId, ct) ?? throw NotFound();
        var ev = await db.Events.AsNoTracking().Include(e => e.Sessions)
            .SingleOrDefaultAsync(e => e.Id == invitation.EventId, ct);
        if (ev is null || !EventLifecycle.IsPublic(ev.Status))
        {
            throw NotFound();
        }
        return new Context(invitation, guest, ev);
    }

    /// <summary>
    /// Updates the invitation's single row, or adds it. Two first answers at the same moment meet the
    /// unique index; the loser updates the row the winner added.
    /// </summary>
    private async Task<T> UpsertAsync<T>(
        Func<Task<T?>> find, Func<T> create, Action<T> add, Action<T> apply, CancellationToken ct)
        where T : class
    {
        for (var attempt = 1; ; attempt++)
        {
            var row = await find();
            if (row is null)
            {
                row = create();
                add(row);
            }
            apply(row);

            try
            {
                await db.SaveChangesAsync(ct);
                return row;
            }
            catch (DbUpdateException ex) when (attempt == 1
                && ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                db.ChangeTracker.Clear();
            }
        }
    }

    private PublicInvitationDto ToDto(Context context, Rsvp? rsvp, string? myWish, bool checkedIn)
    {
        var (invitation, guest, ev) = context;
        var invitedTo = guest.Sessions.Select(s => s.SessionId).ToHashSet();
        var timeZone = EventTimeZones.Find(ev.TimeZone);
        var sessions = ev.Sessions
            .Where(s => invitedTo.Contains(s.Id))
            .OrderBy(s => s.SortOrder)
            .Select(s => new PublicSessionDto(s.Name, s.StartsAt, s.EndsAt,
                TimeZoneInfo.ConvertTimeFromUtc(s.StartsAt.UtcDateTime, timeZone),
                TimeZoneInfo.ConvertTimeFromUtc(s.EndsAt.UtcDateTime, timeZone),
                s.Venue, s.MapsUrl, s.IsCheckInSession))
            .ToList();
        var features = context.Features;

        return new PublicInvitationDto(
            guest.Name, invitation.Type, guest.NumberOfPeople,
            new PublicEventDto(ev.Name, ev.Category, ev.Description, ev.TimeZone, ev.Status, Url(ev.CoverImageKey), sessions,
                ev.Theme),
            new PublicRsvpDto(rsvp?.Status ?? RsvpStatus.Pending, rsvp?.RespondedAt, RsvpOpen(ev), ev.EndsAt),
            new PublicFeaturesDto(
                features.CountdownEnabled,
                features.WishesEnabled,
                features.WishesEnabled && WishesOpen(ev),
                features.DigitalGiftEnabled,
                BackgroundMusic: features.BackgroundMusicEnabled && ev.MusicKey is not null),
            features.WishesEnabled ? myWish : null,
            checkedIn);
    }

    private static NotFoundException NotFound() => new("invitation.not_found", "Invitation not found.");

    private static NotFoundException FeatureOff() => new("feature.not_available", "This feature isn't part of the event.");
}
