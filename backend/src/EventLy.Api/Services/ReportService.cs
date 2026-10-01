using System.Data;
using System.Globalization;
using System.Text;
using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Common.Localization;
using EventLy.Api.Data;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using MiniExcelLibs;

namespace EventLy.Api.Services;

public enum ReportKind
{
    Guests,
    CheckIns,
    Photos,
    Wishes,
    Gifts,
}

public enum ReportFormat
{
    Csv,
    Xlsx,
}

/// <summary>One sheet of a report: localized column names and the rows (dates already in the venue's time).</summary>
public sealed record ReportTable(string Name, IReadOnlyList<string> Columns, IReadOnlyList<object?[]> Rows);

public sealed record ReportFile(byte[] Content, string ContentType, string FileName);

/// <summary>
/// Event reports for Owner/Admin (Phase 10, Q-66 to Q-71): guests, check-ins, photos, wishes and gift
/// confirmations, as CSV (every package) or Excel (packages with <c>excelExport</c>, Q-2). Times are written in
/// the event's time zone; invitation links are left out on purpose (the code is the guest's key, Q-69).
/// Every download is audited.
/// </summary>
public sealed class ReportService(AppDbContext db, ICurrentUser currentUser, AuditService audit, TimeProvider timeProvider)
{
    public const string CsvContentType = "text/csv; charset=utf-8";
    public const string XlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    public async Task<ReportFile> ExportAsync(Guid eventId, ReportKind kind, ReportFormat format, CancellationToken ct)
    {
        var ev = await LoadAsync(eventId, format, ct);
        var table = await BuildAsync(ev, kind, ct);
        var file = format == ReportFormat.Xlsx
            ? new ReportFile(Xlsx([table]), XlsxContentType, FileName(ev, Slug(kind), "xlsx"))
            : new ReportFile(Csv(table), CsvContentType, FileName(ev, Slug(kind), "csv"));
        await AuditAsync(ev, Key(kind), format, ct);
        return file;
    }

    /// <summary>All reports in one workbook, one sheet each (Q-70). Excel only.</summary>
    public async Task<ReportFile> ExportAllAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await LoadAsync(eventId, ReportFormat.Xlsx, ct);
        var tables = new List<ReportTable>();
        foreach (var kind in Enum.GetValues<ReportKind>())
        {
            tables.Add(await BuildAsync(ev, kind, ct));
        }
        await AuditAsync(ev, "all", ReportFormat.Xlsx, ct);
        return new ReportFile(Xlsx(tables), XlsxContentType, FileName(ev, Texts.T("laporan", "reports"), "xlsx"));
    }

    private async Task<Event> LoadAsync(Guid eventId, ReportFormat format, CancellationToken ct)
    {
        var ev = await db.Events.AsNoTracking().SingleOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw new NotFoundException("event.not_found", "Event not found.");
        if (format == ReportFormat.Xlsx && ev.PackageSnapshot?.Features.ExcelExport != true)
        {
            throw new ForbiddenException("report.excel_not_in_package", "Excel export isn't part of this event's package; download CSV instead.");
        }
        return ev;
    }

    private async Task AuditAsync(Event ev, string kind, ReportFormat format, CancellationToken ct)
    {
        audit.Add(AuditActions.ReportExported, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id,
            new { kind, format = format.ToString().ToLowerInvariant() });
        await db.SaveChangesAsync(ct);
    }

    private Task<ReportTable> BuildAsync(Event ev, ReportKind kind, CancellationToken ct)
    {
        var zone = EventTimeZones.Find(ev.TimeZone);
        return kind switch
        {
            ReportKind.Guests => GuestsAsync(ev, zone, ct),
            ReportKind.CheckIns => CheckInsAsync(ev, zone, ct),
            ReportKind.Photos => PhotosAsync(ev, ct),
            ReportKind.Wishes => WishesAsync(ev, zone, ct),
            ReportKind.Gifts => GiftsAsync(ev, zone, ct),
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };
    }

    private async Task<ReportTable> GuestsAsync(Event ev, TimeZoneInfo zone, CancellationToken ct)
    {
        var sessionNames = await db.EventSessions.AsNoTracking().Where(s => s.EventId == ev.Id)
            .ToDictionaryAsync(s => s.Id, s => s.Name, ct);
        var guests = await (
                from g in db.Guests.AsNoTracking()
                join i in db.Invitations.AsNoTracking() on g.Id equals i.GuestId
                where g.EventId == ev.Id
                orderby g.Name
                select new
                {
                    g.Name,
                    g.Type,
                    g.NumberOfPeople,
                    g.Phone,
                    g.Email,
                    Sessions = g.Sessions.Select(s => s.SessionId).ToList(),
                    i.Status,
                    i.OpenedAt,
                    Rsvp = db.Rsvps.Where(r => r.InvitationId == i.Id).Select(r => new { r.Status, r.RespondedAt }).FirstOrDefault(),
                    CheckedInAt = db.CheckIns.Where(c => c.InvitationId == i.Id).Select(c => (DateTimeOffset?)c.CheckedInAt).FirstOrDefault(),
                })
            .ToListAsync(ct);

        return new ReportTable(
            Texts.T("Tamu", "Guests"),
            [
                Texts.T("Nama", "Name"), Texts.T("Jenis", "Type"), Texts.T("Jumlah orang", "People"), "WhatsApp", "Email",
                Texts.T("Sesi", "Sessions"), Texts.T("Status undangan", "Invitation status"), Texts.T("Dibuka", "Opened"),
                "RSVP", Texts.T("Dijawab", "Answered"), Texts.T("Check-in", "Checked in"),
            ],
            [
                .. guests.Select(g => new object?[]
                {
                    g.Name,
                    g.Type == GuestType.Group ? Texts.T("Rombongan", "Group") : Texts.T("Perorangan", "Individual"),
                    g.NumberOfPeople,
                    g.Phone,
                    g.Email,
                    string.Join(", ", g.Sessions.Select(id => sessionNames.GetValueOrDefault(id)).Where(n => n is not null)),
                    g.Status == InvitationStatus.Active ? Texts.T("Aktif", "Active") : Texts.T("Dicabut", "Revoked"),
                    Local(g.OpenedAt, zone),
                    RsvpText(g.Rsvp?.Status ?? RsvpStatus.Pending),
                    Local(g.Rsvp?.RespondedAt, zone),
                    Local(g.CheckedInAt, zone),
                }),
            ]);
    }

    private async Task<ReportTable> CheckInsAsync(Event ev, TimeZoneInfo zone, CancellationToken ct)
    {
        var rows = await (
                from c in db.CheckIns.AsNoTracking()
                join i in db.Invitations.AsNoTracking() on c.InvitationId equals i.Id
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                join u in db.Users.AsNoTracking() on c.CheckedInBy equals u.Id
                where c.EventId == ev.Id
                orderby c.CheckedInAt
                select new { c.CheckedInAt, g.Name, g.NumberOfPeople, Staff = u.Name, c.Method })
            .ToListAsync(ct);

        return new ReportTable(
            Texts.T("Check-in", "Check-ins"),
            [Texts.T("Waktu", "Time"), Texts.T("Tamu", "Guest"), Texts.T("Jumlah orang", "People"), Texts.T("Petugas", "Staff"), Texts.T("Metode", "Method")],
            [
                .. rows.Select(r => new object?[]
                {
                    Local(r.CheckedInAt, zone),
                    r.Name,
                    r.NumberOfPeople,
                    r.Staff,
                    r.Method == CheckInMethod.Scan ? Texts.T("Scan QR", "QR scan") : Texts.T("Cari nama", "Name search"),
                }),
            ]);
    }

    private async Task<ReportTable> PhotosAsync(Event ev, CancellationToken ct)
    {
        var rows = await (
                from p in db.Photos.AsNoTracking()
                join i in db.Invitations.AsNoTracking() on p.InvitationId equals i.Id
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where p.EventId == ev.Id
                group p by g.Name into byGuest
                orderby byGuest.Key
                select new
                {
                    Name = byGuest.Key,
                    Total = byGuest.Count(),
                    Guest = byGuest.Count(p => p.Source == PhotoSource.Guest),
                    Bytes = byGuest.Sum(p => p.SizeBytes),
                })
            .ToListAsync(ct);

        return new ReportTable(
            Texts.T("Foto", "Photos"),
            [Texts.T("Tamu", "Guest"), Texts.T("Jumlah foto", "Photos"), Texts.T("Dari petugas", "By staff"), Texts.T("Dari tamu", "By the guest"), Texts.T("Ukuran (MB)", "Size (MB)")],
            [.. rows.Select(r => new object?[] { r.Name, r.Total, r.Total - r.Guest, r.Guest, Math.Round(r.Bytes / 1024m / 1024m, 1) })]);
    }

    private async Task<ReportTable> WishesAsync(Event ev, TimeZoneInfo zone, CancellationToken ct)
    {
        var rows = await (
                from w in db.Wishes.AsNoTracking()
                join i in db.Invitations.AsNoTracking() on w.InvitationId equals i.Id
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where w.EventId == ev.Id
                orderby w.UpdatedAt
                select new { g.Name, w.Message, w.IsHidden, w.UpdatedAt })
            .ToListAsync(ct);

        return new ReportTable(
            Texts.T("Ucapan", "Wishes"),
            [Texts.T("Tamu", "Guest"), Texts.T("Ucapan", "Wish"), Texts.T("Disembunyikan", "Hidden"), Texts.T("Waktu", "Time")],
            [.. rows.Select(r => new object?[] { r.Name, r.Message, r.IsHidden ? Texts.T("Ya", "Yes") : Texts.T("Tidak", "No"), Local(r.UpdatedAt, zone) })]);
    }

    private async Task<ReportTable> GiftsAsync(Event ev, TimeZoneInfo zone, CancellationToken ct)
    {
        var rows = await (
                from c in db.GiftConfirmations.AsNoTracking()
                join i in db.Invitations.AsNoTracking() on c.InvitationId equals i.Id
                join g in db.Guests.AsNoTracking() on i.GuestId equals g.Id
                where c.EventId == ev.Id
                orderby c.CreatedAt
                select new { c.SenderName, Guest = g.Name, c.Amount, c.Note, c.CreatedAt })
            .ToListAsync(ct);

        return new ReportTable(
            Texts.T("Hadiah", "Gifts"),
            [Texts.T("Pengirim", "Sender"), Texts.T("Undangan", "Invitation"), Texts.T("Jumlah (Rp)", "Amount (IDR)"), Texts.T("Catatan", "Note"), Texts.T("Waktu", "Time")],
            [.. rows.Select(r => new object?[] { r.SenderName, r.Guest, r.Amount, r.Note, Local(r.CreatedAt, zone) })]);
    }

    private static string RsvpText(RsvpStatus status) => status switch
    {
        RsvpStatus.Attending => Texts.T("Hadir", "Attending"),
        RsvpStatus.NotAttending => Texts.T("Tidak hadir", "Not attending"),
        _ => Texts.T("Belum menjawab", "No answer"),
    };

    /// <summary>The venue's wall-clock time, without offset (Excel shows it as written).</summary>
    private static DateTime? Local(DateTimeOffset? at, TimeZoneInfo zone) =>
        at is { } value ? TimeZoneInfo.ConvertTime(value, zone).DateTime : null;

    /// <summary>The report's stable name, as in the URL, for the audit log (not translated).</summary>
    private static string Key(ReportKind kind) => kind switch
    {
        ReportKind.Guests => "guests",
        ReportKind.CheckIns => "check-ins",
        ReportKind.Photos => "photos",
        ReportKind.Wishes => "wishes",
        _ => "gifts",
    };

    /// <summary>The report's name in the downloaded file name, in the app language.</summary>
    private static string Slug(ReportKind kind) => kind switch
    {
        ReportKind.Guests => Texts.T("tamu", "guests"),
        ReportKind.CheckIns => "check-in",
        ReportKind.Photos => Texts.T("foto", "photos"),
        ReportKind.Wishes => Texts.T("ucapan", "wishes"),
        _ => Texts.T("hadiah", "gifts"),
    };

    private string FileName(Event ev, string kind, string extension)
    {
        var name = new string([.. ev.Name.ToLowerInvariant().Select(c => char.IsAsciiLetterOrDigit(c) ? c : '-')]);
        while (name.Contains("--", StringComparison.Ordinal))
        {
            name = name.Replace("--", "-", StringComparison.Ordinal);
        }
        name = name.Trim('-');
        var today = timeProvider.GetUtcNow().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        return $"{(name.Length == 0 ? "acara" : name[..Math.Min(name.Length, 60)])}-{kind}-{today}.{extension}";
    }

    /// <summary>
    /// CSV for Excel set to Indonesian (Q-67): UTF-8 with a BOM, semicolons, CRLF, quotes where needed.
    /// A cell starting with = + - @ (a formula when opened in Excel) gets a leading apostrophe (CSV injection).
    /// </summary>
    public static byte[] Csv(ReportTable table)
    {
        var text = new StringBuilder();
        text.Append(string.Join(';', table.Columns.Select(Escape))).Append("\r\n");
        foreach (var row in table.Rows)
        {
            text.Append(string.Join(';', row.Select(cell => Escape(CsvValue(cell))))).Append("\r\n");
        }
        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(text.ToString())];
    }

    private static string CsvValue(object? cell) => cell switch
    {
        null => "",
        DateTime d => d.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
        // Indonesian Excel reads a decimal comma.
        decimal m => m.ToString("0.##", Texts.Indonesian),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => cell.ToString() ?? "",
    };

    private static string Escape(string value)
    {
        if (value.Length > 0 && value[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
        {
            value = "'" + value;
        }
        return value.IndexOfAny([';', '"', '\n', '\r']) >= 0 ? $"\"{value.Replace("\"", "\"\"", StringComparison.Ordinal)}\"" : value;
    }

    /// <summary>One workbook, one sheet per table. A DataTable keeps the header row even when a sheet is empty.</summary>
    public static byte[] Xlsx(IReadOnlyList<ReportTable> tables)
    {
        var sheets = new Dictionary<string, object>();
        foreach (var table in tables)
        {
            var data = new DataTable(table.Name);
            for (var c = 0; c < table.Columns.Count; c++)
            {
                var type = table.Rows.Select(r => r[c]).FirstOrDefault(v => v is not null)?.GetType() ?? typeof(string);
                data.Columns.Add(table.Columns[c], type);
            }
            foreach (var row in table.Rows)
            {
                data.Rows.Add([.. row.Select(v => v ?? DBNull.Value)]);
            }
            sheets[table.Name] = data;
        }
        using var stream = new MemoryStream();
        stream.SaveAs(sheets, excelType: ExcelType.XLSX);
        return stream.ToArray();
    }
}
