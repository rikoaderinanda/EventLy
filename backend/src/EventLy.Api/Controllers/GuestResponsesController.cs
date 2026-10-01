using EventLy.Api.Auth;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Entities;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>Owner/Admin: RSVP monitor, wish moderation and digital gift settings of an event.</summary>
[ApiController]
[Route("api/v1/events/{eventId:guid}")]
public sealed class GuestResponsesController(GuestResponseService responses) : ControllerBase
{
    [HttpGet("rsvps")]
    [Authorize(Policy = Permissions.RsvpView)]
    public Task<IReadOnlyList<RsvpListItemDto>> Rsvps(Guid eventId, [FromQuery] RsvpStatus? status, CancellationToken ct) =>
        responses.ListRsvpsAsync(eventId, status, ct);

    [HttpGet("rsvps/summary")]
    [Authorize(Policy = Permissions.RsvpView)]
    public Task<RsvpSummaryDto> RsvpSummary(Guid eventId, CancellationToken ct) => responses.GetSummaryAsync(eventId, ct);

    [HttpGet("wishes")]
    [Authorize(Policy = Permissions.EventManage)]
    public Task<IReadOnlyList<OrganizerWishDto>> Wishes(Guid eventId, CancellationToken ct) =>
        responses.ListWishesAsync(eventId, ct);

    [HttpPost("wishes/{wishId:guid}/hide")]
    [Authorize(Policy = Permissions.EventManage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> HideWish(Guid eventId, Guid wishId, CancellationToken ct)
    {
        await responses.SetWishHiddenAsync(eventId, wishId, hidden: true, ct);
        return NoContent();
    }

    [HttpPost("wishes/{wishId:guid}/unhide")]
    [Authorize(Policy = Permissions.EventManage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> UnhideWish(Guid eventId, Guid wishId, CancellationToken ct)
    {
        await responses.SetWishHiddenAsync(eventId, wishId, hidden: false, ct);
        return NoContent();
    }

    [HttpDelete("wishes/{wishId:guid}")]
    [Authorize(Policy = Permissions.EventManage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteWish(Guid eventId, Guid wishId, CancellationToken ct)
    {
        await responses.DeleteWishAsync(eventId, wishId, ct);
        return NoContent();
    }

    [HttpGet("gifts")]
    [Authorize(Policy = Permissions.EventManage)]
    public Task<EventGiftsDto> Gifts(Guid eventId, CancellationToken ct) => responses.GetGiftsAsync(eventId, ct);

    [HttpPut("gifts")]
    [Authorize(Policy = Permissions.EventManage)]
    public Task<EventGiftsDto> UpdateGifts(Guid eventId, UpdateEventGiftsRequest request, CancellationToken ct) =>
        responses.UpdateGiftsAsync(eventId, request, ct);

    [HttpGet("gift-confirmations")]
    [Authorize(Policy = Permissions.EventManage)]
    public Task<IReadOnlyList<GiftConfirmationDto>> GiftConfirmations(Guid eventId, CancellationToken ct) =>
        responses.ListGiftConfirmationsAsync(eventId, ct);
}
