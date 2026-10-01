using EventLy.Api.Services;
using MiniExcelLibs;
using Shouldly;

namespace EventLy.UnitTests.Invitations;

public sealed class GuestSpreadsheetTests
{
    /// <summary>An .xlsx in memory; the first row is the header, as typed in Excel.</summary>
    private static MemoryStream Workbook(params object?[][] rows)
    {
        var sheet = rows.Select(row => row
            .Select((value, i) => (Column: ((char)('A' + i)).ToString(), value))
            .ToDictionary(c => c.Column, c => c.value)).ToList();
        var stream = new MemoryStream();
        stream.SaveAs(sheet, printHeader: false, excelType: ExcelType.XLSX);
        stream.Position = 0;
        return stream;
    }

    [Fact]
    public void Reads_the_columns_by_name_in_any_order()
    {
        var (rows, error) = GuestSpreadsheet.Read(Workbook(
            ["Jumlah", "Nama", "No HP", "Email"],
            [1, "Budi Santoso", "0812 3456 7890", "budi@x.id"],
            [4, "Keluarga Wijaya", null, null]));

        error.ShouldBeNull();
        rows.ShouldBe(
        [
            new GuestImportRow(2, "Budi Santoso", "0812 3456 7890", "budi@x.id", 1, "1"),
            new GuestImportRow(3, "Keluarga Wijaya", null, null, 4, "4"),
        ]);
    }

    [Fact]
    public void A_phone_typed_as_a_number_gets_its_leading_zero_back()
    {
        var (rows, _) = GuestSpreadsheet.Read(Workbook(["nama", "telepon"], ["Sari", 81234567890d], ["Budi", 6281234567890d]));

        rows.Select(r => r.Phone).ShouldBe(["081234567890", "6281234567890"]);
    }

    [Fact]
    public void English_headers_empty_counts_and_blank_rows()
    {
        var (rows, _) = GuestSpreadsheet.Read(Workbook(["Name", "People"], ["Sari", null], [null, null], ["Budi", "dua"]));

        rows.Select(r => (r.Line, r.Name, r.People)).ShouldBe([(2, "Sari", (int?)1), (4, "Budi", null)]);
        rows[1].PeopleText.ShouldBe("dua");
    }

    [Fact]
    public void A_file_that_isnt_a_workbook_is_refused()
    {
        var (rows, error) = GuestSpreadsheet.Read(new MemoryStream("nama,telepon\nSari,0812"u8.ToArray()));

        rows.ShouldBeEmpty();
        error.ShouldNotBeNull().ShouldContain(".xlsx");
    }

    [Fact]
    public void A_sheet_without_a_name_column_or_without_guests_is_refused()
    {
        GuestSpreadsheet.Read(Workbook(["telepon"], ["0812 3456 7890"])).Error.ShouldNotBeNull();
        GuestSpreadsheet.Read(Workbook(["nama"])).Error.ShouldNotBeNull();
    }

    [Fact]
    public void The_template_reads_back_as_two_guests()
    {
        var (rows, error) = GuestSpreadsheet.Read(new MemoryStream(GuestSpreadsheet.Template()));

        error.ShouldBeNull();
        rows.Select(r => (r.Name, r.People)).ShouldBe([("Budi Santoso", (int?)1), ("Keluarga Wijaya", 4)]);
    }

    [Theory]
    [InlineData("  Budi   Santoso ", "Budi Santoso")]
    [InlineData("Keluarga\tWijaya", "Keluarga Wijaya")]
    public void Names_are_compared_with_tidy_spacing(string typed, string stored) =>
        EventLy.Api.Entities.GuestNames.Normalize(typed).ShouldBe(stored);
}
