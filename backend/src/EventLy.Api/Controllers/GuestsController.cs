using EventLy.Api.Auth;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Entities;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>Owner/Admin: the guests of an event. Each guest gets an invitation (link + QR) right away.</summary>
[ApiController]
[Route("api/v1/events/{eventId:guid}/guests")]
[Authorize(Policy = Permissions.GuestManage)]
public sealed class GuestsController(GuestService guests) : ControllerBase
{
    [HttpGet]
    public Task<GuestListDto> List(
        Guid eventId,
        [FromQuery] string? search,
        [FromQuery] GuestType? type,
        [FromQuery] InvitationStatus? status,
        CancellationToken ct) =>
        guests.ListAsync(eventId, new GuestListQuery(search, type, status), ct);

    /// <summary>422 <c>guest.quota_exceeded</c> when the package's guest limit is reached.</summary>
    [HttpPost]
    [ProducesResponseType<GuestDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<GuestDto>> Create(Guid eventId, CreateGuestRequest request, CancellationToken ct)
    {
        var created = await guests.CreateAsync(eventId, request, ct);
        return CreatedAtAction(nameof(Get), new { eventId, guestId = created.Id }, created);
    }

    [HttpGet("{guestId:guid}")]
    public Task<GuestDto> Get(Guid eventId, Guid guestId, CancellationToken ct) => guests.GetAsync(eventId, guestId, ct);

    [HttpPut("{guestId:guid}")]
    public Task<GuestDto> Update(Guid eventId, Guid guestId, UpdateGuestRequest request, CancellationToken ct) =>
        guests.UpdateAsync(eventId, guestId, request, ct);

    [HttpDelete("{guestId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid eventId, Guid guestId, CancellationToken ct)
    {
        await guests.DeleteAsync(eventId, guestId, ct);
        return NoContent();
    }
}
