using System.Net;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Entities;
using EventLy.Api.Services;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.GuestRequests;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;
using Events = EventLy.IntegrationTests.Infrastructure.EventRequests;

namespace EventLy.IntegrationTests;

/// <summary>Sending and managing invitations: WhatsApp link (Q-27), QR, new code, revoke, QR sheet.</summary>
public sealed class InvitationsTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Tenant _tenant = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        _tenant = await CreateTenantAsync(_client, "Invitations WO");
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private Task<HttpResponseMessage> Send(HttpMethod method, string path, Member? member = null, object? body = null) =>
        SendAsync(_client, method, path, (member ?? _tenant.Owner).AccessToken, body);

    private async Task<(Guid EventId, GuestDto Guest)> GuestAsync(CreateGuestRequest? request = null)
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner, Events.Wedding("Pernikahan Rina & Budi"));
        return (ev.Id, await CreateAsync(_client, _tenant.Owner, ev.Id, request));
    }

    [Fact]
    public async Task The_whatsapp_link_carries_the_guest_number_and_the_default_message()
    {
        var (_, guest) = await GuestAsync(Individual("Sari", phone: "0812-3456-7890"));

        var link = await ReadAsync<WhatsAppLinkDto>(await Send(HttpMethod.Get, $"/api/v1/invitations/{guest.Invitation.Id}/whatsapp-link"));

        link.Phone.ShouldBe("6281234567890");
        link.Url.ShouldStartWith("https://wa.me/6281234567890?text=");
        link.Message.ShouldStartWith("Halo Sari,");
        link.Message.ShouldContain("Pernikahan Rina & Budi");
        link.Message.ShouldContain(guest.Invitation.Url);
    }

    [Fact]
    public async Task The_event_message_template_is_used_and_can_be_reset()
    {
        var (eventId, guest) = await GuestAsync();
        var path = $"/api/v1/events/{eventId}/whatsapp-template";

        var saved = await ReadAsync<WhatsAppTemplateDto>(await Send(HttpMethod.Put, path, body:
            new UpdateWhatsAppTemplateRequest("Yth. {nama}, mohon hadir di {acara}. {link}")));
        var link = await ReadAsync<WhatsAppLinkDto>(await Send(HttpMethod.Get, $"/api/v1/invitations/{guest.Invitation.Id}/whatsapp-link"));
        var reset = await ReadAsync<WhatsAppTemplateDto>(await Send(HttpMethod.Put, path, body: new UpdateWhatsAppTemplateRequest(null)));

        saved.IsDefault.ShouldBeFalse();
        link.Message.ShouldBe($"Yth. Sari, mohon hadir di Pernikahan Rina & Budi. {guest.Invitation.Url}");
        reset.IsDefault.ShouldBeTrue();
        reset.Template.ShouldBe(WhatsAppMessage.DefaultTemplate);
        (await Send(HttpMethod.Put, path, body: new UpdateWhatsAppTemplateRequest("Tanpa link")))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task A_new_code_replaces_the_old_link()
    {
        var (_, guest) = await GuestAsync();

        var regenerated = await ReadAsync<InvitationDto>(await Send(HttpMethod.Post, $"/api/v1/invitations/{guest.Invitation.Id}/regenerate-code"));

        regenerated.Code.ShouldNotBe(guest.Invitation.Code);
        regenerated.Url.ShouldEndWith(regenerated.Code);
        regenerated.Status.ShouldBe(InvitationStatus.Active);
    }

    [Fact]
    public async Task A_revoked_invitation_cant_be_sent_until_it_gets_a_new_code()
    {
        var (_, guest) = await GuestAsync();
        var id = guest.Invitation.Id;

        var revoked = await ReadAsync<InvitationDto>(await Send(HttpMethod.Post, $"/api/v1/invitations/{id}/revoke"));
        var whatsapp = await Send(HttpMethod.Get, $"/api/v1/invitations/{id}/whatsapp-link");
        var qr = await Send(HttpMethod.Get, $"/api/v1/invitations/{id}/qr");

        revoked.Status.ShouldBe(InvitationStatus.Revoked);
        whatsapp.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(whatsapp)).ShouldBe("invitation.revoked");
        qr.StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var restored = await ReadAsync<InvitationDto>(await Send(HttpMethod.Post, $"/api/v1/invitations/{id}/regenerate-code"));
        restored.Status.ShouldBe(InvitationStatus.Active);
        restored.Code.ShouldNotBe(guest.Invitation.Code);
    }

    [Fact]
    public async Task The_qr_is_rendered_as_png_or_svg()
    {
        var (_, guest) = await GuestAsync();

        var png = await Send(HttpMethod.Get, $"/api/v1/invitations/{guest.Invitation.Id}/qr?size=300");
        var svg = await Send(HttpMethod.Get, $"/api/v1/invitations/{guest.Invitation.Id}/qr?format=svg");

        png.Content.Headers.ContentType!.MediaType.ShouldBe("image/png");
        (await png.Content.ReadAsByteArrayAsync(Ct)).Take(4).ShouldBe(new byte[] { 0x89, 0x50, 0x4E, 0x47 });
        svg.Content.Headers.ContentType!.MediaType.ShouldBe("image/svg+xml");
        (await svg.Content.ReadAsStringAsync(Ct)).ShouldStartWith("<svg");
    }

    [Fact]
    public async Task The_qr_sheet_lists_active_invitations_by_name()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Wati"));
        await CreateAsync(_client, _tenant.Owner, ev.Id, Family("Keluarga Adi", 3));
        var revoked = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Budi"));
        (await Send(HttpMethod.Post, $"/api/v1/invitations/{revoked.Invitation.Id}/revoke")).EnsureSuccessStatusCode();

        var sheet = await ReadAsync<List<QrSheetItemDto>>(await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/invitations/qr-sheet"));

        sheet.Select(s => s.GuestName).ShouldBe(["Keluarga Adi", "Wati"]);
        sheet[0].NumberOfPeople.ShouldBe(3);
        sheet.ShouldAllBe(s => s.Svg.StartsWith("<svg", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Admin_manages_invitations_but_staff_cannot()
    {
        var (_, guest) = await GuestAsync();
        var path = $"/api/v1/invitations/{guest.Invitation.Id}";

        (await Send(HttpMethod.Get, path, _tenant.Admin)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Send(HttpMethod.Get, path, _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await Send(HttpMethod.Post, $"{path}/revoke", _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
