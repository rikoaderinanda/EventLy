using EventLy.Api.Auth;
using EventLy.Api.Common.Setup;
using EventLy.Api.Dtos.CheckIns;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EventLy.Api.Controllers;

/// <summary>
/// Check-in at the venue. Owner and Staff check guests in (Staff only at assigned events); Owner and
/// Admin read the log. Rate-limited per user.
/// </summary>
[ApiController]
[Route("api/v1")]
[EnableRateLimiting(PublicSetup.CheckInPolicy)]
public sealed class CheckInsController(CheckInService checkIns) : ControllerBase
{
    /// <summary>Who is this QR? Nothing is saved.</summary>
    [HttpGet("events/{eventId:guid}/check-ins/lookup")]
    [Authorize(Policy = Permissions.CheckInPerform)]
    public Task<CheckInResultDto> Lookup(Guid eventId, [FromQuery] string code, CancellationToken ct) =>
        checkIns.LookupAsync(eventId, code, ct);

    /// <summary>201 for a new check-in; 200 with <c>alreadyCheckedIn</c> when the invitation was checked in before.</summary>
    [HttpPost("events/{eventId:guid}/check-ins")]
    [Authorize(Policy = Permissions.CheckInPerform)]
    [ProducesResponseType<CheckInResultDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<CheckInResultDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CheckInResultDto>> CheckIn(Guid eventId, CheckInRequest request, CancellationToken ct)
    {
        var (result, created) = await checkIns.CheckInAsync(eventId, request, ct);
        return created ? StatusCode(StatusCodes.Status201Created, result) : Ok(result);
    }

    /// <summary>Manual entry: find a guest by name when there is no QR to scan.</summary>
    [HttpGet("events/{eventId:guid}/check-ins/search")]
    [Authorize(Policy = Permissions.CheckInPerform)]
    public Task<IReadOnlyList<CheckInSearchItemDto>> Search(Guid eventId, [FromQuery] string? q, CancellationToken ct) =>
        checkIns.SearchAsync(eventId, q, ct);

    [HttpGet("events/{eventId:guid}/check-ins/summary")]
    [Authorize(Policy = Permissions.EventView)]
    public Task<CheckInSummaryDto> Summary(Guid eventId, CancellationToken ct) => checkIns.GetSummaryAsync(eventId, ct);

    [HttpGet("events/{eventId:guid}/check-ins")]
    [Authorize(Policy = Permissions.RsvpView)]
    public Task<IReadOnlyList<CheckInLogItemDto>> List(Guid eventId, [FromQuery] Guid? staffId, CancellationToken ct) =>
        checkIns.ListAsync(eventId, staffId, ct);

    /// <summary>Staff activity: my check-ins at this event.</summary>
    [HttpGet("staff/me/activity")]
    [Authorize(Policy = Permissions.CheckInPerform)]
    public Task<IReadOnlyList<CheckInLogItemDto>> MyActivity([FromQuery] Guid eventId, CancellationToken ct) =>
        checkIns.MyActivityAsync(eventId, ct);
}
