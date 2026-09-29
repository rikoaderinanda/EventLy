using System.Net;
using System.Net.Http.Json;
using EventLy.Api.Dtos.Users;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;

namespace EventLy.IntegrationTests;

/// <summary>The Owner manages Admin and Staff; Admin and Staff can't.</summary>
public sealed class UsersTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    [Fact]
    public async Task Invited_member_joins_the_owners_organization_on_first_sign_in()
    {
        var tenant = await CreateTenantAsync(_client, "Join WO");

        var users = await (await SendAsync(_client, HttpMethod.Get, "/api/v1/users", tenant.Owner.AccessToken))
            .Content.ReadFromJsonAsync<List<OrganizationUserDto>>(Json, Ct);

        users.ShouldNotBeNull().Select(u => u.Role).ShouldBe([UserRole.Owner, UserRole.Admin, UserRole.Staff], ignoreOrder: true);
        users.ShouldAllBe(u => u.Status == UserStatus.Active);
    }

    [Fact]
    public async Task Invitation_stays_pending_until_first_sign_in_and_can_be_cancelled()
    {
        var tenant = await CreateTenantAsync(_client, "Pending WO");
        var invited = await (await SendAsync(_client, HttpMethod.Post, "/api/v1/users", tenant.Owner.AccessToken,
                new InviteUserRequest("Sari", UniqueEmail("pending"), UserRole.Staff)))
            .Content.ReadFromJsonAsync<OrganizationUserDto>(Json, Ct);
        invited.ShouldNotBeNull().Status.ShouldBe(UserStatus.Invited);

        var cancel = await SendAsync(_client, HttpMethod.Delete, $"/api/v1/users/{invited.Id}", tenant.Owner.AccessToken);
        cancel.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        // A member who already signed in can't be "cancelled", only disabled.
        var cancelActive = await SendAsync(_client, HttpMethod.Delete, $"/api/v1/users/{tenant.Staff.UserId}", tenant.Owner.AccessToken);
        cancelActive.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Staff)]
    public async Task Admin_and_staff_cannot_manage_users(UserRole callerRole)
    {
        var tenant = await CreateTenantAsync(_client, "Strict WO");
        var caller = callerRole == UserRole.Admin ? tenant.Admin : tenant.Staff;

        (await SendAsync(_client, HttpMethod.Get, "/api/v1/users", caller.AccessToken))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await SendAsync(_client, HttpMethod.Post, "/api/v1/users", caller.AccessToken,
                new InviteUserRequest("X", UniqueEmail("x"), UserRole.Staff)))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task An_email_belongs_to_one_organization_only()
    {
        var (a, b) = await TwoTenantsAsync(_client);

        var response = await SendAsync(_client, HttpMethod.Post, "/api/v1/users", b.Owner.AccessToken,
            new InviteUserRequest("Taken", a.Staff.Email, UserRole.Staff));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).ShouldBe("user.email_taken");
    }

    [Fact]
    public async Task Owner_can_only_invite_admin_or_staff()
    {
        var tenant = await CreateTenantAsync(_client, "Roles WO");

        var response = await SendAsync(_client, HttpMethod.Post, "/api/v1/users", tenant.Owner.AccessToken,
            new InviteUserRequest("Second owner", UniqueEmail("owner2"), UserRole.Owner));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Disabling_a_member_ends_their_session()
    {
        var tenant = await CreateTenantAsync(_client, "Disable WO");

        var update = await SendAsync(_client, HttpMethod.Put, $"/api/v1/users/{tenant.Staff.UserId}", tenant.Owner.AccessToken,
            new UpdateUserRequest("Staff member", UserRole.Staff, UserStatus.Disabled));
        update.StatusCode.ShouldBe(HttpStatusCode.OK);

        (await RefreshAsync(_client, tenant.Staff.RefreshToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var signIn = await _client.PostAsJsonAsync("/api/v1/auth/dev-sign-in",
            new EventLy.Api.Dtos.Auth.DevSignInRequest(tenant.Staff.Email, null), Ct);
        signIn.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Changing_a_role_applies_at_the_next_sign_in()
    {
        var tenant = await CreateTenantAsync(_client, "Promote WO");

        await SendAsync(_client, HttpMethod.Put, $"/api/v1/users/{tenant.Staff.UserId}", tenant.Owner.AccessToken,
            new UpdateUserRequest("Staff member", UserRole.Admin, UserStatus.Active));

        (await RefreshAsync(_client, tenant.Staff.RefreshToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await DevSignInAsync(_client, tenant.Staff.Email)).Body.User.Role.ShouldBe(UserRole.Admin);
    }

    [Fact]
    public async Task The_owner_account_cannot_be_changed_through_the_users_api()
    {
        var tenant = await CreateTenantAsync(_client, "Owner WO");

        var response = await SendAsync(_client, HttpMethod.Put, $"/api/v1/users/{tenant.Owner.UserId}", tenant.Owner.AccessToken,
            new UpdateUserRequest("Me", UserRole.Admin, UserStatus.Active));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(response)).ShouldBe("user.owner_immutable");
    }
}
