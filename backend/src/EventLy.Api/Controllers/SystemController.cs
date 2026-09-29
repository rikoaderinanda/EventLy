using System.Reflection;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

[ApiController]
[Route("api/v1/system")]
public sealed class SystemController(IWebHostEnvironment environment, TimeProvider timeProvider) : ControllerBase
{
    private static readonly string Version =
        typeof(SystemController).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
        ?? "unknown";

    /// <summary>Basic service information, used by the PWA to show API status.</summary>
    [HttpGet("info")]
    [ProducesResponseType<SystemInfoResponse>(StatusCodes.Status200OK)]
    public ActionResult<SystemInfoResponse> GetInfo() =>
        new SystemInfoResponse("EventLy", Version, environment.EnvironmentName, timeProvider.GetUtcNow());
}

public sealed record SystemInfoResponse(string Name, string Version, string Environment, DateTimeOffset ServerTime);
