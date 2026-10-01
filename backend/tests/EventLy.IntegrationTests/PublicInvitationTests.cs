using System.Net;
using System.Net.Http.Json;
using EventLy.Api.Data.Seed;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Dtos.Public;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.GuestRequests;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;
using Events = EventLy.IntegrationTests.Infrastructure.EventRequests;

namespace EventLy.IntegrationTests;

/// <summary>
/// The guest's invitation page by code: what it shows (and doesn't), RSVP with its cut-off, wishes (Q-42),
/// digital gifts (Q-41), and the organizer's RSVP monitor and moderation.
/// </summary>
public sealed class PublicInvitationTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
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
        _tenant = await CreateTenantAsync(_client, "Public WO");
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private Task<HttpResponseMessage> Organizer(HttpMethod method, string path, object? body = null) =>
        SendAsync(_client, method, path, _tenant.Owner.AccessToken, body);

    private Task<HttpResponseMessage> Public(HttpMethod method, string code, string path = "", object? body = null) =>
        SendAsync(_client, method, $"/api/v1/public/invitations/{code}{path}", null, body);

    private async Task<EventDto> ActiveEventAsync(PackageFeatures? features = null)
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner, Events.Wedding("Pernikahan Rina & Budi"));
        Guid packageId;
        if (features is null)
        {
            packageId = (await PackageAsync(_client, _tenant.Owner, "BASIC")).Id;
        }
        else
        {
            var root = (await DevSignInAsync(_client, ApiFactory.RootEmail)).Body.AccessToken;
            packageId = (await ReadAsync<PackageDto>(await SendAsync(_client, HttpMethod.Post, "/api/v1/platform/packages", root,
                new CreatePackageRequest("P" + Guid.NewGuid().ToString("N")[..10], "Custom", 100_000m, "IDR", features, true)))).Id;
        }
        await PayAsync(_factory, _client, await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, packageId));
        return ev;
    }

    private async Task<(EventDto Event, GuestDto Guest)> GuestOfActiveEventAsync(CreateGuestRequest? request = null)
    {
        var ev = await ActiveEventAsync();
        return (ev, await CreateAsync(_client, _tenant.Owner, ev.Id, request));
    }

    [Fact]
    public async Task The_page_shows_the_guest_and_only_their_sessions()
    {
        var ev = await ActiveEventAsync();
        var resepsi = ev.Sessions.Single(s => s.IsCheckInSession);
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sari", sessionIds: [resepsi.Id]));
        await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Tamu lain"));

        var response = await Public(HttpMethod.Get, guest.Invitation.Code);
        var page = await ReadAsync<PublicInvitationDto>(response);

        page.GuestName.ShouldBe("Sari");
        page.Event.Name.ShouldBe("Pernikahan Rina & Budi");
        page.Event.Sessions.Select(s => s.Name).ShouldBe(["Resepsi"]);
        page.Event.Sessions[0].StartsAtLocal.ShouldBe(resepsi.StartsAtLocal);
        page.Rsvp.Status.ShouldBe(RsvpStatus.Pending);
        page.Rsvp.IsOpen.ShouldBeTrue();
        page.Features.Countdown.ShouldBeTrue();
        response.Headers.GetValues("Referrer-Policy").ShouldBe(["no-referrer"]);

        // Nothing about other guests or internal ids.
        var json = await response.Content.ReadAsStringAsync(Ct);
        json.ShouldNotContain("Tamu lain");
        json.ShouldNotContain(guest.Id.ToString());
        json.ShouldNotContain(ev.Id.ToString());
        json.ShouldNotContain(_tenant.OrganizationId.ToString());
    }

    [Fact]
    public async Task The_first_view_marks_the_invitation_opened()
    {
        var (_, guest) = await GuestOfActiveEventAsync();

        (await Public(HttpMethod.Get, guest.Invitation.Code)).EnsureSuccessStatusCode();
        await using var db = postgres.CreateDbContext(_tenant.OrganizationId);
        var first = (await db.Invitations.SingleAsync(i => i.Id == guest.Invitation.Id, Ct)).OpenedAt;
        _factory.Time.Advance(TimeSpan.FromHours(1));
        (await Public(HttpMethod.Get, guest.Invitation.Code)).EnsureSuccessStatusCode();

        first.ShouldNotBeNull();
        db.ChangeTracker.Clear();
        (await db.Invitations.SingleAsync(i => i.Id == guest.Invitation.Id, Ct)).OpenedAt.ShouldBe(first);
    }

    [Fact]
    public async Task Unknown_revoked_and_unpaid_invitations_are_all_404()
    {
        var (ev, guest) = await GuestOfActiveEventAsync();
        var revoked = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Dicabut"));
        (await Organizer(HttpMethod.Post, $"/api/v1/invitations/{revoked.Invitation.Id}/revoke")).EnsureSuccessStatusCode();
        var deleted = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Dihapus"));
        (await Organizer(HttpMethod.Delete, $"/api/v1/events/{ev.Id}/guests/{deleted.Id}")).EnsureSuccessStatusCode();
        var draft = await Events.CreateAsync(_client, _tenant.Owner);
        var draftGuest = await CreateAsync(_client, _tenant.Owner, draft.Id);

        var codes = new[] { "not-a-code", new string('a', 22), revoked.Invitation.Code, deleted.Invitation.Code, draftGuest.Invitation.Code };
        foreach (var code in codes)
        {
            var response = await Public(HttpMethod.Get, code);
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, code);
            (await ProblemCodeAsync(response)).ShouldBe("invitation.not_found");
        }
        (await Public(HttpMethod.Get, guest.Invitation.Code)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task A_cancelled_event_takes_its_invitations_offline()
    {
        var (ev, guest) = await GuestOfActiveEventAsync();

        (await Organizer(HttpMethod.Post, $"/api/v1/events/{ev.Id}/cancel")).EnsureSuccessStatusCode();

        (await Public(HttpMethod.Get, guest.Invitation.Code)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task The_guest_answers_and_changes_their_rsvp_until_the_event_is_over()
    {
        var (ev, guest) = await GuestOfActiveEventAsync(Family("Keluarga Wijaya", 3));
        var code = guest.Invitation.Code;

        var attending = await ReadAsync<PublicRsvpDto>(await Public(HttpMethod.Put, code, "/rsvp", new UpdateRsvpRequest(RsvpStatus.Attending)));
        var changed = await ReadAsync<PublicRsvpDto>(await Public(HttpMethod.Put, code, "/rsvp", new UpdateRsvpRequest(RsvpStatus.NotAttending)));
        var pending = await Public(HttpMethod.Put, code, "/rsvp", new UpdateRsvpRequest(RsvpStatus.Pending));

        attending.Status.ShouldBe(RsvpStatus.Attending);
        changed.Status.ShouldBe(RsvpStatus.NotAttending);
        pending.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ReadAsync<PublicInvitationDto>(await Public(HttpMethod.Get, code))).Rsvp.Status.ShouldBe(RsvpStatus.NotAttending);

        // Still open once the check-in session has started (Q-47: until the event is over).
        _factory.Time.Advance(ev.Date - _factory.Time.GetUtcNow() + TimeSpan.FromMinutes(1));
        (await Public(HttpMethod.Put, code, "/rsvp", new UpdateRsvpRequest(RsvpStatus.Attending))).EnsureSuccessStatusCode();

        var end = ev.Sessions.Max(s => s.EndsAt);
        _factory.Time.Advance(end - _factory.Time.GetUtcNow() + TimeSpan.FromMinutes(1));
        var late = await Public(HttpMethod.Put, code, "/rsvp", new UpdateRsvpRequest(RsvpStatus.NotAttending));
        late.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(late)).ShouldBe("rsvp.closed");
        (await ReadAsync<PublicInvitationDto>(await Public(HttpMethod.Get, code))).Rsvp.IsOpen.ShouldBeFalse();
    }

    [Fact]
    public async Task First_answers_arriving_together_leave_one_rsvp()
    {
        var (_, guest) = await GuestOfActiveEventAsync();

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ =>
            Public(HttpMethod.Put, guest.Invitation.Code, "/rsvp", new UpdateRsvpRequest(RsvpStatus.Attending))));

        responses.ShouldAllBe(r => r.IsSuccessStatusCode);
        await using var db = postgres.CreateDbContext(_tenant.OrganizationId);
        (await db.Rsvps.CountAsync(r => r.InvitationId == guest.Invitation.Id, Ct)).ShouldBe(1);
    }

    [Fact]
    public async Task The_organizer_monitors_rsvps()
    {
        var ev = await ActiveEventAsync();
        var family = await CreateAsync(_client, _tenant.Owner, ev.Id, Family("Keluarga Wijaya", 4));
        var sari = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sari"));
        await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Budi"));
        await Public(HttpMethod.Put, family.Invitation.Code, "/rsvp", new UpdateRsvpRequest(RsvpStatus.Attending));
        await Public(HttpMethod.Put, sari.Invitation.Code, "/rsvp", new UpdateRsvpRequest(RsvpStatus.NotAttending));
        await Public(HttpMethod.Get, sari.Invitation.Code);

        var summary = await ReadAsync<RsvpSummaryDto>(await SendAsync(_client, HttpMethod.Get,
            $"/api/v1/events/{ev.Id}/rsvps/summary", _tenant.Admin.AccessToken));
        var attending = await ReadAsync<List<RsvpListItemDto>>(await Organizer(HttpMethod.Get, $"/api/v1/events/{ev.Id}/rsvps?status=Attending"));
        var pendingGuests = await ListAsync(_client, _tenant.Owner, ev.Id, "?rsvp=Pending");

        summary.ShouldBe(new RsvpSummaryDto(Invitations: 3, Opened: 1, Pending: 1, Attending: 1, NotAttending: 1, ExpectedPeople: 4));
        attending.ShouldHaveSingleItem().GuestName.ShouldBe("Keluarga Wijaya");
        pendingGuests.Guests.ShouldHaveSingleItem().Name.ShouldBe("Budi");
        (await SendAsync(_client, HttpMethod.Get, $"/api/v1/events/{ev.Id}/rsvps", _tenant.Staff.AccessToken))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Guests_write_one_wish_each_and_see_everyones_visible_wishes()
    {
        var ev = await ActiveEventAsync();
        var sari = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sari"));
        var budi = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Budi"));

        await Public(HttpMethod.Put, sari.Invitation.Code, "/wish", new UpdateWishRequest("Selamat menempuh hidup baru!"));
        await Public(HttpMethod.Put, sari.Invitation.Code, "/wish", new UpdateWishRequest("Semoga sakinah mawaddah warahmah."));
        _factory.Time.Advance(TimeSpan.FromMinutes(1));
        await Public(HttpMethod.Put, budi.Invitation.Code, "/wish", new UpdateWishRequest("<script>alert(1)</script> Bahagia selalu"));

        var page = await ReadAsync<PublicWishPageDto>(await Public(HttpMethod.Get, sari.Invitation.Code, "/wishes"));
        page.Wishes.Select(w => (w.GuestName, w.IsMine)).ShouldBe([("Budi", false), ("Sari", true)]);
        page.Wishes.Single(w => w.IsMine).Message.ShouldBe("Semoga sakinah mawaddah warahmah.");
        // Stored as plain text; the page escapes it when shown.
        page.Wishes.Single(w => !w.IsMine).Message.ShouldStartWith("<script>");
        (await ReadAsync<PublicInvitationDto>(await Public(HttpMethod.Get, sari.Invitation.Code))).MyWish
            .ShouldBe("Semoga sakinah mawaddah warahmah.");
    }

    [Fact]
    public async Task The_organizer_hides_and_deletes_wishes()
    {
        var (ev, guest) = await GuestOfActiveEventAsync();
        await Public(HttpMethod.Put, guest.Invitation.Code, "/wish", new UpdateWishRequest("Iklan judi online"));
        var wish = (await ReadAsync<List<OrganizerWishDto>>(await Organizer(HttpMethod.Get, $"/api/v1/events/{ev.Id}/wishes"))).Single();

        (await Organizer(HttpMethod.Post, $"/api/v1/events/{ev.Id}/wishes/{wish.Id}/hide")).EnsureSuccessStatusCode();
        (await ReadAsync<PublicWishPageDto>(await Public(HttpMethod.Get, guest.Invitation.Code, "/wishes"))).Wishes.ShouldBeEmpty();
        (await ReadAsync<List<OrganizerWishDto>>(await Organizer(HttpMethod.Get, $"/api/v1/events/{ev.Id}/wishes")))
            .Single().IsHidden.ShouldBeTrue();

        (await Organizer(HttpMethod.Delete, $"/api/v1/events/{ev.Id}/wishes/{wish.Id}")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await ReadAsync<List<OrganizerWishDto>>(await Organizer(HttpMethod.Get, $"/api/v1/events/{ev.Id}/wishes"))).ShouldBeEmpty();
    }

    [Fact]
    public async Task Wishes_close_a_week_after_the_event()
    {
        var (ev, guest) = await GuestOfActiveEventAsync();
        var end = ev.Sessions.Single(s => s.IsCheckInSession).EndsAt;

        _factory.Time.Advance(end - _factory.Time.GetUtcNow() + TimeSpan.FromDays(7) + TimeSpan.FromMinutes(1));
        var late = await Public(HttpMethod.Put, guest.Invitation.Code, "/wish", new UpdateWishRequest("Terlambat"));

        late.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(late)).ShouldBe("wish.closed");
    }

    [Fact]
    public async Task Features_switched_off_in_the_package_are_not_available()
    {
        var features = PackageSeed.Initial()[0].Features.Copy();
        features.WishesEnabled = false;
        features.DigitalGiftEnabled = false;
        var ev = await ActiveEventAsync(features);
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id);

        var page = await ReadAsync<PublicInvitationDto>(await Public(HttpMethod.Get, guest.Invitation.Code));

        page.Features.Wishes.ShouldBeFalse();
        page.Features.DigitalGift.ShouldBeFalse();
        (await Public(HttpMethod.Get, guest.Invitation.Code, "/wishes")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await Public(HttpMethod.Put, guest.Invitation.Code, "/wish", new UpdateWishRequest("Hai"))).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await Public(HttpMethod.Get, guest.Invitation.Code, "/gifts")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Gift_accounts_are_shown_and_confirmations_reach_only_the_organizer()
    {
        var (ev, guest) = await GuestOfActiveEventAsync();
        var gifts = new UpdateEventGiftsRequest(
            [
                new GiftAccountDto(GiftAccountKind.Bank, "BSI", "7123 4567 89", "Rina Lestari"),
                new GiftAccountDto(GiftAccountKind.EWallet, "GoPay", "0812-3456-7890", "Budi Santoso"),
            ],
            "Jl. Melati No. 5, Bandung");
        (await Organizer(HttpMethod.Put, $"/api/v1/events/{ev.Id}/gifts", gifts)).EnsureSuccessStatusCode();

        var shown = await ReadAsync<PublicGiftsDto>(await Public(HttpMethod.Get, guest.Invitation.Code, "/gifts"));
        shown.Accounts.Select(a => a.Provider).ShouldBe(["BSI", "GoPay"]);
        shown.Address.ShouldBe("Jl. Melati No. 5, Bandung");

        (await Public(HttpMethod.Post, guest.Invitation.Code, "/gift-confirmations",
            new CreateGiftConfirmationRequest("Sari", 200_000m, "Transfer BSI"))).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var confirmations = await ReadAsync<List<GiftConfirmationDto>>(await Organizer(HttpMethod.Get, $"/api/v1/events/{ev.Id}/gift-confirmations"));
        confirmations.ShouldHaveSingleItem().Amount.ShouldBe(200_000m);
        confirmations[0].GuestName.ShouldBe(guest.Name);

        for (var i = 0; i < 4; i++)
        {
            (await Public(HttpMethod.Post, guest.Invitation.Code, "/gift-confirmations", new CreateGiftConfirmationRequest("Sari", null, null)))
                .EnsureSuccessStatusCode();
        }
        (await Public(HttpMethod.Post, guest.Invitation.Code, "/gift-confirmations", new CreateGiftConfirmationRequest("Sari", null, null)))
            .StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task The_guest_gets_their_qr_to_show_at_the_entrance()
    {
        var (_, guest) = await GuestOfActiveEventAsync();

        var qr = await Public(HttpMethod.Get, guest.Invitation.Code, "/qr");

        qr.Content.Headers.ContentType!.MediaType.ShouldBe("image/png");
        (await qr.Content.ReadAsByteArrayAsync(Ct)).Take(4).ShouldBe(new byte[] { 0x89, 0x50, 0x4E, 0x47 });
    }

    [Fact]
    public async Task Public_writes_are_rate_limited_per_ip()
    {
        await using var strict = new ApiFactory(postgres.ConnectionString,
            new Dictionary<string, string?> { ["RateLimiting:PublicWritePermitPerMinute"] = "2" });
        using var client = strict.CreateClient();
        var (_, guest) = await GuestOfActiveEventAsync();
        var path = $"/api/v1/public/invitations/{guest.Invitation.Code}/rsvp";

        var responses = new List<HttpResponseMessage>();
        for (var i = 0; i < 3; i++)
        {
            responses.Add(await client.PutAsJsonAsync(path, new UpdateRsvpRequest(RsvpStatus.Attending), Json, Ct));
        }

        responses.Take(2).ShouldAllBe(r => r.IsSuccessStatusCode);
        responses[2].StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
    }
}
