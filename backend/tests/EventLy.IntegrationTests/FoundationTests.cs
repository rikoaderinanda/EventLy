using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;

namespace EventLy.IntegrationTests;

/// <summary>Endpoints that work without a database.</summary>
public sealed class FoundationTests : IAsyncLifetime
{
    private readonly ApiFactory _factory = new(ApiFactory.UnusedDatabase);
    private HttpClient _client = null!;

    public ValueTask InitializeAsync()
    {
        _client = _factory.CreateClient();
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    [Fact]
    public async Task Liveness_is_healthy_without_checking_dependencies()
    {
        var response = await _client.GetAsync("/health/live", TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task System_info_returns_service_name_and_environment()
    {
        var info = await _client.GetFromJsonAsync<JsonElement>(
            "/api/v1/system/info", TestContext.Current.CancellationToken);

        info.GetProperty("name").GetString().ShouldBe("EventLy");
        info.GetProperty("environment").GetString().ShouldBe("Testing");
    }

    [Fact]
    public async Task Unknown_api_route_returns_problem_details_404()
    {
        var response = await _client.GetAsync("/api/v1/does-not-exist", TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/problem+json");
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("route.not_found");
    }

    [Fact]
    public async Task Protected_endpoint_without_token_returns_401_problem()
    {
        var response = await _client.GetAsync("/api/v1/auth/me", TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await AuthClient.ProblemCodeAsync(response)).ShouldBe("auth.unauthenticated");
    }

    [Fact]
    public async Task Tampered_access_token_is_rejected()
    {
        var response = await AuthClient.GetMeAsync(_client, "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.forged");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Auth_config_exposes_the_public_google_client_id()
    {
        var config = await _client.GetFromJsonAsync<JsonElement>("/api/v1/auth/config", TestContext.Current.CancellationToken);

        config.GetProperty("googleClientId").GetString().ShouldBe(FakeGoogleTokenValidator.ClientId);
        config.GetProperty("devSignInEnabled").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task Auth_endpoints_are_rate_limited_per_client()
    {
        await using var factory = new ApiFactory(ApiFactory.UnusedDatabase,
            new Dictionary<string, string?> { ["RateLimiting:AuthPermitPerMinute"] = "3" });
        using var client = factory.CreateClient();

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 4; i++)
        {
            statuses.Add((await AuthClient.RefreshAsync(client, refreshToken: null)).StatusCode);
        }

        statuses.ShouldBe([HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized,
            HttpStatusCode.TooManyRequests]);
    }
}
