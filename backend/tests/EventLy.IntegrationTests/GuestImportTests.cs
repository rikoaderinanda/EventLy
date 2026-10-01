using System.Net;
using System.Net.Http.Headers;
using System.Text;
using EventLy.Api.Data.Seed;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.GuestRequests;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;
using Events = EventLy.IntegrationTests.Infrastructure.EventRequests;

namespace EventLy.IntegrationTests;

/// <summary>CSV guest import (Q-12): all or nothing, line-numbered errors, the guest limit for the whole file.</summary>
public sealed class GuestImportTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Tenant _tenant = null!;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        _tenant = await CreateTenantAsync(_client, "Import WO");
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private Task<HttpResponseMessage> Upload(Guid eventId, string csv, Member? member = null)
    {
        var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes(csv));
        file.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
        content.Add(file, "file", "tamu.csv");
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/events/{eventId}/guests/import") { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", (member ?? _tenant.Owner).AccessToken);
        return _client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Imports_individuals_and_groups_each_with_an_invitation_for_every_session()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);

        var result = await ReadAsync<GuestImportResultDto>(await Upload(ev.Id,
            "nama;no hp;jumlah\nBudi Santoso;0812 3456 7890;1\nKeluarga Wijaya;;4\n", _tenant.Admin));

        result.Imported.ShouldBe(2);
        result.People.ShouldBe(5);
        result.Errors.ShouldBeEmpty();
        var list = await ListAsync(_client, _tenant.Owner, ev.Id);
        list.Guests.Select(g => (g.Name, g.GuestType, g.NumberOfPeople)).ShouldBe(
            [("Budi Santoso", GuestType.Individual, 1), ("Keluarga Wijaya", GuestType.Group, 4)]);
        list.Guests.ShouldAllBe(g => g.Invitation.Code.Length == 22 && g.SessionIds.Count == ev.Sessions.Count);
    }

    [Fact]
    public async Task Any_wrong_line_imports_nothing_and_every_problem_is_listed()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);

        var result = await ReadAsync<GuestImportResultDto>(await Upload(ev.Id,
            "nama,telepon,jumlah\nSari,0812 3456 7890,1\n,0813 1111 2222,1\nBudi,bukan nomor,1\nWijaya,,dua\nBesar,,99\n"));

        result.Imported.ShouldBe(0);
        result.Errors.Select(e => e.Line).ShouldBe([3, 4, 5, 6]);
        result.Errors.Single(e => e.Line == 5).Messages.ShouldHaveSingleItem().ShouldContain("dua");
        (await ListAsync(_client, _tenant.Owner, ev.Id)).Total.ShouldBe(0);
    }

    [Fact]
    public async Task The_guest_limit_applies_to_the_whole_file()
    {
        var root = (await DevSignInAsync(_client, ApiFactory.RootEmail)).Body.AccessToken;
        var features = PackageSeed.Initial()[0].Features.Copy();
        features.MaxGuests = 4;
        var package = await ReadAsync<PackageDto>(await SendAsync(_client, HttpMethod.Post, "/api/v1/platform/packages", root,
            new CreatePackageRequest("IMP" + Guid.NewGuid().ToString("N")[..8], "Kecil", 100_000m, "IDR", features, true)));
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        await PayAsync(_factory, _client, await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, package.Id));
        await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sudah ada"));

        var response = await Upload(ev.Id, "nama,jumlah\nKeluarga A,2\nKeluarga B,2\n");

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemCodeAsync(response)).ShouldBe("guest.quota_exceeded");
        (await ListAsync(_client, _tenant.Owner, ev.Id)).Total.ShouldBe(1);
    }

    [Theory]
    [InlineData("")]
    [InlineData("telepon\n0812\n")]
    public async Task Unusable_files_are_a_400(string csv)
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);

        var response = await Upload(ev.Id, csv);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemCodeAsync(response)).ShouldBe("guest.import_invalid_file");
    }

    [Fact]
    public async Task Staff_and_other_tenants_cannot_import()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var other = await CreateTenantAsync(_client, "Other import WO");

        (await Upload(ev.Id, "nama\nSari\n", _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await Upload(ev.Id, "nama\nSari\n", other.Owner)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
