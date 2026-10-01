namespace EventLy.Api.Storage;

/// <summary>
/// Private object storage for photos and event media. An abstraction on purpose: the provider is swappable
/// (MinIO locally, Cloudflare R2 in production, both S3-compatible), and tests use an in-memory store.
/// Objects are never public; readers get short-lived signed URLs.
/// </summary>
public interface IFileStorage
{
    Task PutAsync(string key, byte[] content, string contentType, CancellationToken ct);

    Task<Stream> OpenReadAsync(string key, CancellationToken ct);

    /// <summary>Best effort: keys that don't exist are fine.</summary>
    Task DeleteAsync(IReadOnlyCollection<string> keys, CancellationToken ct);

    /// <summary>
    /// A signed GET URL that works for <paramref name="lifetime"/>. With <paramref name="downloadFileName"/>
    /// the browser saves the file instead of showing it.
    /// </summary>
    string GetReadUrl(string key, TimeSpan lifetime, string? downloadFileName = null);

    /// <summary>Creates the bucket when it is missing (local MinIO). Run by the <c>migrate</c> command.</summary>
    Task EnsureReadyAsync(CancellationToken ct);
}

/// <summary>Where objects live: org/{org}/event/{event}/…, so one organization's data stays under one prefix.</summary>
public static class StorageKeys
{
    public static string Photo(Guid organizationId, Guid eventId, Guid invitationId, Guid photoId) =>
        $"org/{organizationId}/event/{eventId}/inv/{invitationId}/{photoId}.jpg";

    public static string Thumbnail(Guid organizationId, Guid eventId, Guid invitationId, Guid photoId) =>
        $"org/{organizationId}/event/{eventId}/inv/{invitationId}/{photoId}_thumb.jpg";

    public static string EventMedia(Guid organizationId, Guid eventId, string kind, string extension) =>
        $"org/{organizationId}/event/{eventId}/{kind}/{Guid.CreateVersion7()}.{extension}";
}
