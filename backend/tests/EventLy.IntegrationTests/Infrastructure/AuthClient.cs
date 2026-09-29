using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using EventLy.Api.Dtos.Auth;
using Shouldly;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>
/// Test helpers around the auth endpoints. The refresh cookie is Secure, so HttpClient's cookie
/// container won't send it over http://localhost; tests carry it by hand, like a browser would.
/// </summary>
public static class AuthClient
{
    public const string CookieName = "evently_rt";

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    public sealed record SignedIn(AuthResponse Body, string RefreshToken, string SetCookieHeader);

    public static async Task<SignedIn> DevSignInAsync(HttpClient client, string email, string? name = null)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/dev-sign-in", new DevSignInRequest(email, name),
            TestContext.Current.CancellationToken);
        return await ReadSignedInAsync(response);
    }

    public static async Task<SignedIn> ReadSignedInAsync(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(Json, TestContext.Current.CancellationToken);
        var setCookie = response.Headers.GetValues("Set-Cookie").Single(h => h.StartsWith(CookieName + "=", StringComparison.Ordinal));
        var token = setCookie[(CookieName.Length + 1)..setCookie.IndexOf(';', StringComparison.Ordinal)];
        return new SignedIn(body.ShouldNotBeNull(), token, setCookie);
    }

    public static Task<HttpResponseMessage> RefreshAsync(HttpClient client, string? refreshToken, bool withCsrfHeader = true) =>
        SendWithCookieAsync(client, "/api/v1/auth/refresh", refreshToken, withCsrfHeader);

    public static Task<HttpResponseMessage> LogoutAsync(HttpClient client, string? refreshToken) =>
        SendWithCookieAsync(client, "/api/v1/auth/logout", refreshToken, withCsrfHeader: true);

    public static Task<HttpResponseMessage> GetMeAsync(HttpClient client, string? accessToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        if (accessToken is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }
        return client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    public static async Task<string?> ProblemCodeAsync(HttpResponseMessage response)
    {
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        return problem.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static Task<HttpResponseMessage> SendWithCookieAsync(
        HttpClient client, string path, string? refreshToken, bool withCsrfHeader)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, path);
        if (refreshToken is not null)
        {
            request.Headers.Add("Cookie", $"{CookieName}={refreshToken}");
        }
        if (withCsrfHeader)
        {
            request.Headers.Add("X-Requested-With", "EventLy");
        }
        return client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
