using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Dtos.Photos;
using EventLy.Api.Services;
using EventLy.Api.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>Photos: Staff/Owner upload after check-in; Owner/Admin manage the gallery.</summary>
[ApiController]
[Route("api/v1")]
public sealed class PhotosController(PhotoService photos) : ControllerBase
{
    /// <summary><c>multipart/form-data</c> with 1–10 <c>files</c> (JPEG/PNG/WebP, 15 MB each).</summary>
    [HttpPost("invitations/{invitationId:guid}/photos")]
    [Authorize(Policy = Permissions.PhotoUpload)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(PhotoService.MaxFilesPerUpload * ImageProcessor.MaxBytes + 1024 * 1024)]
    [ProducesResponseType<IReadOnlyList<PhotoDto>>(StatusCodes.Status201Created)]
    public async Task<ActionResult<IReadOnlyList<PhotoDto>>> Upload(Guid invitationId, IFormFileCollection files, CancellationToken ct)
    {
        var contents = new List<byte[]>();
        foreach (var file in files)
        {
            contents.Add(await Uploads.ReadAsync(file, ImageProcessor.MaxBytes, ct));
        }
        return StatusCode(StatusCodes.Status201Created, await photos.UploadAsync(invitationId, contents, ct));
    }

    [HttpGet("events/{eventId:guid}/gallery")]
    [Authorize(Policy = Permissions.GalleryManage)]
    public Task<GalleryDto> Gallery(Guid eventId, [FromQuery] Guid? invitationId, CancellationToken ct) =>
        photos.GalleryAsync(eventId, invitationId, ct);

    [HttpDelete("photos/{photoId:guid}")]
    [Authorize(Policy = Permissions.GalleryManage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid photoId, CancellationToken ct)
    {
        await photos.DeleteAsync(photoId, ct);
        return NoContent();
    }

    /// <summary>302 to a signed URL that downloads the original.</summary>
    [HttpGet("photos/{photoId:guid}/download")]
    [Authorize(Policy = Permissions.GalleryManage)]
    public async Task<IActionResult> Download(Guid photoId, CancellationToken ct) =>
        Redirect(await photos.DownloadUrlAsync(photoId, ct));

    /// <summary>The whole gallery (or one invitation) as a ZIP streamed into the response. Needs the package's zipDownload.</summary>
    [HttpGet("events/{eventId:guid}/gallery/zip")]
    [Authorize(Policy = Permissions.GalleryManage)]
    [Produces("application/zip")]
    public async Task Zip(Guid eventId, [FromQuery] Guid? invitationId, CancellationToken ct)
    {
        var fileName = await photos.PrepareZipAsync(eventId, ct);
        // ZipArchive writes each entry's data descriptor synchronously when the entry closes. Allowed for this
        // one response, so the ZIP can still stream straight from storage without being held in memory.
        if (HttpContext.Features.Get<IHttpBodyControlFeature>() is { } body)
        {
            body.AllowSynchronousIO = true;
        }
        Response.ContentType = "application/zip";
        Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";
        await photos.WriteZipAsync(eventId, invitationId, Response.Body, ct);
    }

    /// <summary>Owner/Admin turn the guest camera on or off for this event (Q-25).</summary>
    [HttpPut("events/{eventId:guid}/guest-camera")]
    [Authorize(Policy = Permissions.GalleryManage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> GuestCamera(Guid eventId, GuestCameraSettingRequest request, CancellationToken ct)
    {
        await photos.SetGuestCameraAsync(eventId, request, ct);
        return NoContent();
    }
}

/// <summary>Owner/Admin: the invitation page's cover photo, QRIS image and background music.</summary>
[ApiController]
[Route("api/v1/events/{eventId:guid}/media")]
[Authorize(Policy = Permissions.EventManage)]
public sealed class EventMediaController(EventMediaService media) : ControllerBase
{
    [HttpGet]
    public Task<EventMediaDto> Get(Guid eventId, CancellationToken ct) => media.GetAsync(eventId, ct);

    /// <summary><c>kind</c>: cover, qris or music. <c>multipart/form-data</c> with one <c>file</c>.</summary>
    [HttpPut("{kind}")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(ImageProcessor.MaxBytes + 1024 * 1024)]
    public async Task<EventMediaDto> Set(Guid eventId, EventMediaService.Kind kind, IFormFile file, CancellationToken ct)
    {
        var max = kind == EventMediaService.Kind.Music ? AudioCheck.MaxBytes : ImageProcessor.MaxBytes;
        return await media.SetAsync(eventId, kind, await Uploads.ReadAsync(file, max, ct), ct);
    }

    [HttpDelete("{kind}")]
    public Task<EventMediaDto> Remove(Guid eventId, EventMediaService.Kind kind, CancellationToken ct) =>
        media.RemoveAsync(eventId, kind, ct);
}

public static class Uploads
{
    /// <summary>The uploaded file in memory, refusing empty or too large files before reading them.</summary>
    public static async Task<byte[]> ReadAsync(IFormFile file, int maxBytes, CancellationToken ct)
    {
        if (file.Length is 0 || file.Length > maxBytes)
        {
            throw new AppException(StatusCodes.Status400BadRequest, "upload.too_large",
                $"Each file must be smaller than {maxBytes / (1024 * 1024)} MB.");
        }
        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer, ct);
        return buffer.ToArray();
    }
}
