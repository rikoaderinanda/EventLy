using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Photos;
using EventLy.Api.Entities;
using EventLy.Api.Storage;
using Microsoft.EntityFrameworkCore;

namespace EventLy.Api.Services;

/// <summary>
/// The invitation page's own media: cover photo, QRIS image for the digital gift (Q-41) and background
/// music (Q-43). One file of each kind per event; replacing one removes the old object.
/// </summary>
public sealed class EventMediaService(AppDbContext db, ICurrentUser currentUser, AuditService audit, IFileStorage storage)
{
    public enum Kind
    {
        Cover,
        Qris,
        Music,
    }

    public async Task<EventMediaDto> GetAsync(Guid eventId, CancellationToken ct) =>
        ToDto(await db.Events.AsNoTracking().SingleOrDefaultAsync(e => e.Id == eventId, ct) ?? throw EventNotFound());

    /// <summary>Images are re-encoded like photos (no metadata); music is checked by its magic bytes (MP3/M4A, 10 MB).</summary>
    public async Task<EventMediaDto> SetAsync(Guid eventId, Kind kind, byte[] file, CancellationToken ct)
    {
        var ev = await EditableEventAsync(eventId, ct);
        string key;
        if (kind == Kind.Music)
        {
            var (contentType, extension) = AudioCheck.Detect(file) ?? throw new AppException(StatusCodes.Status400BadRequest,
                "media.invalid_audio", "Upload an MP3 or M4A file of at most 10 MB.");
            key = StorageKeys.EventMedia(ev.OrganizationId, ev.Id, "music", extension);
            await storage.PutAsync(key, file, contentType, ct);
            ev.MusicContentType = contentType;
        }
        else
        {
            var image = ImageProcessor.Process(file) ?? throw new AppException(StatusCodes.Status400BadRequest,
                "photo.invalid_image", "Only JPEG, PNG or WebP images up to 15 MB can be uploaded.");
            key = StorageKeys.EventMedia(ev.OrganizationId, ev.Id, kind == Kind.Cover ? "cover" : "qris", "jpg");
            await storage.PutAsync(key, image.Jpeg, "image/jpeg", ct);
        }

        var previous = Replace(ev, kind, key);
        audit.Add(AuditActions.EventMediaUpdated, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id,
            new { media = kind.ToString(), action = "set" });
        await db.SaveChangesAsync(ct);
        if (previous is not null)
        {
            await storage.DeleteAsync([previous], ct);
        }
        return ToDto(ev);
    }

    public async Task<EventMediaDto> RemoveAsync(Guid eventId, Kind kind, CancellationToken ct)
    {
        var ev = await EditableEventAsync(eventId, ct);
        var previous = Replace(ev, kind, null);
        if (kind == Kind.Music)
        {
            ev.MusicContentType = null;
        }
        audit.Add(AuditActions.EventMediaUpdated, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id,
            new { media = kind.ToString(), action = "remove" });
        await db.SaveChangesAsync(ct);
        if (previous is not null)
        {
            await storage.DeleteAsync([previous], ct);
        }
        return ToDto(ev);
    }

    private static string? Replace(Event ev, Kind kind, string? key)
    {
        string? previous;
        switch (kind)
        {
            case Kind.Cover:
                previous = ev.CoverImageKey;
                ev.CoverImageKey = key;
                break;
            case Kind.Qris:
                previous = ev.GiftQrisKey;
                ev.GiftQrisKey = key;
                break;
            default:
                previous = ev.MusicKey;
                ev.MusicKey = key;
                break;
        }
        return previous;
    }

    private async Task<Event> EditableEventAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await db.Events.SingleOrDefaultAsync(e => e.Id == eventId, ct) ?? throw EventNotFound();
        if (!EventLifecycle.IsEditable(ev.Status))
        {
            throw new ConflictException("event.not_editable", "A completed or cancelled event can't be changed.");
        }
        return ev;
    }

    private EventMediaDto ToDto(Event ev) => new(Url(ev.CoverImageKey), Url(ev.GiftQrisKey), Url(ev.MusicKey));

    private string? Url(string? key) => key is null ? null : storage.GetReadUrl(key, PhotoService.UrlLifetime);

    private static NotFoundException EventNotFound() => new("event.not_found", "Event not found.");
}
