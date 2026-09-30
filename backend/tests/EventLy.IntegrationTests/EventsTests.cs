using System.Net;
using System.Net.Http.Json;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.EventRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;

namespace EventLy.IntegrationTests;

public sealed class EventsTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
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
        _tenant = await CreateTenantAsync(_client, "Events WO");
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

    [Fact]
    public async Task Creates_a_draft_wedding_with_akad_and_resepsi_in_local_time()
    {
        var created = await CreateAsync(_client, _tenant.Owner);

        created.Status.ShouldBe(EventStatus.Draft);
        created.Sessions.Select(s => s.Name).ShouldBe(["Akad Nikah", "Resepsi"]);
        // The event date/venue are the check-in session's (the resepsi), 11:00 WIB = 04:00 UTC.
        created.Date.ShouldBe(new DateTimeOffset(2026, 12, 12, 4, 0, 0, TimeSpan.Zero));
        created.Venue.ShouldBe("Gedung Serbaguna");
        var resepsi = created.Sessions.Single(s => s.IsCheckInSession);
        resepsi.StartsAtLocal.ShouldBe(Day.AddHours(11));
        resepsi.MapsUrl.ShouldStartWith("https://");
    }

    [Theory]
    [InlineData("Asia/Jakarta", 4)]  // WIB  = UTC+7
    [InlineData("Asia/Makassar", 3)] // WITA = UTC+8
    [InlineData("Asia/Jayapura", 2)] // WIT  = UTC+9
    public async Task Session_times_are_converted_with_the_event_time_zone(string timeZone, int utcHour)
    {
        var created = await CreateAsync(_client, _tenant.Owner, Wedding(timeZone: timeZone));

        created.Date.UtcDateTime.Hour.ShouldBe(utcHour);
        created.Sessions.Single(s => s.IsCheckInSession).StartsAtLocal.Hour.ShouldBe(11);
    }

    public static TheoryData<string, CreateEventRequest> InvalidRequests => new()
    {
        { "no check-in session", Wedding() with { Sessions = [Akad()] } },
        { "two check-in sessions", Wedding() with { Sessions = [Resepsi(), Resepsi()] } },
        { "ends before it starts", Wedding() with { Sessions = [Resepsi() with { EndsAtLocal = Day }] } },
        { "unsupported time zone", Wedding(timeZone: "Europe/Paris") },
        { "non-https maps link", Wedding() with { Sessions = [Resepsi() with { MapsUrl = "http://maps.test" }] } },
        { "empty name", Wedding(name: "") },
    };

    [Theory]
    [MemberData(nameof(InvalidRequests))]
    public async Task Invalid_events_are_rejected(string reason, CreateEventRequest request)
    {
        var response = await Send(HttpMethod.Post, "/api/v1/events", _tenant.Owner, request);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, reason);
        (await ProblemCodeAsync(response)).ShouldBe("validation.failed");
    }

    [Fact]
    public async Task Admin_can_manage_events_but_staff_cannot_create_them()
    {
        (await CreateAsync(_client, _tenant.Admin)).Status.ShouldBe(EventStatus.Draft);
        (await Send(HttpMethod.Post, "/api/v1/events", _tenant.Staff, Wedding())).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Editing_keeps_existing_sessions_adds_new_ones_and_removes_missing_ones()
    {
        var created = await CreateAsync(_client, _tenant.Owner);
        var akad = created.Sessions.Single(s => s.Name == "Akad Nikah");
        var resepsi = created.Sessions.Single(s => s.IsCheckInSession);

        var update = ToUpdate(created) with
        {
            Sessions =
            [
                Resepsi(resepsi.Id) with { Venue = "Hotel Mulia" },
                new EventSessionInput(null, "Ngunduh Mantu", Day.AddDays(1).AddHours(10), Day.AddDays(1).AddHours(12),
                    "Rumah Keluarga", null, IsCheckInSession: false),
            ],
        };
        var response = await Send(HttpMethod.Put, $"/api/v1/events/{created.Id}", _tenant.Owner, update);
        var updated = await response.Content.ReadFromJsonAsync<EventDto>(Json, Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        updated.ShouldNotBeNull().Sessions.Select(s => s.Name).ShouldBe(["Resepsi", "Ngunduh Mantu"]);
        updated.Sessions[0].Id.ShouldBe(resepsi.Id);
        updated.Sessions.ShouldNotContain(s => s.Id == akad.Id);
        updated.Venue.ShouldBe("Hotel Mulia");
    }

    [Fact]
    public async Task The_check_in_flag_can_move_to_another_session()
    {
        var created = await CreateAsync(_client, _tenant.Owner);

        var update = ToUpdate(created, s => new EventSessionInput(
            s.Id, s.Name, s.StartsAtLocal, s.EndsAtLocal, s.Venue, s.MapsUrl, IsCheckInSession: !s.IsCheckInSession));
        var response = await Send(HttpMethod.Put, $"/api/v1/events/{created.Id}", _tenant.Owner, update);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<EventDto>(Json, Ct))!.Venue.ShouldBe("Masjid Agung");
    }

    [Fact]
    public async Task A_stale_version_is_refused_instead_of_overwriting()
    {
        var created = await CreateAsync(_client, _tenant.Owner);
        var first = await Send(HttpMethod.Put, $"/api/v1/events/{created.Id}", _tenant.Owner, ToUpdate(created) with { Name = "Versi A" });
        first.StatusCode.ShouldBe(HttpStatusCode.OK);

        var second = await Send(HttpMethod.Put, $"/api/v1/events/{created.Id}", _tenant.Admin, ToUpdate(created) with { Name = "Versi B" });

        second.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(second)).ShouldBe("event.modified_elsewhere");
        (await GetAsync(_client, _tenant.Owner, created.Id)).Name.ShouldBe("Versi A");
    }

    [Fact]
    public async Task Only_drafts_and_cancelled_events_can_be_deleted()
    {
        var draft = await CreateAsync(_client, _tenant.Owner);
        var active = await CreateAsync(_client, _tenant.Owner);
        await SetStatusAsync(postgres, _tenant.OrganizationId, active.Id, EventStatus.Active);

        (await Send(HttpMethod.Delete, $"/api/v1/events/{draft.Id}", _tenant.Owner)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await Send(HttpMethod.Get, $"/api/v1/events/{draft.Id}", _tenant.Owner)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var list = await (await Send(HttpMethod.Get, "/api/v1/events", _tenant.Owner)).Content
            .ReadFromJsonAsync<List<EventListItemDto>>(Json, Ct);
        list.ShouldNotBeNull().ShouldNotContain(e => e.Id == draft.Id);

        var deleteActive = await Send(HttpMethod.Delete, $"/api/v1/events/{active.Id}", _tenant.Owner);
        deleteActive.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(deleteActive)).ShouldBe("event.not_deletable");
    }

    [Fact]
    public async Task Only_the_owner_can_cancel_and_a_cancelled_event_is_read_only()
    {
        var created = await CreateAsync(_client, _tenant.Owner);

        (await Send(HttpMethod.Post, $"/api/v1/events/{created.Id}/cancel", _tenant.Admin)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var cancelled = await (await Send(HttpMethod.Post, $"/api/v1/events/{created.Id}/cancel", _tenant.Owner))
            .Content.ReadFromJsonAsync<EventDto>(Json, Ct);
        cancelled.ShouldNotBeNull().Status.ShouldBe(EventStatus.Cancelled);

        var edit = await Send(HttpMethod.Put, $"/api/v1/events/{created.Id}", _tenant.Owner, ToUpdate(cancelled));
        edit.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(edit)).ShouldBe("event.not_editable");
    }

    [Fact]
    public async Task Only_an_active_event_can_be_completed()
    {
        var created = await CreateAsync(_client, _tenant.Owner);

        var fromDraft = await Send(HttpMethod.Post, $"/api/v1/events/{created.Id}/complete", _tenant.Admin);
        fromDraft.StatusCode.ShouldBe(HttpStatusCode.Conflict);

        await SetStatusAsync(postgres, _tenant.OrganizationId, created.Id, EventStatus.Active);
        var completed = await (await Send(HttpMethod.Post, $"/api/v1/events/{created.Id}/complete", _tenant.Admin))
            .Content.ReadFromJsonAsync<EventDto>(Json, Ct);
        completed.ShouldNotBeNull().Status.ShouldBe(EventStatus.Completed);
    }

    [Fact]
    public async Task Staff_see_only_the_events_they_are_assigned_to()
    {
        var assigned = await CreateAsync(_client, _tenant.Owner, Wedding("Assigned wedding"));
        var other = await CreateAsync(_client, _tenant.Owner, Wedding("Other wedding"));

        var assign = await Send(HttpMethod.Put, $"/api/v1/events/{assigned.Id}/staff", _tenant.Owner,
            new AssignStaffRequest([_tenant.Staff.UserId]));
        assign.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await assign.Content.ReadFromJsonAsync<List<EventStaffDto>>(Json, Ct)).ShouldNotBeNull()
            .ShouldHaveSingleItem().UserId.ShouldBe(_tenant.Staff.UserId);

        var staffList = await (await Send(HttpMethod.Get, "/api/v1/events", _tenant.Staff)).Content
            .ReadFromJsonAsync<List<EventListItemDto>>(Json, Ct);
        staffList.ShouldNotBeNull().Select(e => e.Id).ShouldBe([assigned.Id]);
        (await Send(HttpMethod.Get, $"/api/v1/events/{assigned.Id}", _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Send(HttpMethod.Get, $"/api/v1/events/{other.Id}", _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // Unassigning removes access again.
        await Send(HttpMethod.Put, $"/api/v1/events/{assigned.Id}/staff", _tenant.Owner, new AssignStaffRequest([]));
        (await Send(HttpMethod.Get, $"/api/v1/events/{assigned.Id}", _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Only_active_staff_of_the_organization_can_be_assigned_and_only_by_the_owner()
    {
        var created = await CreateAsync(_client, _tenant.Owner);
        var otherTenant = await CreateTenantAsync(_client, "Other WO");

        (await Send(HttpMethod.Put, $"/api/v1/events/{created.Id}/staff", _tenant.Admin,
            new AssignStaffRequest([_tenant.Staff.UserId]))).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        foreach (var notStaff in new[] { _tenant.Admin.UserId, otherTenant.Staff.UserId, Guid.CreateVersion7() })
        {
            var response = await Send(HttpMethod.Put, $"/api/v1/events/{created.Id}/staff", _tenant.Owner,
                new AssignStaffRequest([notStaff]));
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await ProblemCodeAsync(response)).ShouldBe("event.invalid_staff");
        }
    }
}
