using System.Text.Json.Serialization;
using EventLy.Api.Common.Errors;
using EventLy.Api.Common.Options;
using EventLy.Api.Data;
using Microsoft.AspNetCore.HttpOverrides;

namespace EventLy.Api.Common.Setup;

public static class ServiceSetup
{
    public const string ReadyTag = "ready";

    public static IServiceCollection AddApiCore(this IServiceCollection services)
    {
        services
            .AddControllers()
            .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        services.AddProblemDetails();
        services.AddExceptionHandler<AppExceptionHandler>();
        services.AddOpenApi("v1");
        services.AddSingleton(TimeProvider.System);

        // Cloud Run (and the local reverse proxy) terminate TLS and forward the original scheme/client IP.
        services.Configure<ForwardedHeadersOptions>(o =>
        {
            o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            o.KnownIPNetworks.Clear();
            o.KnownProxies.Clear();
        });

        return services;
    }

    public static IServiceCollection AddCaching(this IServiceCollection services, IConfiguration configuration)
    {
        var options = configuration.GetSection(CacheOptions.SectionName).Get<CacheOptions>() ?? new CacheOptions();

        if (options.Provider == CacheProvider.Redis)
        {
            var connection = RequireRedisConnection(options);
            services.AddStackExchangeRedisCache(o =>
            {
                o.Configuration = connection;
                o.InstanceName = "evently:";
            });
        }
        else
        {
            services.AddDistributedMemoryCache();
        }

        return services;
    }

    public static IServiceCollection AddHealth(this IServiceCollection services, IConfiguration configuration)
    {
        var checks = services.AddHealthChecks()
            .AddDbContextCheck<AppDbContext>("database", tags: [ReadyTag]);

        var cache = configuration.GetSection(CacheOptions.SectionName).Get<CacheOptions>() ?? new CacheOptions();
        if (cache.Provider == CacheProvider.Redis)
        {
            checks.AddRedis(RequireRedisConnection(cache), "redis", tags: [ReadyTag]);
        }

        return services;
    }

    private static string RequireRedisConnection(CacheOptions options) =>
        string.IsNullOrWhiteSpace(options.RedisConnection)
            ? throw new InvalidOperationException("Cache:Provider is Redis but Cache:RedisConnection is empty.")
            : options.RedisConnection;
}
