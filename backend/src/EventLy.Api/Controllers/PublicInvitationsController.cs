using EventLy.Api.Common.Setup;
using EventLy.Api.Dtos.Public;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EventLy.Api.Controllers;

/// <summary>
/// The guest's invitation page. Anonymous on purpose: the 128-bit code in the URL is the credential.
/// Rate-limited per IP; writes have a stricter limit.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/v1/public/invitations/{code}")]
[EnableRateLimiting(PublicSetup.ReadPolicy)]
public sealed class PublicInvitationsController(PublicInvitationService invitations) : ControllerBase
{
    [HttpGet]
    public Task<PublicInvitationDto> Get(string code, CancellationToken ct) => invitations.GetAsync(code, ct);

    /// <summary>409 <c>rsvp.closed</c> once the check-in session has started.</summary>
    [HttpPut("rsvp")]
    [EnableRateLimiting(PublicSetup.WritePolicy)]
    public Task<PublicRsvpDto> SetRsvp(string code, UpdateRsvpRequest request, CancellationToken ct) =>
        invitations.SetRsvpAsync(code, request, ct);

    /// <summary>The QR to show at the entrance.</summary>
    [HttpGet("qr")]
    [Produces("image/png")]
    public async Task<IActionResult> Qr(string code, [FromQuery] int size = 512, CancellationToken ct = default)
    {
        var png = await invitations.GetQrAsync(code, size, ct);
        Response.Headers.CacheControl = "private, no-store";
        return File(png, "image/png");
    }

    [HttpGet("wishes")]
    public Task<PublicWishPageDto> Wishes(string code, [FromQuery] int page = 1, CancellationToken ct = default) =>
        invitations.GetWishesAsync(code, page, ct);

    [HttpPut("wish")]
    [EnableRateLimiting(PublicSetup.WritePolicy)]
    public Task<PublicWishDto> SetWish(string code, UpdateWishRequest request, CancellationToken ct) =>
        invitations.SetWishAsync(code, request, ct);

    [HttpGet("gifts")]
    public Task<PublicGiftsDto> Gifts(string code, CancellationToken ct) => invitations.GetGiftsAsync(code, ct);

    [HttpPost("gift-confirmations")]
    [EnableRateLimiting(PublicSetup.WritePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ConfirmGift(string code, CreateGiftConfirmationRequest request, CancellationToken ct)
    {
        await invitations.ConfirmGiftAsync(code, request, ct);
        return NoContent();
    }
}
