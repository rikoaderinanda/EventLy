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
public sealed class PublicInvitationsController(PublicInvitationService invitations, PhotoService photos) : ControllerBase
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

    /// <summary>The guest's photos: 403 <c>gallery.locked</c> until check-in. Includes the camera state.</summary>
    [HttpGet("gallery")]
    public Task<Dtos.Photos.PublicGalleryDto> Gallery(string code, CancellationToken ct) => photos.GuestGalleryAsync(code, ct);

    /// <summary>302 to a signed URL that downloads the photo.</summary>
    [HttpGet("gallery/{photoId:guid}/download")]
    public async Task<IActionResult> DownloadPhoto(string code, Guid photoId, CancellationToken ct) =>
        Redirect(await photos.GuestDownloadUrlAsync(code, photoId, ct));

    /// <summary>The guest's in-app camera (Q-25): one JPEG per request, <c>multipart/form-data</c> field <c>file</c>.</summary>
    [HttpPost("photos")]
    [EnableRateLimiting(PublicSetup.WritePolicy)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(Storage.ImageProcessor.MaxBytes + 1024 * 1024)]
    [ProducesResponseType<Dtos.Photos.PublicPhotoDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<Dtos.Photos.PublicPhotoDto>> Capture(string code, IFormFile file, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created,
            await photos.CaptureAsync(code, await Uploads.ReadAsync(file, Storage.ImageProcessor.MaxBytes, ct), ct));

    /// <summary>The guest deletes a photo they took.</summary>
    [HttpDelete("photos/{photoId:guid}")]
    [EnableRateLimiting(PublicSetup.WritePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeletePhoto(string code, Guid photoId, CancellationToken ct)
    {
        await photos.DeleteOwnAsync(code, photoId, ct);
        return NoContent();
    }

    /// <summary>302 to a short-lived URL of the event's music (Q-43).</summary>
    [HttpGet("music")]
    public async Task<IActionResult> Music(string code, CancellationToken ct) =>
        Redirect(await invitations.MusicUrlAsync(code, ct));

    [HttpPost("gift-confirmations")]
    [EnableRateLimiting(PublicSetup.WritePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ConfirmGift(string code, CreateGiftConfirmationRequest request, CancellationToken ct)
    {
        await invitations.ConfirmGiftAsync(code, request, ct);
        return NoContent();
    }
}
