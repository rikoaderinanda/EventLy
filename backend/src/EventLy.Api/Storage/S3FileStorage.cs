using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;

namespace EventLy.Api.Storage;

/// <summary>Settings under <c>Storage</c>. Secrets (the keys) come from environment variables / Secret Manager.</summary>
public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    /// <summary>S3 API endpoint the server talks to, for example <c>http://minio:9000</c> or the R2 endpoint.</summary>
    public string ServiceUrl { get; init; } = "";

    /// <summary>
    /// Endpoint put into signed URLs for browsers. Locally the server reaches <c>minio:9000</c> inside
    /// Docker while the browser needs <c>localhost:9000</c>; in production both are the R2 endpoint.
    /// Empty uses <see cref="ServiceUrl"/>.
    /// </summary>
    public string PublicUrl { get; init; } = "";

    public string Bucket { get; init; } = "evently";

    public string Region { get; init; } = "us-east-1";

    public string AccessKey { get; init; } = "";

    public string SecretKey { get; init; } = "";
}

/// <summary>S3-compatible storage: MinIO locally, Cloudflare R2 in production (decision Q-23).</summary>
public sealed class S3FileStorage : IFileStorage, IDisposable
{
    private readonly StorageOptions _options;
    private readonly AmazonS3Client _client;
    private readonly AmazonS3Client _signer;
    private readonly ILogger<S3FileStorage> _logger;

    public S3FileStorage(IOptions<StorageOptions> options, ILogger<S3FileStorage> logger)
    {
        _options = options.Value;
        _logger = logger;
        var credentials = new BasicAWSCredentials(_options.AccessKey, _options.SecretKey);
        _client = new AmazonS3Client(credentials, Config(_options.ServiceUrl));
        _signer = new AmazonS3Client(credentials,
            Config(string.IsNullOrWhiteSpace(_options.PublicUrl) ? _options.ServiceUrl : _options.PublicUrl));
    }

    private AmazonS3Config Config(string serviceUrl) => new()
    {
        ServiceURL = serviceUrl,
        AuthenticationRegion = _options.Region,
        ForcePathStyle = true,
        // R2 and MinIO don't need the newer default checksum trailers; only send them when an API requires it.
        RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
        ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
    };

    public async Task PutAsync(string key, byte[] content, string contentType, CancellationToken ct)
    {
        using var stream = new MemoryStream(content, writable: false);
        await _client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _options.Bucket,
            Key = key,
            InputStream = stream,
            ContentType = contentType,
        }, ct);
    }

    public async Task<Stream> OpenReadAsync(string key, CancellationToken ct)
    {
        var response = await _client.GetObjectAsync(_options.Bucket, key, ct);
        return response.ResponseStream;
    }

    public async Task DeleteAsync(IReadOnlyCollection<string> keys, CancellationToken ct)
    {
        if (keys.Count == 0)
        {
            return;
        }
        try
        {
            await _client.DeleteObjectsAsync(new DeleteObjectsRequest
            {
                BucketName = _options.Bucket,
                Objects = [.. keys.Select(k => new KeyVersion { Key = k })],
                Quiet = true,
            }, ct);
        }
        catch (AmazonS3Exception ex)
        {
            // The rows are gone already; an orphaned object costs a little storage, nothing more.
            _logger.LogWarning(ex, "Couldn't delete {Count} object(s) from storage", keys.Count);
        }
    }

    public string GetReadUrl(string key, TimeSpan lifetime, string? downloadFileName = null)
    {
        var url = new Uri(string.IsNullOrWhiteSpace(_options.PublicUrl) ? _options.ServiceUrl : _options.PublicUrl);
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _options.Bucket,
            Key = key,
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.Add(lifetime),
            Protocol = url.Scheme == Uri.UriSchemeHttps ? Protocol.HTTPS : Protocol.HTTP,
        };
        if (downloadFileName is not null)
        {
            request.ResponseHeaderOverrides.ContentDisposition =
                $"attachment; filename=\"{downloadFileName}\"; filename*=UTF-8''{Uri.EscapeDataString(downloadFileName)}";
        }
        return _signer.GetPreSignedURL(request);
    }

    public async Task EnsureReadyAsync(CancellationToken ct)
    {
        try
        {
            if (!await Amazon.S3.Util.AmazonS3Util.DoesS3BucketExistV2Async(_client, _options.Bucket))
            {
                await _client.PutBucketAsync(_options.Bucket, ct);
                _logger.LogInformation("Created storage bucket {Bucket}", _options.Bucket);
            }
        }
        catch (AmazonS3Exception ex)
        {
            // Production buckets are created ahead of time, and the token may not be allowed to look.
            _logger.LogWarning(ex, "Couldn't check or create the storage bucket {Bucket}", _options.Bucket);
        }
    }

    public void Dispose()
    {
        _client.Dispose();
        _signer.Dispose();
    }
}

public static class StorageSetup
{
    public static IServiceCollection AddStorage(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
        services.AddSingleton<IFileStorage, S3FileStorage>();
        return services;
    }
}
