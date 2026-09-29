using EventLy.Api.Common.Errors;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Scalar.AspNetCore;
using Serilog;

namespace EventLy.Api.Common.Setup;

public static class PipelineSetup
{
    public static WebApplication UseApiPipeline(this WebApplication app)
    {
        app.UseForwardedHeaders();
        app.UseExceptionHandler();
        app.UseSerilogRequestLogging();

        // The built PWA is served from wwwroot by this same service (one Cloud Run service, one domain).
        app.UseDefaultFiles();
        app.UseStaticFiles();

        if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("ApiDocs:Enabled"))
        {
            app.MapOpenApi("/openapi/{documentName}.json");
            app.MapScalarApiReference("/docs", o => o.WithOpenApiRoutePattern("/openapi/{documentName}.json"));
        }

        app.MapControllers();

        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains(ServiceSetup.ReadyTag),
        });

        // Unknown API routes get a JSON 404 instead of the PWA's index.html.
        app.Map("/api/{**path}", (HttpContext http) => Results.Problem(new ProblemDetails
        {
            Status = StatusCodes.Status404NotFound,
            Type = AppExceptionHandler.ErrorsTypeBase + "route.not_found",
            Title = "Endpoint not found.",
            Detail = $"No API endpoint matches '{http.Request.Path}'.",
            Extensions = { ["code"] = "route.not_found" },
        }));

        // Client-side routes (/app/..., /i/{code}, ...) resolve to the PWA.
        app.MapFallbackToFile("index.html");

        return app;
    }
}
