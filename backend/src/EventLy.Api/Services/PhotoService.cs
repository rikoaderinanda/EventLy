using System.IO.Compression;
using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Photos;
using EventLy.Api.Entities;
using EventLy.Api.Storage;
using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Services;

/// <summary>
/// Photos of checked-in invitations (docs/architecture/01-system-architecture.md §6.4/§6.5): Staff and Owner
/// upload after check-in, guests take photos with the in-app camera, the guest sees only their own
/// invitation's photos, Owner/Admin see and manage the whole event. Every photo counts toward the package's
/// maxPhotos; guest photos also toward maxGuestPhotosPerInvitation.
/// </summary>
public sealed class PhotoService(
    AppDbContext db,
    ICurrentUser currentUser,
    AuditService audit,
    IFileStorage storage,
    PublicInvitationService publicInvitations,
    TimeProvider timeProvider)
{
    public const int MaxFilesPerUpload = 10;
    public static readonly TimeSpan UrlLifetime = TimeSpan.FromMinutes(10);

    /// <summary>Staff (assigned) or Owner: photos for a checked-in invitation, 1 to 10 files.</summary>
    public async Task<IReadOnlyList<PhotoDto>> UploadAsync(Guid invitationId, IReadOnlyList<byte[]> files, CancellationToken ct)
    {
        if (files.Count is 0 or > MaxFilesPerUpload)
        {
            throw new AppException(StatusCodes.Status400BadRequest, "photo.file_count",
                $"Upload 1 to {MaxFilesPerUpload} photos at a time.");
        }

        var invitation = await db.Invitations.AsNoTracking().SingleOrDefaultAsync(i => i.Id == invitationId, ct)
            ?? throw InvitationNotFound();
        var ev = await VisibleEventAsync(invitation.EventId, ct) ?? throw InvitationNotFound();
        if (ev.Status != EventStatus.Active)
        {
            throw new ConflictException("photo.event_not_active", "Photos can be added while the event is active.");
        }
        if (!await db.CheckIns.AnyAsync(c => c.InvitationId == invitationId, ct))
        {
            throw new ConflictException("photo.not_checked_in", "Photos are for guests who have checked in.");
        }

        var images = files.Select(f => ImageProcessor.Process(f)).ToList();
        if (images.Any(i => i is null))
        {
            throw InvalidImage();
        }

        var source = currentUser.Role == UserRole.Owner ? PhotoSource.Owner : PhotoSource.Staff;
        var photos = await StoreAsync(ev, invitation, source, currentUser.RequireUserId(), images!, guestLimit: null, ct);
        var guestName = await GuestNameAsync(invitation.GuestId, ct);
        return [.. photos.Select(p => ToDto(p, guestName))];
    }

    public async Task<GalleryDto> GalleryAsync(Guid eventId, Guid? invitationId, CancellationToken ct)
    {
        var ev = await db.Events.AsNoTracking().SingleOrDefaultAsync(e => e.Id == eventId, ct) ?? throw EventNotFound();
        var all = db.Photos.AsNoTracking().Where(p => p.EventId == eventId);
        var total = await all.CountAsync(ct);
        var bytes = await all.SumAsync(p => p.SizeBytes, ct);

        var rows = await (
                from p in all
                join i in db.Invitations.AsNoTracking() on p.InvitationId equals i.Id
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where invitationId == null || p.InvitationId == invitationId
                orderby g.Name, p.CreatedAt
                select new { Photo = p, g.Name })
            .Take(2_000)
            .ToListAsync(ct);

        var features = ev.PackageSnapshot?.Features;
        return new GalleryDto([.. rows.Select(r => ToDto(r.Photo, r.Name))], total, features?.MaxPhotos, bytes,
            features?.ZipDownload == true, features?.GuestUploadEnabled == true, ev.GuestUploadEnabled);
    }

    /// <summary>Owner/Admin: removes the row and both objects. Audited.</summary>
    public async Task DeleteAsync(Guid photoId, CancellationToken ct)
    {
        var photo = await db.Photos.SingleOrDefaultAsync(p => p.Id == photoId, ct) ?? throw PhotoNotFound();
        db.Photos.Remove(photo);
        audit.Add(AuditActions.PhotoDeleted, currentUser.UserId, photo.OrganizationId, nameof(Photo), photo.Id,
            new { photo.InvitationId, source = photo.Source.ToString() });
        await db.SaveChangesAsync(ct);
        await storage.DeleteAsync([photo.ObjectKey, photo.ThumbnailKey], ct);
    }

    /// <summary>Owner/Admin: a signed URL that downloads the original.</summary>
    public async Task<string> DownloadUrlAsync(Guid photoId, CancellationToken ct)
    {
        var photo = await db.Photos.AsNoTracking().SingleOrDefaultAsync(p => p.Id == photoId, ct) ?? throw PhotoNotFound();
        return storage.GetReadUrl(photo.ObjectKey, UrlLifetime, $"evently-{photo.Id:N}.jpg");
    }

    public async Task SetGuestCameraAsync(Guid eventId, GuestCameraSettingRequest request, CancellationToken ct)
    {
        var ev = await db.Events.SingleOrDefaultAsync(e => e.Id == eventId, ct) ?? throw EventNotFound();
        ev.GuestUploadEnabled = request.Enabled;
        audit.Add(AuditActions.EventMediaUpdated, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id,
            new { guestCamera = request.Enabled });
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Owner/Admin with the package's zipDownload: the gallery (or one invitation's photos) written straight
    /// into <paramref name="output"/> as a ZIP, one folder per guest. No temporary file, no job queue.
    /// </summary>
    public async Task<string> PrepareZipAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await db.Events.AsNoTracking().SingleOrDefaultAsync(e => e.Id == eventId, ct) ?? throw EventNotFound();
        if (ev.PackageSnapshot?.Features.ZipDownload != true)
        {
            throw new ForbiddenException("photo.zip_not_in_package", "Downloading all photos isn't part of this event's package.");
        }
        return FileName(ev.Name) + ".zip";
    }

    public async Task WriteZipAsync(Guid eventId, Guid? invitationId, Stream output, CancellationToken ct)
    {
        var rows = await (
                from p in db.Photos.AsNoTracking()
                join i in db.Invitations.AsNoTracking() on p.InvitationId equals i.Id
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where p.EventId == eventId && (invitationId == null || p.InvitationId == invitationId)
                orderby g.Name, p.CreatedAt
                select new { p.ObjectKey, g.Name })
            .ToListAsync(ct);

        await using var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true);
        foreach (var guest in rows.GroupBy(r => r.Name))
        {
            var n = 0;
            foreach (var row in guest)
            {
                // Photos are JPEG already: store them without compressing again.
                var entry = zip.CreateEntry($"{FileName(guest.Key)}/{++n:000}.jpg", CompressionLevel.NoCompression);
                await using var target = await entry.OpenAsync(ct);
                await using var source = await storage.OpenReadAsync(row.ObjectKey, ct);
                await source.CopyToAsync(target, ct);
            }
        }
    }

    /// <summary>The guest's gallery: only after check-in (403 <c>gallery.locked</c>), only this invitation's photos.</summary>
    public async Task<PublicGalleryDto> GuestGalleryAsync(string code, CancellationToken ct)
    {
        var context = await publicInvitations.ResolveAsync(code, ct);
        await RequireCheckedInAsync(context.Invitation.Id, ct);

        var photos = await db.Photos.AsNoTracking()
            .Where(p => p.InvitationId == context.Invitation.Id)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);
        return new PublicGalleryDto(
            [.. photos.Select(p => new PublicPhotoDto(p.Id, storage.GetReadUrl(p.ThumbnailKey, UrlLifetime),
                storage.GetReadUrl(p.ObjectKey, UrlLifetime), p.Source == PhotoSource.Guest, p.CreatedAt))],
            await CameraAsync(context, ct));
    }

    /// <summary>The guest's in-app camera (Q-25/Q-26): one photo per request, within the guest limit and the time window.</summary>
    public async Task<PublicPhotoDto> CaptureAsync(string code, byte[] file, CancellationToken ct)
    {
        var context = await publicInvitations.ResolveAsync(code, ct);
        await RequireCheckedInAsync(context.Invitation.Id, ct);
        var camera = await CameraAsync(context, ct);
        if (!camera.Available)
        {
            throw new ConflictException("photo.camera_closed",
                "The camera isn't available: it is off for this event, the time is over, or your photos are used up.");
        }

        var image = ImageProcessor.Process(file) ?? throw InvalidImage();
        var photo = (await StoreAsync(context.Event, context.Invitation, PhotoSource.Guest, null, [image],
            guestLimit: camera.Limit, ct)).Single();
        return new PublicPhotoDto(photo.Id, storage.GetReadUrl(photo.ThumbnailKey, UrlLifetime),
            storage.GetReadUrl(photo.ObjectKey, UrlLifetime), true, photo.CreatedAt);
    }

    /// <summary>A guest deletes a photo they took; photos taken by Staff stay.</summary>
    public async Task DeleteOwnAsync(string code, Guid photoId, CancellationToken ct)
    {
        var context = await publicInvitations.ResolveAsync(code, ct);
        var photo = await db.Photos.SingleOrDefaultAsync(p => p.Id == photoId
            && p.InvitationId == context.Invitation.Id && p.Source == PhotoSource.Guest, ct) ?? throw PhotoNotFound();
        db.Photos.Remove(photo);
        audit.Add(AuditActions.PhotoDeleted, null, photo.OrganizationId, nameof(Photo), photo.Id,
            new { photo.InvitationId, by = "guest" });
        await db.SaveChangesAsync(ct);
        await storage.DeleteAsync([photo.ObjectKey, photo.ThumbnailKey], ct);
    }

    public async Task<string> GuestDownloadUrlAsync(string code, Guid photoId, CancellationToken ct)
    {
        var context = await publicInvitations.ResolveAsync(code, ct);
        await RequireCheckedInAsync(context.Invitation.Id, ct);
        var photo = await db.Photos.AsNoTracking()
            .SingleOrDefaultAsync(p => p.Id == photoId && p.InvitationId == context.Invitation.Id, ct) ?? throw PhotoNotFound();
        return storage.GetReadUrl(photo.ObjectKey, UrlLifetime, $"{FileName(context.Event.Name)}-{photo.Id:N}.jpg");
    }

    private async Task<GuestCameraDto> CameraAsync(PublicInvitationService.Context context, CancellationToken ct)
    {
        var (invitation, _, ev) = context;
        var features = context.Features;
        var limit = features.GuestUploadEnabled ? features.MaxGuestPhotosPerInvitation : 0;
        var taken = await db.Photos.CountAsync(p => p.InvitationId == invitation.Id && p.Source == PhotoSource.Guest, ct);
        var closesAt = CameraClosesAt(ev);
        var eventFull = await db.Photos.CountAsync(p => p.EventId == ev.Id, ct) >= features.MaxPhotos;
        var available = ev.Status == EventStatus.Active && ev.GuestUploadEnabled && limit > 0 && taken < limit
            && !eventFull && timeProvider.GetUtcNow() < closesAt;
        return new GuestCameraDto(available, taken, limit, limit > 0 ? closesAt : null);
    }

    /// <summary>Q-26: midnight after the check-in session's date, in the event's time zone.</summary>
    public static DateTimeOffset CameraClosesAt(Event ev)
    {
        var timeZone = EventTimeZones.Find(ev.TimeZone);
        var localDay = TimeZoneInfo.ConvertTime(ev.CheckInSession.StartsAt, timeZone).Date;
        var midnight = DateTime.SpecifyKind(localDay.AddDays(1), DateTimeKind.Unspecified);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(midnight, timeZone), TimeSpan.Zero);
    }

    /// <summary>
    /// Stores the files, then records them under a row lock on the event so two uploads can't both take the
    /// last places. Over the limit, the stored files are removed again (422 <c>photo.quota_exceeded</c>).
    /// </summary>
    private async Task<IReadOnlyList<Photo>> StoreAsync(Event ev, Invitation invitation, PhotoSource source, Guid? uploadedBy,
        IReadOnlyList<ProcessedImage> images, int? guestLimit, CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow();
        var photos = images.Select(image =>
        {
            var id = Guid.CreateVersion7();
            return (Image: image, Photo: new Photo
            {
                Id = id,
                EventId = ev.Id,
                InvitationId = invitation.Id,
                UploadedBy = uploadedBy,
                Source = source,
                ObjectKey = StorageKeys.Photo(ev.OrganizationId, ev.Id, invitation.Id, id),
                ThumbnailKey = StorageKeys.Thumbnail(ev.OrganizationId, ev.Id, invitation.Id, id),
                SizeBytes = image.Jpeg.Length + image.Thumbnail.Length,
                Width = image.Width,
                Height = image.Height,
                CreatedAt = now,
            });
        }).ToList();

        foreach (var (image, photo) in photos)
        {
            await storage.PutAsync(photo.ObjectKey, image.Jpeg, "image/jpeg", ct);
            await storage.PutAsync(photo.ThumbnailKey, image.Thumbnail, "image/jpeg", ct);
        }

        try
        {
            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync(ct);
                await db.Database.ExecuteSqlAsync($"SELECT 1 FROM events WHERE id = {ev.Id} FOR UPDATE", ct);

                var max = ev.PackageSnapshot?.Features.MaxPhotos ?? 0;
                if (await db.Photos.CountAsync(p => p.EventId == ev.Id, ct) + photos.Count > max)
                {
                    throw new QuotaExceededException("photo.quota_exceeded", $"This event's package allows {max} photos.");
                }
                if (guestLimit is { } limit && await db.Photos.CountAsync(
                        p => p.InvitationId == invitation.Id && p.Source == PhotoSource.Guest, ct) + photos.Count > limit)
                {
                    throw new QuotaExceededException("photo.guest_limit_exceeded", $"Each invitation can take {limit} photos.");
                }

                foreach (var (_, photo) in photos)
                {
                    db.Photos.Add(photo);
                    audit.Add(AuditActions.PhotoUploaded, uploadedBy, ev.OrganizationId, nameof(Photo), photo.Id,
                        new { invitationId = invitation.Id, source = source.ToString(), photo.SizeBytes });
                }
                await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            });
        }
        catch
        {
            await storage.DeleteAsync([.. photos.SelectMany(p => new[] { p.Photo.ObjectKey, p.Photo.ThumbnailKey })], CancellationToken.None);
            throw;
        }
        return [.. photos.Select(p => p.Photo)];
    }

    /// <summary>Owner/Admin see every event of the organization; Staff only assigned ones (others are null → 404).</summary>
    private async Task<Event?> VisibleEventAsync(Guid eventId, CancellationToken ct)
    {
        var events = db.Events.AsNoTracking().Include(e => e.Sessions).AsQueryable();
        if (currentUser.Role == UserRole.Staff)
        {
            var userId = currentUser.RequireUserId();
            events = events.Where(e => e.StaffAssignments.Any(a => a.UserId == userId));
        }
        return await events.SingleOrDefaultAsync(e => e.Id == eventId, ct);
    }

    private async Task RequireCheckedInAsync(Guid invitationId, CancellationToken ct)
    {
        if (!await db.CheckIns.AnyAsync(c => c.InvitationId == invitationId, ct))
        {
            throw new ForbiddenException("gallery.locked", "The gallery opens after check-in.");
        }
    }

    private async Task<string> GuestNameAsync(Guid guestId, CancellationToken ct) =>
        await db.Guests.AsNoTracking().Where(g => g.Id == guestId).Select(g => g.Name).SingleAsync(ct);

    private PhotoDto ToDto(Photo p, string guestName) => new(
        p.Id, p.InvitationId, guestName, p.Source,
        storage.GetReadUrl(p.ThumbnailKey, UrlLifetime), storage.GetReadUrl(p.ObjectKey, UrlLifetime),
        p.Width, p.Height, p.CreatedAt);

    /// <summary>A safe file or folder name: letters, digits, spaces, dashes.</summary>
    private static string FileName(string text)
    {
        var cleaned = new string([.. text.Select(c => char.IsLetterOrDigit(c) || c is ' ' or '-' or '_' ? c : '-')]).Trim();
        return cleaned.Length == 0 ? "evently" : cleaned[..Math.Min(cleaned.Length, 80)];
    }

    private static NotFoundException InvitationNotFound() => new("invitation.not_found", "Invitation not found.");

    private static NotFoundException EventNotFound() => new("event.not_found", "Event not found.");

    private static NotFoundException PhotoNotFound() => new("photo.not_found", "Photo not found.");

    private static AppException InvalidImage() => new(StatusCodes.Status400BadRequest, "photo.invalid_image",
        "Only JPEG, PNG or WebP photos up to 15 MB can be uploaded.");
}
