using EventLy.Api.Auth;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>Owner/Admin: send, show and manage invitations.</summary>
[ApiController]
[Route("api/v1")]
[Authorize(Policy = Permissions.InvitationManage)]
public sealed class InvitationsController(InvitationService invitations) : ControllerBase
{
    [HttpGet("invitations/{id:guid}")]
    public Task<InvitationDto> Get(Guid id, CancellationToken ct) => invitations.GetAsync(id, ct);

    /// <summary>A wa.me link with the event's message for this guest. The PWA opens it.</summary>
    [HttpGet("invitations/{id:guid}/whatsapp-link")]
    public Task<WhatsAppLinkDto> WhatsAppLink(Guid id, CancellationToken ct) => invitations.GetWhatsAppLinkAsync(id, ct);

    /// <summary>The QR of the invitation link. <c>size</c> is the PNG width in pixels (SVG scales freely).</summary>
    [HttpGet("invitations/{id:guid}/qr")]
    [Produces("image/png", "image/svg+xml")]
    public async Task<IActionResult> Qr(
        Guid id, [FromQuery] InvitationService.QrFormat format = InvitationService.QrFormat.Png,
        [FromQuery] int size = 512, CancellationToken ct = default)
    {
        var (content, contentType) = await invitations.GetQrAsync(id, format, size, ct);
        Response.Headers.CacheControl = "private, no-store";
        return File(content, contentType);
    }

    [HttpPost("invitations/{id:guid}/regenerate-code")]
    public Task<InvitationDto> RegenerateCode(Guid id, CancellationToken ct) => invitations.RegenerateCodeAsync(id, ct);

    [HttpPost("invitations/{id:guid}/revoke")]
    public Task<InvitationDto> Revoke(Guid id, CancellationToken ct) => invitations.RevokeAsync(id, ct);

    /// <summary>All active invitations with their QR (SVG), for the printable sheet.</summary>
    [HttpGet("events/{eventId:guid}/invitations/qr-sheet")]
    public Task<IReadOnlyList<QrSheetItemDto>> QrSheet(Guid eventId, CancellationToken ct) =>
        invitations.GetQrSheetAsync(eventId, ct);

    [HttpGet("events/{eventId:guid}/whatsapp-template")]
    public Task<WhatsAppTemplateDto> GetTemplate(Guid eventId, CancellationToken ct) =>
        invitations.GetTemplateAsync(eventId, ct);

    [HttpPut("events/{eventId:guid}/whatsapp-template")]
    public Task<WhatsAppTemplateDto> UpdateTemplate(Guid eventId, UpdateWhatsAppTemplateRequest request, CancellationToken ct) =>
        invitations.UpdateTemplateAsync(eventId, request, ct);
}
