using System.Globalization;
using System.Text;

namespace EventLy.Api.Services;

/// <summary>One data line of an imported guest list. <see cref="Line"/> is the line number in the file.</summary>
public sealed record GuestCsvRow(int Line, string Name, string? Phone, string? Email, int? People, string? PeopleText);

/// <summary>
/// Reads a guest list exported from Excel or Google Sheets (decision Q-12). The first line is a header;
/// columns are found by name (Indonesian or English) and may be in any order. Comma or semicolon separated
/// (Excel with Indonesian settings uses a semicolon), quoted fields as in RFC 4180, optional UTF-8 BOM.
/// </summary>
public static class GuestCsv
{
    public const int MaxRows = 2_000;

    private static readonly string[] NameHeaders = ["nama", "nama tamu", "name", "guest name"];
    private static readonly string[] PhoneHeaders = ["telepon", "no telepon", "nomor telepon", "hp", "no hp", "nomor hp", "whatsapp", "nomor whatsapp", "no wa", "phone", "phone number"];
    private static readonly string[] EmailHeaders = ["email", "e-mail", "surel"];
    private static readonly string[] PeopleHeaders = ["jumlah", "jumlah orang", "jumlah tamu", "pax", "orang", "people", "number of people"];

    /// <summary>The rows, or the reason the file can't be read at all.</summary>
    public static (IReadOnlyList<GuestCsvRow> Rows, string? Error) Parse(string text)
    {
        var lines = SplitRecords(text.TrimStart('﻿'));
        if (lines.Count == 0 || lines[0].All(string.IsNullOrWhiteSpace))
        {
            return ([], "The file is empty.");
        }

        var header = lines[0].Select(h => h.Trim().ToLowerInvariant()).ToList();
        var name = Find(header, NameHeaders);
        if (name < 0)
        {
            return ([], "The first line must be a header with a \"nama\" (name) column.");
        }
        var phone = Find(header, PhoneHeaders);
        var email = Find(header, EmailHeaders);
        var people = Find(header, PeopleHeaders);

        var rows = new List<GuestCsvRow>();
        for (var i = 1; i < lines.Count; i++)
        {
            var fields = lines[i];
            if (fields.All(string.IsNullOrWhiteSpace))
            {
                continue;
            }
            if (rows.Count == MaxRows)
            {
                return ([], $"At most {MaxRows} guests per file.");
            }

            var peopleText = Cell(fields, people);
            int? count = peopleText is null ? 1
                : int.TryParse(peopleText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : null;
            rows.Add(new GuestCsvRow(i + 1, Cell(fields, name) ?? "", Cell(fields, phone), Cell(fields, email), count, peopleText));
        }

        return rows.Count == 0 ? ([], "The file has a header but no guests.") : (rows, null);
    }

    private static int Find(List<string> header, string[] names) => header.FindIndex(names.Contains);

    private static string? Cell(List<string> fields, int index) =>
        index >= 0 && index < fields.Count && !string.IsNullOrWhiteSpace(fields[index]) ? fields[index].Trim() : null;

    /// <summary>Splits into records of fields, honouring quotes (which may contain separators and line breaks).</summary>
    private static List<List<string>> SplitRecords(string text)
    {
        var separator = DetectSeparator(text);
        var records = new List<List<string>>();
        var fields = new List<string>();
        var field = new StringBuilder();
        var quoted = false;

        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (quoted)
            {
                if (c == '"' && i + 1 < text.Length && text[i + 1] == '"')
                {
                    field.Append('"');
                    i++;
                }
                else if (c == '"')
                {
                    quoted = false;
                }
                else
                {
                    field.Append(c);
                }
            }
            else if (c == '"')
            {
                quoted = true;
            }
            else if (c == separator)
            {
                fields.Add(field.ToString());
                field.Clear();
            }
            else if (c is '\r' or '\n')
            {
                if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n')
                {
                    i++;
                }
                fields.Add(field.ToString());
                field.Clear();
                records.Add(fields);
                fields = [];
            }
            else
            {
                field.Append(c);
            }
        }

        if (field.Length > 0 || fields.Count > 0)
        {
            fields.Add(field.ToString());
            records.Add(fields);
        }
        return records;
    }

    /// <summary>Semicolon when the header line has more semicolons than commas (Excel, Indonesian settings).</summary>
    private static char DetectSeparator(string text)
    {
        var end = text.IndexOfAny(['\r', '\n']);
        var header = end < 0 ? text : text[..end];
        return header.Count(c => c == ';') > header.Count(c => c == ',') ? ';' : ',';
    }
}
