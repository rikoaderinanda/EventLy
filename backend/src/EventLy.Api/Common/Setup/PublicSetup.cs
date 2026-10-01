using System.Threading.RateLimiting;

namespace EventLy.Api.Common.Setup;

/// <summary>
/// The guest-facing surface: per-IP rate limits for the public invitation API, and
/// <c>Referrer-Policy: no-referrer</c> on guest pages so the invitation code never leaks to other sites.
/// </summary>
public static class PublicSetup
{
    public const string ReadPolicy = "public-invitation";
    public const string WritePolicy = "public-invitation-write";

    /// <summary>Check-in at the venue, per signed-in user (a fast scanner, not a script).</summary>
    public const string CheckInPolicy = "checkin";

    /// <summary>Report and ZIP downloads, per signed-in user: each one reads the whole event.</summary>
    public const string ExportPolicy = "export";

    public static IServiceCollection AddPublicRateLimits(this IServiceCollection services, IConfiguration configuration)
    {
        var reads = configuration.GetValue("RateLimiting:PublicPermitPerMinute", 60);
        var writes = configuration.GetValue("RateLimiting:PublicWritePermitPerMinute", 10);
        var checkIns = configuration.GetValue("RateLimiting:CheckInPermitPerMinute", 120);
        var exports = configuration.GetValue("RateLimiting:ExportPermitPerMinute", 10);
        services.AddRateLimiter(o =>
        {
            o.AddPolicy(ReadPolicy, http => PerIp(http, ReadPolicy, reads));
            o.AddPolicy(WritePolicy, http => PerIp(http, WritePolicy, writes));
            o.AddPolicy(CheckInPolicy, http => RateLimitPartition.GetFixedWindowLimiter(
                $"{CheckInPolicy}:{http.User.FindFirst(Auth.AuthClaims.UserId)?.Value ?? http.Connection.RemoteIpAddress?.ToString()}",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = checkIns, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
            o.AddPolicy(ExportPolicy, http => RateLimitPartition.GetFixedWindowLimiter(
                $"{ExportPolicy}:{http.User.FindFirst(Auth.AuthClaims.UserId)?.Value ?? http.Connection.RemoteIpAddress?.ToString()}",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = exports, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });
        return services;
    }

    /// <summary>Guest pages (<c>/i/{code}</c>) and the public API they call.</summary>
    public static IApplicationBuilder UseGuestReferrerPolicy(this IApplicationBuilder app) =>
        app.Use(async (http, next) =>
        {
            var path = http.Request.Path;
            if (path.StartsWithSegments("/i") || path.StartsWithSegments("/api/v1/public"))
            {
                http.Response.Headers["Referrer-Policy"] = "no-referrer";
            }
            await next(http);
        });

    private static RateLimitPartition<string> PerIp(HttpContext http, string policy, int permitPerMinute) =>
        RateLimitPartition.GetFixedWindowLimiter(
            $"{policy}:{http.Connection.RemoteIpAddress}",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitPerMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            });
}
