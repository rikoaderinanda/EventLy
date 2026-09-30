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
        // Request logging wraps the exception handler so it records the final status (409, 404, ...)
        // instead of a 500 for every business exception. Real 500s are logged by AppExceptionHandler.
        app.UseSerilogRequestLogging();
        app.UseExceptionHandler();

        // The built PWA is served from wwwroot by this same service (one Cloud Run service, one domain).
        app.UseDefaultFiles();
        app.UseStaticFiles();

        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();

        if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("ApiDocs:Enabled"))
        {
            app.MapOpenApi("/openapi/{documentName}.json").AllowAnonymous();
            app.MapScalarApiReference("/docs", o => o.WithOpenApiRoutePattern("/openapi/{documentName}.json"))
                .AllowAnonymous();
        }

        app.MapControllers();

        // Endpoints below are public on purpose; everything else requires sign-in (fallback policy).
        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains(ServiceSetup.ReadyTag),
        }).AllowAnonymous();

        // Unknown API routes get a JSON 404 instead of the PWA's index.html.
        app.Map("/api/{**path}", (HttpContext http) => Results.Problem(new ProblemDetails
        {
            Status = StatusCodes.Status404NotFound,
            Type = AppExceptionHandler.ErrorsTypeBase + "route.not_found",
            Title = "Endpoint not found.",
            Detail = $"No API endpoint matches '{http.Request.Path}'.",
            Extensions = { ["code"] = "route.not_found" },
        })).AllowAnonymous();

        // Client-side routes (/app/..., /i/{code}, ...) resolve to the PWA.
        app.MapFallbackToFile("index.html").AllowAnonymous();

        return app;
    }
}
