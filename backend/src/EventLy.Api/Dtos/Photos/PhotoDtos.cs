using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.Photos;

/// <summary>A photo in the organizer gallery. The URLs are signed and work for 10 minutes.</summary>
public sealed record PhotoDto(
    Guid Id,
    Guid InvitationId,
    string GuestName,
    PhotoSource Source,
    string ThumbnailUrl,
    string Url,
    int Width,
    int Height,
    DateTimeOffset CreatedAt);

/// <summary>
/// The organizer gallery with what limits it: <see cref="Limit"/> is the package's maxPhotos for the whole
/// event, <see cref="ZipAllowed"/> its zipDownload flag, and the guest camera switches.
/// </summary>
public sealed record GalleryDto(
    IReadOnlyList<PhotoDto> Photos,
    int Total,
    int? Limit,
    long StorageBytes,
    bool ZipAllowed,
    bool GuestCameraInPackage,
    bool GuestCameraEnabled);

public sealed record GuestCameraSettingRequest(bool Enabled);

/// <summary>A photo in the guest's own gallery. <see cref="IsMine"/>: taken with this invitation's camera, so it can be deleted.</summary>
public sealed record PublicPhotoDto(Guid Id, string ThumbnailUrl, string Url, bool IsMine, DateTimeOffset CreatedAt);

/// <summary>
/// The guest camera (Q-25/Q-26): allowed after check-in, until 23:59 on the check-in session's date in the
/// event time zone, while the package and the event allow it and photos are left.
/// </summary>
public sealed record GuestCameraDto(bool Available, int Taken, int Limit, DateTimeOffset? ClosesAt);

public sealed record PublicGalleryDto(IReadOnlyList<PublicPhotoDto> Photos, GuestCameraDto Camera);

/// <summary>The event's invitation media, as signed URLs for previews (null when not set).</summary>
public sealed record EventMediaDto(string? CoverUrl, string? QrisUrl, string? MusicUrl);
