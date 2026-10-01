using System.Net;
using System.Net.Http.Json;
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

/// <summary>Invitation themes (Q-62): default from the category, chosen by the Owner, shown to guests.</summary>
public sealed class EventThemeTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
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
        _tenant = await CreateTenantAsync(_client, "Tema WO");
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    [Theory]
    [InlineData(EventCategory.Wedding, InvitationTheme.Elegant)]
    [InlineData(EventCategory.Birthday, InvitationTheme.Birthday)]
    [InlineData(EventCategory.Corporate, InvitationTheme.Corporate)]
    [InlineData(EventCategory.Community, InvitationTheme.Elegant)]
    public async Task A_new_event_gets_the_theme_of_its_category(EventCategory category, InvitationTheme expected)
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner, Events.Wedding() with { Category = category });

        ev.Theme.ShouldBe(expected);
    }

    [Fact]
    public async Task The_owner_chooses_a_theme_and_an_update_without_one_keeps_it()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner, Events.Wedding() with { Theme = InvitationTheme.Corporate });
        ev.Theme.ShouldBe(InvitationTheme.Corporate);

        var renamed = Events.ToUpdate(ev) with { Name = "Resepsi baru" };
        var response = await SendAsync(_client, HttpMethod.Put, $"/api/v1/events/{ev.Id}", _tenant.Owner.AccessToken, renamed);
        response.EnsureSuccessStatusCode();
        (await response.Content.ReadFromJsonAsync<EventDto>(Json, Ct))!.Theme.ShouldBe(InvitationTheme.Corporate);

        var changed = Events.ToUpdate(await Events.GetAsync(_client, _tenant.Owner, ev.Id)) with { Theme = InvitationTheme.Birthday };
        response = await SendAsync(_client, HttpMethod.Put, $"/api/v1/events/{ev.Id}", _tenant.Owner.AccessToken, changed);
        response.EnsureSuccessStatusCode();
        (await response.Content.ReadFromJsonAsync<EventDto>(Json, Ct))!.Theme.ShouldBe(InvitationTheme.Birthday);
    }

    [Fact]
    public async Task An_unknown_theme_is_rejected()
    {
        var response = await SendAsync(_client, HttpMethod.Post, "/api/v1/events", _tenant.Owner.AccessToken,
            Events.Wedding() with { Theme = (InvitationTheme)42 });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task The_guest_page_carries_the_theme()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner, Events.Wedding() with { Category = EventCategory.Birthday });
        var basic = await PackageAsync(_client, _tenant.Owner, "BASIC");
        await PayAsync(_factory, _client, await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, basic.Id));
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sari", UniquePhone()));

        var response = await SendAsync(_client, HttpMethod.Get, $"/api/v1/public/invitations/{guest.Invitation.Code}", null);
        response.EnsureSuccessStatusCode();

        (await response.Content.ReadFromJsonAsync<PublicInvitationDto>(Json, Ct))!.Event.Theme.ShouldBe(InvitationTheme.Birthday);
    }
}
