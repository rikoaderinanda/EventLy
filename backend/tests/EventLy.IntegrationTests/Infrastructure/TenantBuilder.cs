using System.Net.Http.Headers;
using System.Net.Http.Json;
using EventLy.Api.Dtos.Organizations;
using EventLy.Api.Dtos.Users;
using EventLy.Api.Entities;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>A signed-in member of an organization, with the access token to call the API as them.</summary>
public sealed record Member(Guid UserId, string Email, UserRole Role, string AccessToken, string RefreshToken);

/// <summary>One organization with its Owner, one Admin and one Staff, all signed in through the real API.</summary>
public sealed record Tenant(Guid OrganizationId, string Name, Member Owner, Member Admin, Member Staff);

/// <summary>
/// Builds tenants through the public API (sign-in → onboarding → invite → sign-in), so tests exercise
/// the same path as real users. <see cref="TwoTenantsAsync"/> is the reusable isolation fixture:
/// every later phase checks that tenant B gets 404 for tenant A's data.
/// </summary>
public static class TenantBuilder
{
    public const string TermsVersion = "2026-09-29";

    public static string UniqueEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@example.test";

    public static async Task<(Tenant A, Tenant B)> TwoTenantsAsync(HttpClient client) =>
        (await CreateTenantAsync(client, "Santoso WO"), await CreateTenantAsync(client, "Wijaya Events"));

    public static async Task<Tenant> CreateTenantAsync(HttpClient client, string name)
    {
        var owner = await AuthClient.DevSignInAsync(client, UniqueEmail("owner"), $"Owner {name}");
        var created = await CreateOrganizationAsync(client, owner.Body.AccessToken, name);

        var ownerMember = new Member(owner.Body.User.Id, owner.Body.User.Email, UserRole.Owner,
            created.AccessToken, owner.RefreshToken);
        var admin = await AddMemberAsync(client, ownerMember, UserRole.Admin);
        var staff = await AddMemberAsync(client, ownerMember, UserRole.Staff);
        return new Tenant(created.Organization.Id, name, ownerMember, admin, staff);
    }

    public static async Task<CreateOrganizationResponse> CreateOrganizationAsync(
        HttpClient client, string accessToken, string name)
    {
        var response = await SendAsync(client, HttpMethod.Post, "/api/v1/organization", accessToken,
            new CreateOrganizationRequest(name, null, null, AcceptTerms: true, TermsVersion));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CreateOrganizationResponse>(AuthClient.Json,
            TestContext.Current.CancellationToken))!;
    }

    /// <summary>The Owner invites the email, then that person signs in for the first time.</summary>
    public static async Task<Member> AddMemberAsync(HttpClient client, Member owner, UserRole role)
    {
        var email = UniqueEmail(role.ToString().ToLowerInvariant());
        var invite = await SendAsync(client, HttpMethod.Post, "/api/v1/users", owner.AccessToken,
            new InviteUserRequest($"{role} member", email, role));
        invite.EnsureSuccessStatusCode();

        var signedIn = await AuthClient.DevSignInAsync(client, email);
        return new Member(signedIn.Body.User.Id, email, role, signedIn.Body.AccessToken, signedIn.RefreshToken);
    }

    public static Task<HttpResponseMessage> SendAsync(
        HttpClient client, HttpMethod method, string path, string? accessToken, object? body = null)
    {
        var request = new HttpRequestMessage(method, path);
        if (accessToken is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }
        if (body is not null)
        {
            request.Content = JsonContent.Create(body, body.GetType(), options: AuthClient.Json);
        }
        return client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
