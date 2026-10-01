namespace EventLy.Api.Entities;

/// <summary>Who took the photo. Guests have no account, so for them <see cref="Photo.UploadedBy"/> is null.</summary>
public enum PhotoSource
{
    Staff,
    Owner,

    /// <summary>The guest's in-app camera (spec change 2026-09-29, Q-25).</summary>
    Guest,
}

/// <summary>
/// A photo of an invitation's guests. Only object keys are stored; the files are private and read through
/// short-lived signed URLs. Deleting a photo removes the row and both objects (no soft delete).
/// </summary>
public sealed class Photo : ITenantOwned
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public Guid OrganizationId { get; set; }

    public Guid EventId { get; init; }

    public Guid InvitationId { get; init; }

    /// <summary>The Staff member or Owner; null for a guest's own capture.</summary>
    public Guid? UploadedBy { get; init; }

    public PhotoSource Source { get; init; }

    public required string ObjectKey { get; init; }

    public required string ThumbnailKey { get; init; }

    public string ContentType { get; init; } = "image/jpeg";

    /// <summary>Bytes of the stored photo and thumbnail together, for the storage statistics.</summary>
    public long SizeBytes { get; init; }

    public int Width { get; init; }

    public int Height { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
