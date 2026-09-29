using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>
/// Hosts the API in memory. The connection string points at the Testcontainers database,
/// or at an unreachable placeholder for tests that don't touch the database.
/// </summary>
public sealed class ApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    public const string UnusedDatabase = "Host=127.0.0.1;Port=1;Database=unused;Username=unused;Password=unused";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Database", connectionString);
        builder.UseSetting("Cache:Provider", "Memory");
        builder.UseSetting("Serilog:MinimumLevel:Default", "Warning");
    }
}
