using System.Globalization;
using Serilog;
using Serilog.Formatting.Compact;

namespace EventLy.Api.Common.Setup;

public static class LoggingSetup
{
    /// <summary>
    /// Serilog to the console: readable text in Development, JSON everywhere else
    /// (Cloud Run ships stdout to Cloud Logging).
    /// </summary>
    public static WebApplicationBuilder AddSerilogLogging(this WebApplicationBuilder builder)
    {
        var isDevelopment = builder.Environment.IsDevelopment();

        builder.Services.AddSerilog((services, config) =>
        {
            config
                .ReadFrom.Configuration(builder.Configuration)
                .ReadFrom.Services(services)
                .Enrich.FromLogContext();

            if (isDevelopment)
            {
                config.WriteTo.Console(formatProvider: CultureInfo.InvariantCulture);
            }
            else
            {
                config.WriteTo.Console(new RenderedCompactJsonFormatter());
            }
        },
        // The app gets its own logger instead of freezing the static bootstrap logger, which can only be
        // frozen once per process (several hosts start in parallel in the integration tests).
        preserveStaticLogger: true);

        return builder;
    }
}
