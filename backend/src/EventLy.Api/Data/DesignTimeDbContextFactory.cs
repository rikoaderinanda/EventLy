using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace EventLy.Api.Data;

/// <summary>
/// Lets <c>dotnet ef migrations add</c> create the context without starting the web host.
/// Generating a migration doesn't connect to the database, so the fallback string is only a placeholder.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Database")
            ?? "Host=localhost;Database=evently;Username=evently;Password=design-time-only";

        var options = new DbContextOptionsBuilder<AppDbContext>();
        PersistenceSetup.Configure(options, connectionString);
        return new AppDbContext(options.Options);
    }
}
