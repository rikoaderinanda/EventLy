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
}
