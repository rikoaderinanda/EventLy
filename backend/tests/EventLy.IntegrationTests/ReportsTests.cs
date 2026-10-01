using System.Net;
using System.Text;
using EventLy.Api.Dtos.CheckIns;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Dtos.Public;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using MiniExcel = MiniExcelLibs.MiniExcel;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.GuestRequests;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;
using Events = EventLy.IntegrationTests.Infrastructure.EventRequests;

namespace EventLy.IntegrationTests;

/// <summary>
/// Reports (Phase 10, Q-66 to Q-71): CSV for every package with semicolons and a BOM, Excel only with
/// excelExport, times at the venue, no invitation links, CSV injection neutralised, audited, Owner/Admin only.
/// </summary>
public sealed class ReportsTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private static readonly TimeZoneInfo Jakarta = TimeZoneInfo.FindSystemTimeZoneById("Asia/Jakarta");

    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Tenant _tenant = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        _client = _factory.CreateClient();
        _tenant = await CreateTenantAsync(_client, "Laporan WO");
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private Task<HttpResponseMessage> Send(HttpMethod method, string path, Member? member, object? body = null) =>
        SendAsync(_client, method, path, member?.AccessToken, body);

    private async Task<EventDto> PaidEventTodayAsync(string package)
    {
        var today = TimeZoneInfo.ConvertTime(_factory.Time.GetUtcNow(), Jakarta).Date;
        var ev = await Events.CreateAsync(_client, _tenant.Owner, new CreateEventRequest("Resepsi Rina & Budi",
            EventCategory.Wedding, "Asia/Jakarta", null,
            [new EventSessionInput(null, "Resepsi", today.AddMinutes(1), today.AddHours(23).AddMinutes(58), "Gedung", null, true)]));
        var pkg = await PackageAsync(_client, _tenant.Owner, package);
        await PayAsync(_factory, _client, await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, pkg.Id));
        return ev;
    }

    private static async Task<string> CsvAsync(HttpResponseMessage response)
    {
        var bytes = await response.Content.ReadAsByteArrayAsync(Ct);
        bytes.Take(3).ShouldBe(Encoding.UTF8.GetPreamble(), "UTF-8 with a BOM, so Excel reads the names right");
        return Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
    }

    [Fact]
    public async Task The_guest_report_is_a_semicolon_csv_with_answers_and_check_ins_but_no_links()
    {
        var ev = await PaidEventTodayAsync("BASIC");
        var family = await CreateAsync(_client, _tenant.Owner, ev.Id, Family("Keluarga Wijaya", 4));
        var sari = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sari", "081234567890"));
        (await Send(HttpMethod.Put, $"/api/v1/public/invitations/{sari.Invitation.Code}/rsvp", null,
            new UpdateRsvpRequest(RsvpStatus.NotAttending))).EnsureSuccessStatusCode();
        (await Send(HttpMethod.Post, $"/api/v1/events/{ev.Id}/check-ins", _tenant.Owner,
            new CheckInRequest(family.Invitation.Code, null))).EnsureSuccessStatusCode();

        var response = await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/reports/guests", _tenant.Admin);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("text/csv");
        response.Content.Headers.ContentDisposition!.FileNameStar.ShouldStartWith("resepsi-rina-budi-tamu-");
        var lines = (await CsvAsync(response)).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        lines[0].ShouldBe("Nama;Jenis;Jumlah orang;WhatsApp;Email;Sesi;Status undangan;Dibuka;RSVP;Dijawab;Check-in");
        var wijaya = lines.Single(l => l.StartsWith("Keluarga Wijaya;", StringComparison.Ordinal)).Split(';');
        wijaya[1].ShouldBe("Rombongan");
        wijaya[2].ShouldBe("4");
        wijaya[8].ShouldBe("Hadir", "a check-in sets the RSVP to attending (Q-49)");
        var checkedIn = TimeZoneInfo.ConvertTime(_factory.Time.GetUtcNow(), Jakarta).ToString("yyyy-MM-dd HH:mm");
        wijaya[10].ShouldBe(checkedIn, "times are the venue's wall clock");
        lines.Single(l => l.StartsWith("Sari;", StringComparison.Ordinal)).Split(';')[8].ShouldBe("Tidak hadir");
        string.Join('\n', lines).ShouldNotContain(family.Invitation.Code, customMessage: "the invitation code is the guest's key (Q-69)");
    }

    [Fact]
    public async Task A_cell_that_would_be_a_formula_is_neutralised_in_csv()
    {
        var ev = await PaidEventTodayAsync("BASIC");
        await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("=HYPERLINK(\"x\")", UniquePhone()));

        var csv = await CsvAsync(await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/reports/guests", _tenant.Owner));

        csv.ShouldContain("\"'=HYPERLINK(\"\"x\"\")\";");
    }

    [Fact]
    public async Task Excel_needs_a_package_with_excel_export()
    {
        var basic = await PaidEventTodayAsync("BASIC");

        var refused = await Send(HttpMethod.Get, $"/api/v1/events/{basic.Id}/reports/guests?format=xlsx", _tenant.Owner);
        refused.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await refused.Content.ReadAsStringAsync(Ct)).ShouldContain("report.excel_not_in_package");
        (await Send(HttpMethod.Get, $"/api/v1/events/{basic.Id}/reports", _tenant.Owner)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task The_workbook_has_one_sheet_per_report_with_headers_even_when_empty()
    {
        var ev = await PaidEventTodayAsync("PREMIUM");
        await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Sari", UniquePhone()));

        var response = await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/reports", _tenant.Owner);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var workbook = new MemoryStream(await response.Content.ReadAsByteArrayAsync(Ct));
        MiniExcel.GetSheetNames(workbook).ShouldBe(["Tamu", "Check-in", "Foto", "Ucapan", "Hadiah"]);
        workbook.Position = 0;
        var guests = MiniExcel.Query(workbook, useHeaderRow: true, sheetName: "Tamu").Cast<IDictionary<string, object>>().ToList();
        guests.ShouldHaveSingleItem()["Nama"].ShouldBe("Sari");
        workbook.Position = 0;
        var gifts = MiniExcel.Query(workbook, useHeaderRow: false, sheetName: "Hadiah").Cast<IDictionary<string, object>>().ToList();
        gifts.ShouldHaveSingleItem()["A"].ShouldBe("Pengirim", "an empty sheet still has its header row");
    }

    [Fact]
    public async Task Headers_follow_the_app_language()
    {
        var ev = await PaidEventTodayAsync("BASIC");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/events/{ev.Id}/reports/check-ins");
        request.Headers.Authorization = new("Bearer", _tenant.Owner.AccessToken);
        request.Headers.AcceptLanguage.ParseAdd("en");

        var csv = await CsvAsync(await _client.SendAsync(request, Ct));

        csv.ShouldStartWith("Time;Guest;People;Staff;Method\r\n");
    }

    [Fact]
    public async Task Each_download_is_audited()
    {
        var ev = await PaidEventTodayAsync("BASIC");

        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/reports/gifts", _tenant.Admin)).EnsureSuccessStatusCode();

        await using var db = postgres.CreateDbContext(_tenant.OrganizationId);
        var entry = await db.AuditLogs.SingleAsync(a => a.Action == AuditActions.ReportExported && a.EntityId == ev.Id, Ct);
        entry.UserId.ShouldBe(_tenant.Admin.UserId);
        entry.Metadata.ShouldNotBeNull().ShouldContain("\"gifts\"");
    }

    [Fact]
    public async Task Reports_are_for_owner_and_admin_of_the_organization_only()
    {
        var ev = await PaidEventTodayAsync("BASIC");
        var other = await CreateTenantAsync(_client, "Lain WO");
        var path = $"/api/v1/events/{ev.Id}/reports/guests";

        (await Send(HttpMethod.Get, path, _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await Send(HttpMethod.Get, path, other.Owner)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/reports/unknown", _tenant.Owner)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await Send(HttpMethod.Get, $"{path}?format=pdf", _tenant.Owner)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
