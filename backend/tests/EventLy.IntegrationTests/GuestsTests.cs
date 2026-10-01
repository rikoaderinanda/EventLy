using System.Net;
using EventLy.Api.Data.Seed;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Dtos.Packages;
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

/// <summary>Guests, their 1:1 invitation, sessions per guest (Q-38) and the package guest limit.</summary>
public sealed class GuestsTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
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
        _tenant = await CreateTenantAsync(_client, "Guests WO");
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

    private async Task<PackageDto> PackageWithGuestsAsync(int maxGuests)
    {
        var root = (await DevSignInAsync(_client, ApiFactory.RootEmail)).Body.AccessToken;
        var features = PackageSeed.Initial()[0].Features.Copy();
        features.MaxGuests = maxGuests;
        return await ReadAsync<PackageDto>(await SendAsync(_client, HttpMethod.Post, "/api/v1/platform/packages", root,
            new CreatePackageRequest("G" + Guid.NewGuid().ToString("N")[..10], "Small", 100_000m, "IDR", features, true)));
    }

    /// <summary>An active event on a package that allows <paramref name="maxGuests"/> guests.</summary>
    private async Task<Guid> PaidEventAsync(int maxGuests)
    {
        var package = await PackageWithGuestsAsync(maxGuests);
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        await PayAsync(_factory, _client, await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, package.Id));
        return ev.Id;
    }

    [Fact]
    public async Task Adding_a_guest_creates_their_invitation()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);

        var response = await AddAsync(_client, _tenant.Admin, ev.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var guest = await ReadAsync<GuestDto>(response);
        guest.GuestType.ShouldBe(GuestType.Individual);
        guest.NumberOfPeople.ShouldBe(1);
        guest.Invitation.Status.ShouldBe(InvitationStatus.Active);
        guest.Invitation.Code.Length.ShouldBe(22);
        guest.Invitation.Url.ShouldBeNull(); // not sendable before the event is paid (Q-48)
        await using var db = postgres.CreateDbContext(_tenant.OrganizationId);
        (await db.Invitations.CountAsync(i => i.GuestId == guest.Id, Ct)).ShouldBe(1);
    }

    [Fact]
    public async Task A_guest_is_invited_to_every_session_unless_some_are_ticked()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var akad = ev.Sessions.Single(s => !s.IsCheckInSession).Id;

        var everyone = await CreateAsync(_client, _tenant.Owner, ev.Id);
        var familyOnly = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Om Budi", sessionIds: [akad]));

        everyone.SessionIds.ShouldBe(ev.Sessions.Select(s => s.Id), ignoreOrder: true);
        familyOnly.SessionIds.ShouldBe([akad]);
    }

    [Fact]
    public async Task Sessions_of_another_event_are_refused()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var other = await Events.CreateAsync(_client, _tenant.Owner);

        var response = await AddAsync(_client, _tenant.Owner, ev.Id, Individual(sessionIds: [other.Sessions[0].Id]));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemCodeAsync(response)).ShouldBe("guest.unknown_session");
    }

    [Fact]
    public async Task A_group_invitation_holds_only_the_number_of_people()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);

        var family = await CreateAsync(_client, _tenant.Owner, ev.Id, Family(people: 4));
        var invalid = await AddAsync(_client, _tenant.Owner, ev.Id, Family(people: 1));

        family.GuestType.ShouldBe(GuestType.Group);
        family.NumberOfPeople.ShouldBe(4);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Editing_a_guest_updates_the_invitation_type_and_keeps_the_code()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id);

        var updated = await ReadAsync<GuestDto>(await Send(HttpMethod.Put, $"/api/v1/events/{ev.Id}/guests/{guest.Id}",
            _tenant.Owner, new UpdateGuestRequest("Sari & keluarga", null, "sari@example.test", GuestType.Group, 3, null)));

        updated.GuestType.ShouldBe(GuestType.Group);
        updated.Invitation.Code.ShouldBe(guest.Invitation.Code);
        updated.SessionIds.ShouldBe(guest.SessionIds, ignoreOrder: true);
        var invitation = await ReadAsync<InvitationDto>(
            await Send(HttpMethod.Get, $"/api/v1/invitations/{guest.Invitation.Id}", _tenant.Owner));
        invitation.Type.ShouldBe(GuestType.Group);
    }

    [Fact]
    public async Task Deleting_a_guest_revokes_their_invitation()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id);

        (await Send(HttpMethod.Delete, $"/api/v1/events/{ev.Id}/guests/{guest.Id}", _tenant.Owner))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await ListAsync(_client, _tenant.Owner, ev.Id)).Guests.ShouldBeEmpty();
        (await Send(HttpMethod.Get, $"/api/v1/invitations/{guest.Invitation.Id}", _tenant.Owner))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
        await using var db = postgres.CreateDbContext(_tenant.OrganizationId);
        (await db.Invitations.SingleAsync(i => i.Id == guest.Invitation.Id, Ct)).Status.ShouldBe(InvitationStatus.Revoked);
    }

    [Fact]
    public async Task The_list_filters_and_reports_the_quota()
    {
        var eventId = await PaidEventAsync(maxGuests: 10);
        await CreateAsync(_client, _tenant.Owner, eventId, Individual("Sari"));
        await CreateAsync(_client, _tenant.Owner, eventId, Family("Keluarga Wijaya", 4));

        var families = await ListAsync(_client, _tenant.Owner, eventId, "?type=Group");
        var search = await ListAsync(_client, _tenant.Owner, eventId, "?search=sar");

        families.Guests.Select(g => g.Name).ShouldBe(["Keluarga Wijaya"]);
        families.Total.ShouldBe(2);
        families.TotalPeople.ShouldBe(5);
        families.Limit.ShouldBe(10);
        search.Guests.Select(g => g.Name).ShouldBe(["Sari"]);
    }

    [Fact]
    public async Task The_package_guest_limit_is_a_422()
    {
        var eventId = await PaidEventAsync(maxGuests: 2);
        await CreateAsync(_client, _tenant.Owner, eventId, Individual("Satu"));
        await CreateAsync(_client, _tenant.Owner, eventId, Individual("Dua"));

        var third = await AddAsync(_client, _tenant.Owner, eventId, Individual("Tiga"));

        third.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemCodeAsync(third)).ShouldBe("guest.quota_exceeded");
    }

    [Fact]
    public async Task A_group_takes_a_place_for_each_person()
    {
        var eventId = await PaidEventAsync(maxGuests: 5);
        await CreateAsync(_client, _tenant.Owner, eventId, Family("Keluarga Wijaya", 4));

        var tooBig = await AddAsync(_client, _tenant.Owner, eventId, Family("Keluarga Adi", 2));
        var fits = await AddAsync(_client, _tenant.Owner, eventId, Individual("Sari"));

        tooBig.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemCodeAsync(tooBig)).ShouldBe("guest.quota_exceeded");
        fits.StatusCode.ShouldBe(HttpStatusCode.Created);
        var list = await ListAsync(_client, _tenant.Owner, eventId);
        list.TotalPeople.ShouldBe(5);
        list.Limit.ShouldBe(5);
    }

    [Fact]
    public async Task Growing_a_group_past_the_limit_is_a_422_but_shrinking_is_fine()
    {
        var eventId = await PaidEventAsync(maxGuests: 5);
        var family = await CreateAsync(_client, _tenant.Owner, eventId, Family("Keluarga Wijaya", 4));
        var path = $"/api/v1/events/{eventId}/guests/{family.Id}";

        var grown = await Send(HttpMethod.Put, path, _tenant.Owner,
            new UpdateGuestRequest(family.Name, null, null, GuestType.Group, 6, null));
        var fits = await Send(HttpMethod.Put, path, _tenant.Owner,
            new UpdateGuestRequest(family.Name, null, null, GuestType.Group, 5, null));
        var shrunk = await Send(HttpMethod.Put, path, _tenant.Owner,
            new UpdateGuestRequest(family.Name, null, null, GuestType.Group, 2, null));

        grown.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        fits.StatusCode.ShouldBe(HttpStatusCode.OK);
        shrunk.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ListAsync(_client, _tenant.Owner, eventId)).TotalPeople.ShouldBe(2);
    }

    [Fact]
    public async Task Guests_added_at_the_same_time_never_exceed_the_limit()
    {
        var eventId = await PaidEventAsync(maxGuests: 3);

        var responses = await Task.WhenAll(Enumerable.Range(0, 8)
            .Select(i => AddAsync(_client, _tenant.Owner, eventId, Individual($"Tamu {i}"))));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).ShouldBe(3);
        responses.Count(r => r.StatusCode == HttpStatusCode.UnprocessableEntity).ShouldBe(5);
        (await ListAsync(_client, _tenant.Owner, eventId)).Total.ShouldBe(3);
    }

    [Fact]
    public async Task Checkout_refuses_a_package_smaller_than_the_guest_list()
    {
        // One group of 3 people doesn't fit a package for 2, even though it is a single invitation.
        var tiny = await PackageWithGuestsAsync(maxGuests: 2);
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        await CreateAsync(_client, _tenant.Owner, ev.Id, Family("Keluarga Adi", 3));

        var checkout = await CheckoutAsync(_client, _tenant.Owner, ev.Id, tiny.Id);

        checkout.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(checkout)).ShouldBe("payment.guest_limit_exceeded");
    }

    [Fact]
    public async Task A_cancelled_event_has_a_read_only_guest_list()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id);
        (await Send(HttpMethod.Post, $"/api/v1/events/{ev.Id}/cancel", _tenant.Owner)).EnsureSuccessStatusCode();

        var add = await AddAsync(_client, _tenant.Owner, ev.Id);
        var delete = await Send(HttpMethod.Delete, $"/api/v1/events/{ev.Id}/guests/{guest.Id}", _tenant.Owner);

        add.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(add)).ShouldBe("event.not_editable");
        delete.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ListAsync(_client, _tenant.Owner, ev.Id)).Guests.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task Staff_cannot_see_or_manage_guests()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);

        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/guests", _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await AddAsync(_client, _tenant.Staff, ev.Id)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Removing_a_session_from_the_event_removes_it_from_guests()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id);
        var update = Events.ToUpdate(ev);
        var resepsiOnly = update with { Sessions = [.. update.Sessions.Where(s => s.IsCheckInSession)] };

        (await Send(HttpMethod.Put, $"/api/v1/events/{ev.Id}", _tenant.Owner, resepsiOnly)).EnsureSuccessStatusCode();

        var reloaded = await ReadAsync<GuestDto>(
            await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/guests/{guest.Id}", _tenant.Owner));
        reloaded.SessionIds.ShouldBe([ev.Sessions.Single(s => s.IsCheckInSession).Id]);
    }
}
