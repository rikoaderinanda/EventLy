using System.Net;
using System.Net.Http.Headers;
using EventLy.Api.Data.Seed;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using ExcelType = MiniExcelLibs.ExcelType;
using MiniExcel = MiniExcelLibs.MiniExcel;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.GuestRequests;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;
using Events = EventLy.IntegrationTests.Infrastructure.EventRequests;

namespace EventLy.IntegrationTests;

/// <summary>
/// Excel guest import (Q-12): all or nothing, row-numbered errors, unique names and numbers (Q-55),
/// the guest limit for the whole file.
/// </summary>
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

    /// <summary>A workbook whose first row is the header.</summary>
    private static byte[] Workbook(params object?[][] rows)
    {
        var sheet = rows.Select(row => row
            .Select((value, i) => (Column: ((char)('A' + i)).ToString(), value))
            .ToDictionary(c => c.Column, c => c.value)).ToList();
        using var stream = new MemoryStream();
        MiniExcel.SaveAs(stream, sheet, printHeader: false, excelType: ExcelType.XLSX);
        return stream.ToArray();
    }

    private Task<HttpResponseMessage> Upload(Guid eventId, byte[] file, Member? member = null, string fileName = "tamu.xlsx")
    {
        var content = new MultipartFormDataContent();
        var part = new ByteArrayContent(file);
        part.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        content.Add(part, "file", fileName);
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/events/{eventId}/guests/import") { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", (member ?? _tenant.Owner).AccessToken);
        return _client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Imports_individuals_and_groups_each_with_an_invitation_for_every_session()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);

        var result = await ReadAsync<GuestImportResultDto>(await Upload(ev.Id, Workbook(
            ["nama", "no hp", "jumlah"],
            ["Budi Santoso", 81234567890d, 1],
            ["Keluarga Wijaya", null, 4]), _tenant.Admin));

        result.Imported.ShouldBe(2);
        result.People.ShouldBe(5);
        result.Errors.ShouldBeEmpty();
        var list = await ListAsync(_client, _tenant.Owner, ev.Id);
        list.Guests.Select(g => (g.Name, g.GuestType, g.NumberOfPeople, g.Phone)).ShouldBe(
            [("Budi Santoso", GuestType.Individual, 1, "081234567890"), ("Keluarga Wijaya", GuestType.Group, 4, null)]);
        list.Guests.ShouldAllBe(g => g.Invitation.Code.Length == 22 && g.SessionIds.Count == ev.Sessions.Count);
    }

    [Fact]
    public async Task Any_wrong_row_imports_nothing_and_every_problem_is_listed()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);

        var result = await ReadAsync<GuestImportResultDto>(await Upload(ev.Id, Workbook(
            ["nama", "telepon", "jumlah"],
            ["Sari", "0812 3456 7890", 1],
            [null, "0813 1111 2222", 1],
            ["Budi", "bukan nomor", 1],
            ["Wijaya", null, "dua"],
            ["Besar", null, 99])));

        result.Imported.ShouldBe(0);
        result.Errors.Select(e => e.Line).ShouldBe([3, 4, 5, 6]);
        result.Errors.Single(e => e.Line == 5).Messages.ShouldHaveSingleItem().ShouldContain("dua");
        (await ListAsync(_client, _tenant.Owner, ev.Id)).Total.ShouldBe(0);
    }

    [Fact]
    public async Task Names_and_numbers_must_be_unique_in_the_file_and_against_the_list()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sudah Ada", phone: "0811 0000 1111"));

        var result = await ReadAsync<GuestImportResultDto>(await Upload(ev.Id, Workbook(
            ["nama", "telepon"],
            ["Budi Santoso", "0812 3456 7890"],
            ["budi  santoso", null],
            ["Sari", "+62 812-3456-7890"],
            ["SUDAH ADA", null],
            ["Wati", "62811 0000 1111"])));

        result.Imported.ShouldBe(0);
        result.Errors.Select(e => (e.Line, e.Messages.Single())).ShouldBe(
        [
            (3, "Nama sama dengan baris 2."),
            (4, "Nomor WhatsApp sama dengan baris 2."),
            (5, "Nama ini sudah ada di daftar tamu."),
            (6, "Nomor WhatsApp ini sudah dipakai tamu lain."),
        ]);
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

        var response = await Upload(ev.Id, Workbook(["nama", "jumlah"], ["Keluarga A", 2], ["Keluarga B", 2]));

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemCodeAsync(response)).ShouldBe("guest.quota_exceeded");
        (await ListAsync(_client, _tenant.Owner, ev.Id)).Total.ShouldBe(1);
    }

    [Fact]
    public async Task Csv_and_broken_files_are_a_400()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);

        foreach (var (file, name) in new[]
                 {
                     ("nama\nSari\n"u8.ToArray(), "tamu.csv"),
                     ("not a zip"u8.ToArray(), "tamu.xlsx"),
                     (Workbook(["telepon"], ["0812 3456 7890"]), "tamu.xlsx"),
                 })
        {
            var response = await Upload(ev.Id, file, fileName: name);
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, name);
            (await ProblemCodeAsync(response)).ShouldBe("guest.import_invalid_file");
        }
    }

    [Fact]
    public async Task The_template_is_an_excel_file_that_imports()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);

        var template = await SendAsync(_client, HttpMethod.Get, $"/api/v1/events/{ev.Id}/guests/import-template", _tenant.Admin.AccessToken);
        template.Content.Headers.ContentType!.MediaType.ShouldBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        var result = await ReadAsync<GuestImportResultDto>(
            await Upload(ev.Id, await template.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)));

        result.Imported.ShouldBe(2);
    }

    [Fact]
    public async Task Staff_and_other_tenants_cannot_import()
    {
        var ev = await Events.CreateAsync(_client, _tenant.Owner);
        var other = await CreateTenantAsync(_client, "Other import WO");
        var file = Workbook(["nama"], ["Sari"]);

        (await Upload(ev.Id, file, _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await Upload(ev.Id, file, other.Owner)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
