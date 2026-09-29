using System.Globalization;
using System.Text;
using System.Threading.RateLimiting;
using EventLy.Api.Common.Errors;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace EventLy.Api.Auth;

public static class AuthSetup
{
    /// <summary>Rate-limit policy for sign-in, refresh and logout.</summary>
    public const string AuthRateLimitPolicy = "auth";

    public static IServiceCollection AddAuth(
        this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var section = configuration.GetSection(AuthOptions.SectionName);
        var options = section.Get<AuthOptions>() ?? new AuthOptions();
        Validate(options, environment);

        services.Configure<AuthOptions>(section);
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();
        services.AddSingleton<TokenService>();
        services.AddSingleton<IGoogleTokenValidator, GoogleTokenValidator>();

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = options.Jwt.Issuer,
                    ValidAudience = options.Jwt.Audience,
                    IssuerSigningKey = TokenService.SigningKey(options.Jwt),
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                    NameClaimType = AuthClaims.UserId,
                    RoleClaimType = AuthClaims.Role,
                    ClockSkew = TimeSpan.FromSeconds(30),
                };
                o.Events = new JwtBearerEvents
                {
                    // 401/403 as ProblemDetails with a stable code, like every other API error.
                    OnChallenge = async ctx =>
                    {
                        ctx.HandleResponse();
                        await WriteProblemAsync(ctx.HttpContext, StatusCodes.Status401Unauthorized,
                            "auth.unauthenticated", "Sign-in required.");
                    },
                    OnForbidden = ctx => WriteProblemAsync(ctx.HttpContext, StatusCodes.Status403Forbidden,
                        "auth.forbidden", "You don't have permission for this action."),
                };
            });

        var authorization = services.AddAuthorizationBuilder()
            // Secure by default: every endpoint needs a signed-in user unless it says [AllowAnonymous].
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
        foreach (var (permission, roles) in Permissions.Matrix)
        {
            authorization.AddPolicy(permission, p => p.RequireAuthenticatedUser()
                .RequireRole(roles.Select(r => r.ToString())));
        }

        services.AddRateLimiter(o =>
        {
            var permitPerMinute = configuration.GetValue("RateLimiting:AuthPermitPerMinute", 10);
            o.AddPolicy(AuthRateLimitPolicy, http => RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = permitPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));
            o.OnRejected = async (ctx, ct) =>
            {
                if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    ctx.HttpContext.Response.Headers.RetryAfter =
                        ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                }
                await WriteProblemAsync(ctx.HttpContext, StatusCodes.Status429TooManyRequests,
                    "rate_limit.exceeded", "Too many requests. Please wait a moment and try again.");
            };
        });

        return services;
    }

    /// <summary>Fails at startup instead of at the first sign-in when the configuration is unsafe or incomplete.</summary>
    public static void Validate(AuthOptions options, IHostEnvironment environment)
    {
        var isDevOrTest = environment.IsDevelopment() || environment.IsEnvironment("Testing");

        if (Encoding.UTF8.GetByteCount(options.Jwt.SigningKey) < 32)
        {
            throw new InvalidOperationException("Auth:Jwt:SigningKey must be at least 32 bytes.");
        }

        if (!isDevOrTest)
        {
            if (options.Jwt.SigningKey.Contains(AuthOptions.DevelopmentKeyMarker, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    "The Development JWT signing key must not be used outside Development. Set Auth__Jwt__SigningKey.");
            }

            if (string.IsNullOrWhiteSpace(options.GoogleClientId))
            {
                throw new InvalidOperationException("Auth:GoogleClientId is required outside Development.");
            }
        }
    }

    /// <summary>Test sign-in is available only in Development/Testing, and only when switched on.</summary>
    public static bool DevSignInAllowed(AuthOptions options, IHostEnvironment environment) =>
        options.DevSignInEnabled && (environment.IsDevelopment() || environment.IsEnvironment("Testing"));

    private static async Task WriteProblemAsync(HttpContext http, int status, string code, string title)
    {
        http.Response.StatusCode = status;
        var problems = http.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problems.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Type = AppExceptionHandler.ErrorsTypeBase + code,
                Title = title,
                Extensions = { ["code"] = code },
            },
        });
    }
}
