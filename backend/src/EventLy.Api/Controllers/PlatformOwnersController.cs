using EventLy.Api.Auth;
using EventLy.Api.Dtos.Platform;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>Root: Owner accounts across the platform.</summary>
[ApiController]
[Route("api/v1/platform/owners")]
[Authorize(Policy = Permissions.PlatformOwnersManage)]
public sealed class PlatformOwnersController(PlatformOwnerService owners) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<PlatformOwnerDto>> List([FromQuery] string? search, CancellationToken ct) =>
        owners.ListAsync(search, ct);

    /// <summary>The Owner with their events and purchase history.</summary>
    [HttpGet("{id:guid}")]
    public Task<PlatformOwnerDetailDto> Get(Guid id, CancellationToken ct) => owners.GetAsync(id, ct);

    [HttpPost("{id:guid}/suspend")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Suspend(Guid id, CancellationToken ct)
    {
        await owners.SuspendAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/reactivate")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reactivate(Guid id, CancellationToken ct)
    {
        await owners.ReactivateAsync(id, ct);
        return NoContent();
    }
}
