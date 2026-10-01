using System.Globalization;
using MiniExcelLibs;

namespace EventLy.Api.Services;

/// <summary>One data row of an imported guest list. <see cref="Line"/> is the row number in the sheet.</summary>
public sealed record GuestImportRow(int Line, string Name, string? Phone, string? Email, int? People, string? PeopleText);

/// <summary>
/// Reads a guest list from an Excel workbook (.xlsx, decision Q-12): the first sheet, row 1 is the header,
/// columns found by name (Indonesian or English) in any order. MiniExcel (Apache-2.0) reads it as a stream.
/// </summary>
public static class GuestSpreadsheet
{
    public const int MaxRows = 2_000;

    private static readonly string[] NameHeaders = ["nama", "nama tamu", "name", "guest name"];
    private static readonly string[] PhoneHeaders = ["telepon", "no telepon", "nomor telepon", "hp", "no hp", "nomor hp", "whatsapp", "nomor whatsapp", "no wa", "phone", "phone number"];
    private static readonly string[] EmailHeaders = ["email", "e-mail", "surel"];
    private static readonly string[] PeopleHeaders = ["jumlah", "jumlah orang", "jumlah tamu", "pax", "orang", "people", "number of people"];

    /// <summary>The rows, or the reason the file can't be used at all.</summary>
    public static (IReadOnlyList<GuestImportRow> Rows, string? Error) Read(Stream workbook)
    {
        List<IDictionary<string, object?>> sheet;
        try
        {
            sheet = [.. MiniExcel.Query(workbook, useHeaderRow: false, excelType: ExcelType.XLSX)
                .Cast<IDictionary<string, object?>>()
                .Take(MaxRows + 2)];
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            return ([], "The file isn't an Excel workbook (.xlsx).");
        }

        if (sheet.Count == 0 || sheet[0].Values.All(v => Text(v) is null))
        {
            return ([], "The first sheet is empty.");
        }

        var header = sheet[0].ToDictionary(c => c.Key, c => Text(c.Value)?.ToLowerInvariant() ?? "");
        var name = Find(header, NameHeaders);
        if (name is null)
        {
            return ([], "Row 1 must be a header with a \"nama\" (name) column.");
        }
        var phone = Find(header, PhoneHeaders);
        var email = Find(header, EmailHeaders);
        var people = Find(header, PeopleHeaders);

        var rows = new List<GuestImportRow>();
        for (var i = 1; i < sheet.Count; i++)
        {
            var cells = sheet[i];
            if (cells.Values.All(v => Text(v) is null))
            {
                continue;
            }
            if (rows.Count == MaxRows)
            {
                return ([], $"At most {MaxRows} guests per file.");
            }

            var peopleText = Cell(cells, people);
            int? count = peopleText is null ? 1
                : int.TryParse(peopleText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : null;
            rows.Add(new GuestImportRow(i + 1, Cell(cells, name) ?? "", Phone(cells, phone), Cell(cells, email), count, peopleText));
        }

        return rows.Count == 0 ? ([], "The sheet has a header but no guests.") : (rows, null);
    }

    /// <summary>A starting workbook: the Indonesian headers, one individual and one group.</summary>
    public static byte[] Template()
    {
        var rows = new[]
        {
            new Dictionary<string, object> { ["nama"] = "Budi Santoso", ["telepon"] = "0812 3456 7890", ["email"] = "budi@contoh.id", ["jumlah"] = 1 },
            new Dictionary<string, object> { ["nama"] = "Keluarga Wijaya", ["telepon"] = "", ["email"] = "", ["jumlah"] = 4 },
        };
        using var stream = new MemoryStream();
        stream.SaveAs(rows, excelType: ExcelType.XLSX);
        return stream.ToArray();
    }

    private static string? Find(Dictionary<string, string> header, string[] names) =>
        header.FirstOrDefault(h => names.Contains(h.Value)).Key;

    private static string? Cell(IDictionary<string, object?> cells, string? column) =>
        column is not null && cells.TryGetValue(column, out var value) ? Text(value) : null;

    /// <summary>
    /// A number typed into Excel loses its leading zero: 0812… becomes 812…. A numeric phone cell that
    /// looks like an Indonesian mobile number gets the zero back.
    /// </summary>
    private static string? Phone(IDictionary<string, object?> cells, string? column)
    {
        var text = Cell(cells, column);
        var numeric = column is not null && cells.TryGetValue(column, out var value) && value is double or int or long or decimal;
        return numeric && text is { Length: >= 9 and <= 13 } && text.StartsWith('8') ? "0" + text : text;
    }

    private static string? Text(object? value)
    {
        var text = value switch
        {
            null => null,
            string s => s,
            double d when d == Math.Truncate(d) && Math.Abs(d) < 1e15 => ((long)d).ToString(CultureInfo.InvariantCulture),
            double d => d.ToString(CultureInfo.InvariantCulture),
            DateTime t => t.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
            _ => value.ToString(),
        };
        return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }
}
