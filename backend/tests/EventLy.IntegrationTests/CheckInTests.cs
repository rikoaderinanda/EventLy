using System.Net;
using EventLy.Api.Dtos.CheckIns;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Dtos.Guests;
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
/// Check-in at the venue: idempotent per invitation, only valid invitations of this event (Q-49), only on
/// the event day (Q-35), Staff only at assigned events, RSVP set to attending, warnings (Q-53).
/// </summary>
public sealed class CheckInTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private static readonly TimeZoneInfo Jakarta = TimeZoneInfo.FindSystemTimeZoneById("Asia/Jakarta");

    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Tenant _tenant = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        _tenant = await CreateTenantAsync(_client, "Check-in WO");
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private Task<HttpResponseMessage> Send(HttpMethod method, string path, Member member, object? body = null) =>
        SendAsync(_client, method, path, member.AccessToken, body);

    /// <summary>A paid event happening today (Jakarta): an early akad and the resepsi for check-in.</summary>
    private async Task<EventDto> TodayEventAsync(bool pay = true, bool assignStaff = true)
    {
        var today = TimeZoneInfo.ConvertTime(_factory.Time.GetUtcNow(), Jakarta).Date;
        var request = new CreateEventRequest("Resepsi hari ini", EventCategory.Wedding, "Asia/Jakarta", null,
        [
            new EventSessionInput(null, "Akad Nikah", today, today.AddMinutes(30), "Masjid", null, false),
            new EventSessionInput(null, "Resepsi", today.AddMinutes(31), today.AddHours(23).AddMinutes(59), "Gedung", null, true),
        ]);
        var ev = await Events.CreateAsync(_client, _tenant.Owner, request);
        if (pay)
        {
            var basic = await PackageAsync(_client, _tenant.Owner, "BASIC");
            await PayAsync(_factory, _client, await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, basic.Id));
        }
        if (assignStaff)
        {
            (await Send(HttpMethod.Put, $"/api/v1/events/{ev.Id}/staff", _tenant.Owner,
                new AssignStaffRequest([_tenant.Staff.UserId]))).EnsureSuccessStatusCode();
        }
        return ev;
    }

    private Task<HttpResponseMessage> Scan(Guid eventId, string code, Member? member = null) =>
        Send(HttpMethod.Post, $"/api/v1/events/{eventId}/check-ins", member ?? _tenant.Staff, new CheckInRequest(code, null));

    [Fact]
    public async Task Scanning_the_qr_checks_the_guest_in_and_a_second_scan_says_so()
    {
        var ev = await TodayEventAsync();
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id, Family("Keluarga Wijaya", 3));

        // The QR holds the invitation URL; the API takes the code out of it.
        var first = await Scan(ev.Id, guest.Invitation.Url!);
        var second = await Scan(ev.Id, guest.Invitation.Code, _tenant.Owner);

        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = await ReadAsync<CheckInResultDto>(first);
        created.GuestName.ShouldBe("Keluarga Wijaya");
        created.NumberOfPeople.ShouldBe(3);
        created.AlreadyCheckedIn.ShouldBeFalse();
        created.CheckedInAt.ShouldNotBeNull();

        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        var repeat = await ReadAsync<CheckInResultDto>(second);
        repeat.AlreadyCheckedIn.ShouldBeTrue();
        repeat.CheckedInAt.ShouldBe(created.CheckedInAt);
        repeat.CheckedInBy.ShouldBe("Staff member");
        await using var db = postgres.CreateDbContext(_tenant.OrganizationId);
        (await db.CheckIns.CountAsync(c => c.InvitationId == guest.Invitation.Id, Ct)).ShouldBe(1);
    }

    [Fact]
    public async Task Scans_of_the_same_qr_at_the_same_moment_leave_one_check_in()
    {
        var ev = await TodayEventAsync();
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id);

        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => Scan(ev.Id, guest.Invitation.Code)));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).ShouldBe(1);
        responses.Count(r => r.StatusCode == HttpStatusCode.OK).ShouldBe(5);
        await using var db = postgres.CreateDbContext(_tenant.OrganizationId);
        (await db.CheckIns.CountAsync(c => c.InvitationId == guest.Invitation.Id, Ct)).ShouldBe(1);
    }

    [Fact]
    public async Task A_guest_who_said_no_can_still_come_and_becomes_attending()
    {
        var ev = await TodayEventAsync();
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id);
        (await SendAsync(_client, HttpMethod.Put, $"/api/v1/public/invitations/{guest.Invitation.Code}/rsvp", null,
            new UpdateRsvpRequest(RsvpStatus.NotAttending))).EnsureSuccessStatusCode();

        var lookup = await ReadAsync<CheckInResultDto>(await Send(HttpMethod.Get,
            $"/api/v1/events/{ev.Id}/check-ins/lookup?code={guest.Invitation.Code}", _tenant.Staff));
        var checkedIn = await ReadAsync<CheckInResultDto>(await Scan(ev.Id, guest.Invitation.Code));

        lookup.Warnings.ShouldBe([CheckInWarnings.RsvpNotAttending]);
        lookup.AlreadyCheckedIn.ShouldBeFalse();
        checkedIn.Rsvp.ShouldBe(RsvpStatus.Attending);
        checkedIn.Warnings.ShouldContain(CheckInWarnings.RsvpNotAttending);
        (await ListAsync(_client, _tenant.Owner, ev.Id, "?rsvp=Attending")).Guests.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task A_guest_invited_only_to_another_session_checks_in_with_a_warning()
    {
        var ev = await TodayEventAsync();
        var akad = ev.Sessions.Single(s => !s.IsCheckInSession).Id;
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Om Budi", sessionIds: [akad]));

        var response = await Scan(ev.Id, guest.Invitation.Code);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        (await ReadAsync<CheckInResultDto>(response)).Warnings.ShouldBe([CheckInWarnings.NotInvitedToCheckInSession]);
    }

    [Fact]
    public async Task Only_a_valid_invitation_of_this_event_checks_in()
    {
        var ev = await TodayEventAsync();
        var other = await TodayEventAsync();
        var otherGuest = await CreateAsync(_client, _tenant.Owner, other.Id);
        var revoked = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Dicabut"));
        (await Send(HttpMethod.Post, $"/api/v1/invitations/{revoked.Invitation.Id}/revoke", _tenant.Owner)).EnsureSuccessStatusCode();

        foreach (var code in new[] { otherGuest.Invitation.Code, revoked.Invitation.Code, "bukan-kode", "https://x.id/i/" + new string('a', 22) })
        {
            var response = await Scan(ev.Id, code);
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, code);
            (await ProblemCodeAsync(response)).ShouldBe("checkin.invitation_not_found");
        }
    }

    [Fact]
    public async Task Staff_check_in_only_at_assigned_events_and_admin_cannot_check_in()
    {
        var ev = await TodayEventAsync(assignStaff: false);
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id);

        (await Scan(ev.Id, guest.Invitation.Code)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await Scan(ev.Id, guest.Invitation.Code, _tenant.Admin)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await Scan(ev.Id, guest.Invitation.Code, _tenant.Owner)).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task An_unpaid_event_or_another_day_is_closed_for_check_in()
    {
        var unpaid = await TodayEventAsync(pay: false);
        var unpaidGuest = await CreateAsync(_client, _tenant.Owner, unpaid.Id);
        var later = await Events.CreateAsync(_client, _tenant.Owner); // 12 Dec 2026
        await PayAsync(_factory, _client, await StartCheckoutAsync(_client, _tenant.Owner, later.Id,
            (await PackageAsync(_client, _tenant.Owner, "BASIC")).Id));
        var laterGuest = await CreateAsync(_client, _tenant.Owner, later.Id);

        var notActive = await Scan(unpaid.Id, unpaidGuest.Invitation.Code, _tenant.Owner);
        var notToday = await Scan(later.Id, laterGuest.Invitation.Code, _tenant.Owner);

        notActive.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(notActive)).ShouldBe("checkin.event_not_active");
        notToday.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(notToday)).ShouldBe("checkin.not_event_day");
    }

    [Fact]
    public async Task Manual_entry_finds_the_guest_by_name()
    {
        var ev = await TodayEventAsync();
        await CreateAsync(_client, _tenant.Owner, ev.Id, Family("Keluarga Wijaya", 4));
        await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sari"));

        var hits = await ReadAsync<List<CheckInSearchItemDto>>(await Send(HttpMethod.Get,
            $"/api/v1/events/{ev.Id}/check-ins/search?q=wija", _tenant.Staff));
        var hit = hits.ShouldHaveSingleItem();
        var response = await Send(HttpMethod.Post, $"/api/v1/events/{ev.Id}/check-ins", _tenant.Staff,
            new CheckInRequest(null, hit.InvitationId));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var log = await ReadAsync<List<CheckInLogItemDto>>(await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/check-ins", _tenant.Admin));
        log.ShouldHaveSingleItem().Method.ShouldBe(CheckInMethod.Manual);
        (await ReadAsync<List<CheckInSearchItemDto>>(await Send(HttpMethod.Get,
            $"/api/v1/events/{ev.Id}/check-ins/search?q=wija", _tenant.Staff))).Single().CheckedIn.ShouldBeTrue();
        (await Send(HttpMethod.Post, $"/api/v1/events/{ev.Id}/check-ins", _tenant.Staff, new CheckInRequest("x", hit.InvitationId)))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Counts_log_and_my_activity()
    {
        var ev = await TodayEventAsync();
        var family = await CreateAsync(_client, _tenant.Owner, ev.Id, Family("Keluarga Wijaya", 4));
        var sari = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sari"));
        await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Budi"));
        (await Scan(ev.Id, family.Invitation.Code)).EnsureSuccessStatusCode();
        (await Scan(ev.Id, sari.Invitation.Code, _tenant.Owner)).EnsureSuccessStatusCode();

        var summary = await ReadAsync<CheckInSummaryDto>(await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/check-ins/summary", _tenant.Staff));
        var mine = await ReadAsync<List<CheckInLogItemDto>>(await Send(HttpMethod.Get, $"/api/v1/staff/me/activity?eventId={ev.Id}", _tenant.Staff));
        var byStaff = await ReadAsync<List<CheckInLogItemDto>>(await Send(HttpMethod.Get,
            $"/api/v1/events/{ev.Id}/check-ins?staffId={_tenant.Staff.UserId}", _tenant.Owner));

        summary.ShouldBe(new CheckInSummaryDto(Invitations: 3, People: 6, CheckedInInvitations: 2, CheckedInPeople: 5));
        mine.ShouldHaveSingleItem().GuestName.ShouldBe("Keluarga Wijaya");
        byStaff.ShouldHaveSingleItem().StaffName.ShouldBe("Staff member");
        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/check-ins", _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task A_checked_in_guest_keeps_their_invitation()
    {
        var ev = await TodayEventAsync();
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id);
        (await Scan(ev.Id, guest.Invitation.Code)).EnsureSuccessStatusCode();

        var delete = await Send(HttpMethod.Delete, $"/api/v1/events/{ev.Id}/guests/{guest.Id}", _tenant.Owner);
        var regenerate = await Send(HttpMethod.Post, $"/api/v1/invitations/{guest.Invitation.Id}/regenerate-code", _tenant.Owner);

        delete.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(delete)).ShouldBe("guest.checked_in");
        regenerate.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(regenerate)).ShouldBe("invitation.checked_in");
        (await ListAsync(_client, _tenant.Owner, ev.Id, "?checkedIn=true")).Guests.ShouldHaveSingleItem().CheckedInAt.ShouldNotBeNull();
        (await ListAsync(_client, _tenant.Owner, ev.Id, "?checkedIn=false")).Guests.ShouldBeEmpty();
        var page = await ReadAsync<PublicInvitationDto>(await SendAsync(_client, HttpMethod.Get,
            $"/api/v1/public/invitations/{guest.Invitation.Code}", null));
        page.CheckedIn.ShouldBeTrue();
    }

    [Fact]
    public async Task Another_tenant_cant_check_in_or_read_the_log()
    {
        var ev = await TodayEventAsync();
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id);
        var other = await CreateTenantAsync(_client, "Other check-in WO");

        (await Scan(ev.Id, guest.Invitation.Code, other.Owner)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/check-ins/lookup?code={guest.Invitation.Code}", other.Staff))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/check-ins", other.Owner)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/check-ins/summary", other.Admin)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
