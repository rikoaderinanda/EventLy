using EventLy.Api.Common.Localization;
using System.Text.Json.Serialization;
using EventLy.Api.Common.Errors;
using EventLy.Api.Common.Validation;
using EventLy.Api.Common.Options;
using EventLy.Api.Data;
using EventLy.Api.Services;
using FluentValidation;
using Microsoft.AspNetCore.HttpOverrides;

namespace EventLy.Api.Common.Setup;

public static class ServiceSetup
{
    public const string ReadyTag = "ready";

    public static IServiceCollection AddApiCore(this IServiceCollection services)
    {
        services
            .AddControllers(o => o.Filters.Add<ValidationFilter>())
            .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        services.AddProblemDetails();
        services.AddExceptionHandler<AppExceptionHandler>();
        services.AddOpenApi("v1");
        services.AddSingleton(TimeProvider.System);
        services.AddValidatorsFromAssemblyContaining<Program>(ServiceLifetime.Singleton);
        Texts.ConfigureValidation();

        // Cloud Run (and the local reverse proxy) terminate TLS and forward the original scheme/client IP.
        services.Configure<ForwardedHeadersOptions>(o =>
        {
            o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            o.KnownIPNetworks.Clear();
            o.KnownProxies.Clear();
        });

        return services;
    }

    /// <summary>Feature services: concrete classes, no interfaces (see docs/architecture §4.1).</summary>
    public static IServiceCollection AddAppServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<LegalOptions>(configuration.GetSection(LegalOptions.SectionName));
        services.Configure<MaintenanceOptions>(configuration.GetSection(MaintenanceOptions.SectionName));
        services.Configure<AppOptions>(configuration.GetSection(AppOptions.SectionName));
        services.AddScoped<AuditService>();
        services.AddScoped<AuthService>();
        services.AddScoped<OrganizationService>();
        services.AddScoped<UserService>();
        services.AddScoped<PlatformOwnerService>();
        services.AddScoped<EventService>();
        services.AddScoped<PackageService>();
        services.AddScoped<PaymentService>();
        services.AddScoped<InvitationLinks>();
        services.AddScoped<GuestService>();
        services.AddScoped<InvitationService>();
        services.AddScoped<PublicInvitationService>();
        services.AddScoped<GuestResponseService>();
        services.AddScoped<CheckInService>();
        services.AddScoped<PhotoService>();
        services.AddScoped<EventMediaService>();
        services.AddPublicRateLimits(configuration);
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
            .AddCheck<DatabaseHealthCheck>("database", tags: [ReadyTag]);

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
