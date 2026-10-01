using System.Net;
using System.Net.Http.Json;
using EventLy.Api.Dtos.CheckIns;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Dtos.Public;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.GuestRequests;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;
using Events = EventLy.IntegrationTests.Infrastructure.EventRequests;

namespace EventLy.IntegrationTests;

/// <summary>
/// Dashboard numbers (Q-60): the event's statistics and the counts on the event list, for Owner and Admin
/// only, inside the tenant.
/// </summary>
public sealed class EventStatsTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
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
        _tenant = await CreateTenantAsync(_client, "Stats WO");
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private Task<HttpResponseMessage> Send(HttpMethod method, string path, Member? member, object? body = null) =>
        SendAsync(_client, method, path, member?.AccessToken, body);

    private async Task<EventDto> PaidEventTodayAsync()
    {
        var today = TimeZoneInfo.ConvertTime(_factory.Time.GetUtcNow(), Jakarta).Date;
        var ev = await Events.CreateAsync(_client, _tenant.Owner, new CreateEventRequest("Resepsi", EventCategory.Wedding,
            "Asia/Jakarta", null,
            [new EventSessionInput(null, "Resepsi", today.AddMinutes(1), today.AddHours(23).AddMinutes(58), "Gedung", null, true)]));
        var premium = await PackageAsync(_client, _tenant.Owner, "PREMIUM");
        await PayAsync(_factory, _client, await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, premium.Id));
        return ev;
    }

    [Fact]
    public async Task Stats_count_guests_answers_check_ins_wishes_gifts_and_photos()
    {
        var ev = await PaidEventTodayAsync();
        var family = await CreateAsync(_client, _tenant.Owner, ev.Id, Family("Keluarga Wijaya", 4));
        var sari = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sari", UniquePhone()));
        await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Andi", UniquePhone()));

        // Sari opens her invitation, answers "not attending", writes a wish and confirms a gift.
        var sariPage = $"/api/v1/public/invitations/{sari.Invitation.Code}";
        (await Send(HttpMethod.Get, sariPage, null)).EnsureSuccessStatusCode();
        (await Send(HttpMethod.Put, $"{sariPage}/rsvp", null, new UpdateRsvpRequest(RsvpStatus.NotAttending)))
            .EnsureSuccessStatusCode();
        (await Send(HttpMethod.Put, $"{sariPage}/wish", null, new UpdateWishRequest("Selamat!"))).EnsureSuccessStatusCode();
        (await Send(HttpMethod.Post, $"{sariPage}/gift-confirmations", null,
            new CreateGiftConfirmationRequest("Sari", 250_000, null))).EnsureSuccessStatusCode();
        // The family is checked in (which also sets their RSVP to attending, Q-49).
        (await Send(HttpMethod.Post, $"/api/v1/events/{ev.Id}/check-ins", _tenant.Owner,
            new CheckInRequest(family.Invitation.Code, null))).EnsureSuccessStatusCode();

        var response = await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/stats", _tenant.Admin);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var stats = (await response.Content.ReadFromJsonAsync<EventStatsDto>(Json, Ct))!;

        stats.Guests.ShouldBe(stats.Guests with { Invitations = 3, People = 6, Opened = 1 });
        stats.Guests.PeopleLimit.ShouldNotBeNull(); // the paid package's maxGuests
        stats.Rsvp.ShouldBe(new RsvpStatsDto(Attending: 1, NotAttending: 1, Pending: 1, AttendingPeople: 4));
        stats.CheckIns.Invitations.ShouldBe(1);
        stats.CheckIns.People.ShouldBe(4);
        stats.CheckIns.ByHour.ShouldHaveSingleItem().People.ShouldBe(4);
        stats.Wishes.ShouldBe(1);
        stats.Gifts.ShouldBe(new GiftStatsDto(1, 250_000));
        stats.Photos.Count.ShouldBe(0);
        stats.Photos.Limit.ShouldNotBeNull();
    }

    [Fact]
    public async Task The_event_list_carries_the_counts_for_the_cards()
    {
        var ev = await PaidEventTodayAsync();
        var family = await CreateAsync(_client, _tenant.Owner, ev.Id, Family("Keluarga Wijaya", 4));
        await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sari", UniquePhone()));
        (await Send(HttpMethod.Post, $"/api/v1/events/{ev.Id}/check-ins", _tenant.Owner,
            new CheckInRequest(family.Invitation.Code, null))).EnsureSuccessStatusCode();
        var empty = await Events.CreateAsync(_client, _tenant.Owner);

        var list = (await (await Send(HttpMethod.Get, "/api/v1/events", _tenant.Owner))
            .Content.ReadFromJsonAsync<List<EventListItemDto>>(Json, Ct))!;

        list.Single(e => e.Id == ev.Id).Counts.ShouldBe(new EventCountsDto(2, 5, 1, 4));
        list.Single(e => e.Id == empty.Id).Counts.ShouldBe(EventCountsDto.None);
        list.ShouldAllBe(e => e.CoverUrl == null);
    }

    [Fact]
    public async Task Stats_are_for_owner_and_admin_of_the_same_organization_only()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var other = await CreateTenantAsync(_client, "Other WO");

        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/stats", _tenant.Owner)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/stats", _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/stats", other.Owner)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
