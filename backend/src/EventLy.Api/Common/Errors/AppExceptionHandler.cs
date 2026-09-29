using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Common.Errors;

/// <summary>
/// Maps <see cref="AppException"/> to its status code and error code. Any other exception
/// becomes a 500 without internal details; it is logged with the trace id.
/// </summary>
public sealed class AppExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<AppExceptionHandler> logger) : IExceptionHandler
{
    public const string ErrorsTypeBase = "https://evently.app/errors/";

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var problem = ToProblemDetails(exception);
        if (problem.Status >= StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Unhandled exception for {Method} {Path}",
                httpContext.Request.Method, httpContext.Request.Path);
        }

        httpContext.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception,
        });
    }

    public static ProblemDetails ToProblemDetails(Exception exception)
    {
        if (exception is AppException app)
        {
            return new ProblemDetails
            {
                Status = app.StatusCode,
                Type = ErrorsTypeBase + app.Code,
                Title = app.Title,
                Detail = app.Detail,
                Extensions = { ["code"] = app.Code },
            };
        }

        return new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Type = ErrorsTypeBase + "server.unexpected",
            Title = "An unexpected error occurred.",
            Extensions = { ["code"] = "server.unexpected" },
        };
    }
}
