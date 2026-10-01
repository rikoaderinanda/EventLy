using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
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
    private const int MaxImportBytes = 5 * 1024 * 1024;
    private const string XlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    [HttpGet]
    public Task<GuestListDto> List(
        Guid eventId,
        [FromQuery] string? search,
        [FromQuery] GuestType? type,
        [FromQuery] InvitationStatus? status,
        [FromQuery] RsvpStatus? rsvp,
        [FromQuery] bool? checkedIn,
        CancellationToken ct) =>
        guests.ListAsync(eventId, new GuestListQuery(search, type, status, rsvp, checkedIn), ct);

    /// <summary>422 <c>guest.quota_exceeded</c> when the package's guest limit is reached.</summary>
    [HttpPost]
    [ProducesResponseType<GuestDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<GuestDto>> Create(Guid eventId, CreateGuestRequest request, CancellationToken ct)
    {
        var created = await guests.CreateAsync(eventId, request, ct);
        return CreatedAtAction(nameof(Get), new { eventId, guestId = created.Id }, created);
    }

    /// <summary>
    /// Excel import (<c>multipart/form-data</c>, field <c>file</c>, .xlsx up to 5 MB / 2,000 guests). All or
    /// nothing: the result lists every problem by row, or the number imported. 422 past the guest limit.
    /// </summary>
    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxImportBytes + 64 * 1024)]
    public async Task<GuestImportResultDto> Import(Guid eventId, IFormFile file, CancellationToken ct)
    {
        if (file.Length is 0 or > MaxImportBytes || !file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            throw new AppException(StatusCodes.Status400BadRequest, "guest.import_invalid_file",
                "Upload an Excel workbook (.xlsx) of at most 5 MB.");
        }

        // The workbook is a zip: read it from memory, where seeking is cheap.
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        buffer.Position = 0;
        return await guests.ImportAsync(eventId, buffer, ct);
    }

    /// <summary>A sample workbook with the expected columns.</summary>
    [HttpGet("import-template")]
    [Produces(XlsxContentType)]
    public FileContentResult ImportTemplate(Guid eventId) =>
        File(GuestSpreadsheet.Template(), XlsxContentType, "template-tamu.xlsx");

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
