using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using EventLy.Api.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Shouldly;

namespace EventLy.IntegrationTests;

/// <summary>
/// The real S3 adapter against SeaweedFS (the local storage in docker compose; R2 speaks the same API):
/// put, read, signed URLs a browser can open, attachment downloads, delete.
/// </summary>
public sealed class S3FileStorageTests : IAsyncLifetime
{
    private IContainer? _container;
    private S3FileStorage _storage = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        try
        {
            _container = new ContainerBuilder("chrislusf/seaweedfs:4.48")
                .WithCommand("server", "-dir=/data", "-s3", "-s3.port=8333", "-volume.max=0", "-master.volumeSizeLimitMB=64")
                .WithEnvironment("AWS_ACCESS_KEY_ID", "test")
                .WithEnvironment("AWS_SECRET_ACCESS_KEY", "test-secret")
                .WithPortBinding(8333, assignRandomHostPort: true)
                .WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(r => r.ForPort(8333).ForPath("/healthz")))
                .Build();
            await _container.StartAsync(Ct);
        }
        catch (Exception) when (Environment.GetEnvironmentVariable("CI") is null)
        {
            _container = null;
            return;
        }

        var url = $"http://{_container.Hostname}:{_container.GetMappedPublicPort(8333)}";
        _storage = new S3FileStorage(Options.Create(new StorageOptions
        {
            ServiceUrl = url,
            Bucket = "evently-test",
            AccessKey = "test",
            SecretKey = "test-secret",
        }), NullLogger<S3FileStorage>.Instance);

        // Volume servers can take a moment after the S3 port answers.
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await _storage.EnsureReadyAsync(Ct);
                await _storage.PutAsync("ready", [1], "application/octet-stream", Ct);
                break;
            }
            catch (Exception) when (attempt < 30)
            {
                await Task.Delay(500, Ct);
            }
        }
    }

    public async ValueTask DisposeAsync()
    {
        _storage?.Dispose();
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    [Fact]
    public async Task Stores_reads_signs_and_deletes_objects()
    {
        if (_container is null)
        {
            Assert.Skip("Docker is not available.");
        }

        var key = $"org/{Guid.NewGuid()}/event/{Guid.NewGuid()}/inv/{Guid.NewGuid()}/photo.jpg";
        var content = "jpeg bytes"u8.ToArray();
        await _storage.PutAsync(key, content, "image/jpeg", Ct);

        await using (var read = await _storage.OpenReadAsync(key, Ct))
        {
            using var copy = new MemoryStream();
            await read.CopyToAsync(copy, Ct);
            copy.ToArray().ShouldBe(content);
        }

        using var browser = new HttpClient();
        var shown = await browser.GetAsync(_storage.GetReadUrl(key, TimeSpan.FromMinutes(10)), Ct);
        shown.EnsureSuccessStatusCode();
        (await shown.Content.ReadAsByteArrayAsync(Ct)).ShouldBe(content);
        shown.Content.Headers.ContentType!.MediaType.ShouldBe("image/jpeg");

        var saved = await browser.GetAsync(_storage.GetReadUrl(key, TimeSpan.FromMinutes(10), "Keluarga Wijaya.jpg"), Ct);
        saved.Content.Headers.ContentDisposition!.DispositionType.ShouldBe("attachment");

        await _storage.DeleteAsync([key, "does/not/exist"], Ct);
        (await browser.GetAsync(_storage.GetReadUrl(key, TimeSpan.FromMinutes(10)), Ct)).IsSuccessStatusCode.ShouldBeFalse();
    }
}
