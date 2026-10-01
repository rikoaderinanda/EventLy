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
    private const int MaxImportBytes = 1024 * 1024;

    [HttpGet]
    public Task<GuestListDto> List(
        Guid eventId,
        [FromQuery] string? search,
        [FromQuery] GuestType? type,
        [FromQuery] InvitationStatus? status,
        [FromQuery] RsvpStatus? rsvp,
        CancellationToken ct) =>
        guests.ListAsync(eventId, new GuestListQuery(search, type, status, rsvp), ct);

    /// <summary>422 <c>guest.quota_exceeded</c> when the package's guest limit is reached.</summary>
    [HttpPost]
    [ProducesResponseType<GuestDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<GuestDto>> Create(Guid eventId, CreateGuestRequest request, CancellationToken ct)
    {
        var created = await guests.CreateAsync(eventId, request, ct);
        return CreatedAtAction(nameof(Get), new { eventId, guestId = created.Id }, created);
    }

    /// <summary>
    /// CSV import (<c>multipart/form-data</c>, field <c>file</c>, max 1 MB / 2,000 guests). All or nothing:
    /// the result lists every problem by line, or the number imported. 422 when the guest limit is exceeded.
    /// </summary>
    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxImportBytes + 64 * 1024)]
    public async Task<GuestImportResultDto> Import(Guid eventId, IFormFile file, CancellationToken ct)
    {
        if (file.Length is 0 or > MaxImportBytes)
        {
            throw new AppException(StatusCodes.Status400BadRequest, "guest.import_invalid_file",
                "Upload a CSV file of at most 1 MB.");
        }

        using var reader = new StreamReader(file.OpenReadStream(), System.Text.Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        return await guests.ImportAsync(eventId, await reader.ReadToEndAsync(ct), ct);
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
