using EventLy.Api.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>
/// Hosts the API in memory. The connection string points at the Testcontainers database,
/// or at an unreachable placeholder for tests that don't touch the database.
/// Time is a <see cref="FakeTimeProvider"/> starting at the real current time, and Google
/// sign-in uses <see cref="FakeGoogleTokenValidator"/>.
/// </summary>
public sealed class ApiFactory(string connectionString, IReadOnlyDictionary<string, string?>? settings = null)
    : WebApplicationFactory<Program>
{
    public const string UnusedDatabase = "Host=127.0.0.1;Port=1;Database=unused;Username=unused;Password=unused";
    public const string RootEmail = "root@evently.test";

    public FakeTimeProvider Time { get; } = new(DateTimeOffset.UtcNow);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Database", connectionString);
        builder.UseSetting("Cache:Provider", "Memory");
        builder.UseSetting("Serilog:MinimumLevel:Default", "Warning");
        builder.UseSetting("Auth:Jwt:SigningKey", "dev-only-integration-test-signing-key-0123456789");
        builder.UseSetting("Auth:GoogleClientId", FakeGoogleTokenValidator.ClientId);
        builder.UseSetting("Auth:RootEmail", RootEmail);
        builder.UseSetting("Auth:DevSignInEnabled", "true");
        builder.UseSetting("RateLimiting:AuthPermitPerMinute", "1000");
        foreach (var (key, value) in settings ?? new Dictionary<string, string?>())
        {
            builder.UseSetting(key, value);
        }

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Time);
            services.RemoveAll<IGoogleTokenValidator>();
            services.AddSingleton<IGoogleTokenValidator, FakeGoogleTokenValidator>();
        });
    }
}
