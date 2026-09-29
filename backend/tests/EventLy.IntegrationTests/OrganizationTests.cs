using System.Net;
using System.Net.Http.Json;
using EventLy.Api.Dtos.Organizations;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;

namespace EventLy.IntegrationTests;

/// <summary>Onboarding and the organization profile.</summary>
public sealed class OrganizationTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
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
    public async Task Onboarding_creates_the_organization_and_reissues_the_token_with_org_id()
    {
        var owner = await DevSignInAsync(_client, UniqueEmail("owner"));

        var created = await CreateOrganizationAsync(_client, owner.Body.AccessToken, "Santoso Wedding Organizer");

        created.Organization.Name.ShouldBe("Santoso Wedding Organizer");
        created.Organization.Status.ShouldBe(OrganizationStatus.Active);
        created.User.OrganizationId.ShouldBe(created.Organization.Id);
        new JsonWebToken(created.AccessToken).GetClaim("org_id").Value.ShouldBe(created.Organization.Id.ToString());

        await using var db = postgres.CreateDbContext();
        var user = await db.Users.SingleAsync(u => u.Id == owner.Body.User.Id, Ct);
        user.TermsVersion.ShouldBe(TermsVersion);
        user.TermsAcceptedAt.ShouldNotBeNull();
        (await db.AuditLogs.AnyAsync(a => a.OrganizationId == created.Organization.Id
            && a.Action == AuditActions.OrganizationCreated, Ct)).ShouldBeTrue();
    }

    [Fact]
    public async Task A_refresh_after_onboarding_also_carries_the_organization()
    {
        var owner = await DevSignInAsync(_client, UniqueEmail("owner"));
        var created = await CreateOrganizationAsync(_client, owner.Body.AccessToken, "Refresh WO");

        var refreshed = await ReadSignedInAsync(await RefreshAsync(_client, owner.RefreshToken));

        refreshed.Body.User.OrganizationId.ShouldBe(created.Organization.Id);
    }

    [Fact]
    public async Task An_owner_can_have_only_one_organization()
    {
        var owner = await DevSignInAsync(_client, UniqueEmail("owner"));
        var created = await CreateOrganizationAsync(_client, owner.Body.AccessToken, "First");

        var second = await SendAsync(_client, HttpMethod.Post, "/api/v1/organization", created.AccessToken,
            new CreateOrganizationRequest("Second", null, null, true, TermsVersion));

        second.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(second)).ShouldBe("organization.already_exists");
    }

    [Fact]
    public async Task Terms_must_be_accepted_in_their_current_version()
    {
        var owner = await DevSignInAsync(_client, UniqueEmail("owner"));

        var notAccepted = await SendAsync(_client, HttpMethod.Post, "/api/v1/organization", owner.Body.AccessToken,
            new CreateOrganizationRequest("WO", null, null, AcceptTerms: false, TermsVersion));
        var outdated = await SendAsync(_client, HttpMethod.Post, "/api/v1/organization", owner.Body.AccessToken,
            new CreateOrganizationRequest("WO", null, null, AcceptTerms: true, "2020-01-01"));

        notAccepted.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        outdated.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(outdated)).ShouldBe("legal.terms_outdated");
    }

    [Fact]
    public async Task Only_an_owner_can_create_an_organization()
    {
        var root = await DevSignInAsync(_client, ApiFactory.RootEmail);

        var response = await SendAsync(_client, HttpMethod.Post, "/api/v1/organization", root.Body.AccessToken,
            new CreateOrganizationRequest("Root Org", null, null, true, TermsVersion));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Owner_before_onboarding_gets_organization_required()
    {
        var owner = await DevSignInAsync(_client, UniqueEmail("owner"));

        var response = await SendAsync(_client, HttpMethod.Get, "/api/v1/organization", owner.Body.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(response)).ShouldBe("organization.required");
    }

    [Fact]
    public async Task Members_can_read_the_profile_but_only_the_owner_can_change_it()
    {
        var tenant = await CreateTenantAsync(_client, "Profile WO");

        foreach (var member in new[] { tenant.Owner, tenant.Admin, tenant.Staff })
        {
            var profile = await (await SendAsync(_client, HttpMethod.Get, "/api/v1/organization", member.AccessToken))
                .Content.ReadFromJsonAsync<OrganizationDto>(Json, Ct);
            profile.ShouldNotBeNull().Id.ShouldBe(tenant.OrganizationId);
        }

        var update = new UpdateOrganizationRequest("Profile WO (baru)", "halo@profilewo.test", "+62 812-3456-7890");
        (await SendAsync(_client, HttpMethod.Put, "/api/v1/organization", tenant.Admin.AccessToken, update))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var updated = await (await SendAsync(_client, HttpMethod.Put, "/api/v1/organization", tenant.Owner.AccessToken, update))
            .Content.ReadFromJsonAsync<OrganizationDto>(Json, Ct);
        updated.ShouldNotBeNull().Name.ShouldBe("Profile WO (baru)");
        updated.ContactPhone.ShouldBe("+62 812-3456-7890");
    }
}
