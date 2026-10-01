using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;
using Events = EventLy.IntegrationTests.Infrastructure.EventRequests;

namespace EventLy.IntegrationTests;

/// <summary>Validation messages follow the app's language: Indonesian by default, English on request.</summary>
public sealed class LocalizationTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Tenant _tenant = null!;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        _tenant = await CreateTenantAsync(_client, "Bahasa WO");
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private async Task<Dictionary<string, string[]>> ErrorsAsync(Guid eventId, CreateGuestRequest request, string? language)
    {
        var message = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/events/{eventId}/guests")
        {
            Content = JsonContent.Create(request, options: AuthClient.Json),
        };
        message.Headers.Authorization = new("Bearer", _tenant.Owner.AccessToken);
        if (language is not null)
        {
            message.Headers.AcceptLanguage.ParseAdd(language);
        }

        var response = await _client.SendAsync(message, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        return problem.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }

    [Fact]
    public async Task Messages_are_indonesian_by_default_and_english_on_request()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var invalid = new CreateGuestRequest("", "telepon", null, GuestType.Group, 1, null);

        foreach (var language in new[] { null, "id-ID,id;q=0.9" })
        {
            var errors = await ErrorsAsync(ev.Id, invalid, language);
            errors["Phone"].ShouldBe(["Masukkan nomor telepon yang valid, misalnya 0812 3456 7890."]);
            errors["NumberOfPeople"].ShouldBe(["Undangan rombongan untuk 2 sampai 50 orang."]);
            // FluentValidation's own Indonesian text, with our field name.
            errors["Name"].Single().ShouldContain("'Nama'");
            errors["Name"].Single().ShouldNotContain("must not be empty");
        }

        var english = await ErrorsAsync(ev.Id, invalid, "en-US,en;q=0.9,id;q=0.8");
        english["Phone"].ShouldBe(["Enter a phone number, for example 0812 3456 7890."]);
        english["Name"].ShouldBe(["'Name' must not be empty."]);
    }
}
