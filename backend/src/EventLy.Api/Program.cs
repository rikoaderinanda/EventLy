using System.Globalization;
using EventLy.Api.Auth;
using EventLy.Api.Common.Setup;
using EventLy.Api.Data;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(formatProvider: CultureInfo.InvariantCulture)
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.AddSerilogLogging();
    builder.Services
        .AddApiCore()
        .AddPersistence(builder.Configuration)
        .AddCaching(builder.Configuration)
        .AddHealth(builder.Configuration)
        .AddAuth(builder.Configuration, builder.Environment)
        .AddAppServices(builder.Configuration);

    var app = builder.Build();

    // `dotnet EventLy.Api.dll migrate` applies pending migrations and exits.
    // Used by the docker compose "migrate" service and the Cloud Run migration job,
    // so the API itself never migrates on startup.
    if (args.Contains("migrate", StringComparer.OrdinalIgnoreCase))
    {
        await app.MigrateDatabaseAsync();
        return 0;
    }

    app.UseApiPipeline();
    await app.RunAsync();
    return 0;
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "EventLy terminated unexpectedly");
    return 1;
}
finally
{
    await Log.CloseAndFlushAsync();
}

public partial class Program;
