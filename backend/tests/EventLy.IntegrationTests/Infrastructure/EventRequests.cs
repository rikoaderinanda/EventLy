using System.Net.Http.Json;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Shouldly;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>Builders and calls for event tests.</summary>
public static class EventRequests
{
    public static readonly DateTime Day = new(2026, 12, 12);

    public static EventSessionInput Akad(Guid? id = null) =>
        new(id, "Akad Nikah", Day.AddHours(8), Day.AddHours(10), "Masjid Agung", null, IsCheckInSession: false);

    public static EventSessionInput Resepsi(Guid? id = null) =>
        new(id, "Resepsi", Day.AddHours(11), Day.AddHours(14), "Gedung Serbaguna",
            "https://maps.google.com/?q=Gedung+Serbaguna", IsCheckInSession: true);

    public static CreateEventRequest Wedding(string name = "Pernikahan Rina & Budi", string timeZone = "Asia/Jakarta") =>
        new(name, EventCategory.Wedding, timeZone, "Rina & Budi mengundang Anda.", [Akad(), Resepsi()]);

    public static async Task<EventDto> CreateAsync(HttpClient client, Member member, CreateEventRequest? request = null)
    {
        var response = await TenantBuilder.SendAsync(client, HttpMethod.Post, "/api/v1/events", member.AccessToken,
            request ?? Wedding());
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<EventDto>(AuthClient.Json, TestContext.Current.CancellationToken))!;
    }

    public static async Task<EventDto> GetAsync(HttpClient client, Member member, Guid id)
    {
        var response = await TenantBuilder.SendAsync(client, HttpMethod.Get, $"/api/v1/events/{id}", member.AccessToken);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<EventDto>(AuthClient.Json, TestContext.Current.CancellationToken))!;
    }

    public static UpdateEventRequest ToUpdate(EventDto e, Func<EventSessionDto, EventSessionInput>? mapSession = null) =>
        new(e.Name, e.Category, e.TimeZone, e.Description,
            [.. e.Sessions.Select(mapSession ?? (s => new EventSessionInput(
                s.Id, s.Name, s.StartsAtLocal, s.EndsAtLocal, s.Venue, s.MapsUrl, s.IsCheckInSession)))],
            e.Version);

    /// <summary>Stands in for a settled payment (Phase 5) by setting the status directly, as that organization.</summary>
    public static async Task SetStatusAsync(PostgresFixture postgres, Guid organizationId, Guid eventId, EventStatus status)
    {
        await using var db = postgres.CreateDbContext(organizationId);
        var updated = await db.Events.Where(e => e.Id == eventId)
            .ExecuteUpdateAsync(s => s.SetProperty(e => e.Status, status), TestContext.Current.CancellationToken);
        updated.ShouldBe(1);
    }
}
