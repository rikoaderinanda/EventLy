using System.Collections.Concurrent;
using EventLy.Api.Storage;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>
/// In-memory object storage for API tests. Signed URLs look like real ones and carry the key, so tests can
/// check which object a URL points to; <see cref="S3FileStorageTests"/> covers the real adapter.
/// </summary>
public sealed class FakeFileStorage : IFileStorage
{
    public const string UrlPrefix = "https://storage.test/";

    public ConcurrentDictionary<string, (byte[] Content, string ContentType)> Objects { get; } = new();

    public Task PutAsync(string key, byte[] content, string contentType, CancellationToken ct)
    {
        Objects[key] = (content, contentType);
        return Task.CompletedTask;
    }

    public Task<Stream> OpenReadAsync(string key, CancellationToken ct) =>
        Task.FromResult<Stream>(new MemoryStream(Objects[key].Content, writable: false));

    public Task DeleteAsync(IReadOnlyCollection<string> keys, CancellationToken ct)
    {
        foreach (var key in keys)
        {
            Objects.TryRemove(key, out _);
        }
        return Task.CompletedTask;
    }

    public string GetReadUrl(string key, TimeSpan lifetime, string? downloadFileName = null) =>
        $"{UrlPrefix}{key}?expires={(int)lifetime.TotalSeconds}" +
        (downloadFileName is null ? "" : $"&download={Uri.EscapeDataString(downloadFileName)}");

    public Task EnsureReadyAsync(CancellationToken ct) => Task.CompletedTask;

    /// <summary>The object key a signed URL points to.</summary>
    public static string KeyOf(string url) => new Uri(url).AbsolutePath.TrimStart('/');
}
