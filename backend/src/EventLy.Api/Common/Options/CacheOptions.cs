namespace EventLy.Api.Common.Options;

public enum CacheProvider
{
    Memory,
    Redis,
}

/// <summary>
/// Redis is optional: the free stage-1 production setup runs a single Cloud Run
/// instance with the in-memory cache, while local docker compose uses Redis.
/// </summary>
public sealed class CacheOptions
{
    public const string SectionName = "Cache";

    public CacheProvider Provider { get; init; } = CacheProvider.Memory;

    public string? RedisConnection { get; init; }
}
