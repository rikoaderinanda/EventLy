using EventLy.Api.Dtos.Guests;
using EventLy.Api.Entities;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>Builders and calls for guest and invitation tests.</summary>
public static class GuestRequests
{
    /// <summary>Stands for "a fresh WhatsApp number": numbers are unique per event (Q-55).</summary>
    public const string AnyPhone = "any";

    public static CreateGuestRequest Individual(string name = "Sari", string? phone = AnyPhone,
        IReadOnlyList<Guid>? sessionIds = null) =>
        new(name, phone == AnyPhone ? UniquePhone() : phone, null, GuestType.Individual, 1, sessionIds);

    public static string UniquePhone() => "0812" + Random.Shared.Next(10_000_000, 99_999_999);

    public static CreateGuestRequest Family(string name = "Keluarga Wijaya", int people = 4) =>
        new(name, null, null, GuestType.Group, people, null);

    public static Task<HttpResponseMessage> AddAsync(HttpClient client, Member member, Guid eventId, CreateGuestRequest? request = null) =>
        TenantBuilder.SendAsync(client, HttpMethod.Post, $"/api/v1/events/{eventId}/guests", member.AccessToken,
            request ?? Individual());

    public static async Task<GuestDto> CreateAsync(HttpClient client, Member member, Guid eventId, CreateGuestRequest? request = null) =>
        await PaymentRequests.ReadAsync<GuestDto>(await AddAsync(client, member, eventId, request));

    public static async Task<GuestListDto> ListAsync(HttpClient client, Member member, Guid eventId, string query = "") =>
        await PaymentRequests.ReadAsync<GuestListDto>(await TenantBuilder.SendAsync(client, HttpMethod.Get,
            $"/api/v1/events/{eventId}/guests{query}", member.AccessToken));
}
