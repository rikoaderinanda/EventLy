using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using QRCoder;

namespace EventLy.Api.Services;

/// <summary>
/// The organizer side of invitations: details, QR, "Kirim via WhatsApp", a new code, revoking, and the
/// printable QR sheet. QR images are rendered on demand from the URL (a few milliseconds), not stored.
/// </summary>
public sealed class InvitationService(AppDbContext db, ICurrentUser currentUser, AuditService audit, InvitationLinks links)
{
    public enum QrFormat
    {
        Png,
        Svg,
    }

    public async Task<InvitationDto> GetAsync(Guid id, CancellationToken ct)
    {
        var (invitation, guest) = await LoadAsync(id, tracking: false, ct);
        return ToDto(invitation, guest);
    }

    /// <summary>A new code: the old link and QR stop working, and a revoked invitation becomes active again.</summary>
    public async Task<InvitationDto> RegenerateCodeAsync(Guid id, CancellationToken ct)
    {
        var (invitation, guest) = await LoadAsync(id, tracking: true, ct);
        await RequireEditableEventAsync(invitation.EventId, ct);
        // Phase 8: blocked once the guest has checked in (the QR is then their check-in record).

        invitation.Code = InvitationCode.New();
        invitation.Status = InvitationStatus.Active;
        audit.Add(AuditActions.InvitationCodeRegenerated, currentUser.UserId, invitation.OrganizationId,
            nameof(Invitation), invitation.Id);
        await db.SaveChangesAsync(ct);
        return ToDto(invitation, guest);
    }

    public async Task<InvitationDto> RevokeAsync(Guid id, CancellationToken ct)
    {
        var (invitation, guest) = await LoadAsync(id, tracking: true, ct);
        await RequireEditableEventAsync(invitation.EventId, ct);
        if (invitation.Status != InvitationStatus.Revoked)
        {
            invitation.Status = InvitationStatus.Revoked;
            audit.Add(AuditActions.InvitationRevoked, currentUser.UserId, invitation.OrganizationId,
                nameof(Invitation), invitation.Id);
            await db.SaveChangesAsync(ct);
        }
        return ToDto(invitation, guest);
    }

    public async Task<WhatsAppLinkDto> GetWhatsAppLinkAsync(Guid id, CancellationToken ct)
    {
        var (invitation, guest) = await LoadAsync(id, tracking: false, ct);
        RequireActive(invitation);
        var ev = await db.Events.AsNoTracking().SingleAsync(e => e.Id == invitation.EventId, ct);

        var message = WhatsAppMessage.Render(ev.WhatsappTemplate, guest.Name, ev.Name, links.Url(invitation.Code));
        return new WhatsAppLinkDto(WhatsAppMessage.Link(guest.Phone, message), message,
            WhatsAppMessage.NormalizePhone(guest.Phone));
    }

    public async Task<(byte[] Content, string ContentType)> GetQrAsync(Guid id, QrFormat format, int size, CancellationToken ct)
    {
        var (invitation, _) = await LoadAsync(id, tracking: false, ct);
        RequireActive(invitation);
        var url = links.Url(invitation.Code);
        return format == QrFormat.Svg
            ? (System.Text.Encoding.UTF8.GetBytes(Svg(url)), "image/svg+xml")
            : (Png(url, size), "image/png");
    }

    /// <summary>Every active invitation of the event with its QR, sorted by guest name, for printing.</summary>
    public async Task<IReadOnlyList<QrSheetItemDto>> GetQrSheetAsync(Guid eventId, CancellationToken ct)
    {
        if (!await db.Events.AnyAsync(e => e.Id == eventId, ct))
        {
            throw new NotFoundException("event.not_found", "Event not found.");
        }

        var rows = await (
                from i in db.Invitations.AsNoTracking()
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where i.EventId == eventId && i.Status == InvitationStatus.Active
                orderby g.Name
                select new { i.Id, i.Code, g.Name, g.Type, g.NumberOfPeople })
            .Take(2_000)
            .ToListAsync(ct);
        return [.. rows.Select(r =>
        {
            var url = links.Url(r.Code);
            return new QrSheetItemDto(r.Id, r.Name, r.Type, r.NumberOfPeople, url, Svg(url));
        })];
    }

    public async Task<WhatsAppTemplateDto> GetTemplateAsync(Guid eventId, CancellationToken ct)
    {
        var template = await db.Events.Where(e => e.Id == eventId).Select(e => new { e.WhatsappTemplate })
            .SingleOrDefaultAsync(ct) ?? throw new NotFoundException("event.not_found", "Event not found.");
        return ToTemplateDto(template.WhatsappTemplate);
    }

    public async Task<WhatsAppTemplateDto> UpdateTemplateAsync(Guid eventId, UpdateWhatsAppTemplateRequest request, CancellationToken ct)
    {
        var ev = await RequireEditableEventAsync(eventId, ct);
        ev.WhatsappTemplate = string.IsNullOrWhiteSpace(request.Template) ? null : request.Template.Trim();
        audit.Add(AuditActions.EventWhatsappTemplateUpdated, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id);
        await db.SaveChangesAsync(ct);
        return ToTemplateDto(ev.WhatsappTemplate);
    }

    public static string Svg(string payload)
    {
        using var data = QRCodeGenerator.GenerateQrCode(payload, QRCodeGenerator.ECCLevel.M);
        return new SvgQRCode(data).GetGraphic(8, "#000000", "#ffffff", drawQuietZones: true,
            SvgQRCode.SizingMode.ViewBoxAttribute);
    }

    /// <summary><paramref name="size"/> is the wanted width in pixels; the QR is scaled to whole modules.</summary>
    public static byte[] Png(string payload, int size)
    {
        using var data = QRCodeGenerator.GenerateQrCode(payload, QRCodeGenerator.ECCLevel.M);
        var modules = data.ModuleMatrix.Count;
        var pixelsPerModule = Math.Clamp(size / modules, 2, 40);
        return new PngByteQRCode(data).GetGraphic(pixelsPerModule);
    }

    private async Task<(Invitation Invitation, Guest Guest)> LoadAsync(Guid id, bool tracking, CancellationToken ct)
    {
        var invitations = tracking ? db.Invitations : db.Invitations.AsNoTracking();
        var guests = tracking ? db.Guests : db.Guests.AsNoTracking();
        // The guest filter hides deleted guests, so their invitation is "not found" too.
        var row = await (
                from i in invitations
                join g in guests on i.GuestId equals g.Id
                where i.Id == id
                select new { Invitation = i, Guest = g })
            .SingleOrDefaultAsync(ct) ?? throw new NotFoundException("invitation.not_found", "Invitation not found.");
        return (row.Invitation, row.Guest);
    }

    private async Task<Event> RequireEditableEventAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await db.Events.SingleOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new NotFoundException("event.not_found", "Event not found.");
        if (!EventLifecycle.IsEditable(ev.Status))
        {
            throw new ConflictException("event.not_editable", "A completed or cancelled event can't be changed.");
        }
        return ev;
    }

    private static void RequireActive(Invitation invitation)
    {
        if (invitation.Status == InvitationStatus.Revoked)
        {
            throw new ConflictException("invitation.revoked", "This invitation is revoked. Generate a new code to use it again.");
        }
    }

    private static WhatsAppTemplateDto ToTemplateDto(string? template) =>
        new(template ?? WhatsAppMessage.DefaultTemplate, template is null);

    private InvitationDto ToDto(Invitation i, Guest g) => new(
        i.Id, i.EventId, i.Code, links.Url(i.Code), i.Type, i.Status, i.OpenedAt,
        new InvitationGuestDto(g.Id, g.Name, g.Phone, g.Type, g.NumberOfPeople), i.CreatedAt);
}
