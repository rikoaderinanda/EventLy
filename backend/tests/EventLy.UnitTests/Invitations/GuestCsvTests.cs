using EventLy.Api.Services;
using Shouldly;

namespace EventLy.UnitTests.Invitations;

public sealed class GuestCsvTests
{
    [Fact]
    public void Reads_a_comma_separated_list_with_the_columns_in_any_order()
    {
        var (rows, error) = GuestCsv.Parse("jumlah,nama,telepon,email\n1,Budi Santoso,0812 3456 7890,budi@x.id\n4,Keluarga Wijaya,,\n");

        error.ShouldBeNull();
        rows.Count.ShouldBe(2);
        rows[0].ShouldBe(new GuestCsvRow(2, "Budi Santoso", "0812 3456 7890", "budi@x.id", 1, "1"));
        rows[1].ShouldBe(new GuestCsvRow(3, "Keluarga Wijaya", null, null, 4, "4"));
    }

    [Fact]
    public void Reads_excel_with_indonesian_settings_semicolons_bom_and_quotes()
    {
        var csv = "﻿Nama;No HP;Jumlah\r\n\"Wijaya; Bapak & Ibu\";0812;2\r\n\"Sari \"\"Ayu\"\"\";;\r\n";

        var (rows, error) = GuestCsv.Parse(csv);

        error.ShouldBeNull();
        rows.Select(r => r.Name).ShouldBe(["Wijaya; Bapak & Ibu", "Sari \"Ayu\""]);
        rows[0].People.ShouldBe(2);
        rows[1].People.ShouldBe(1); // empty means one person
    }

    [Fact]
    public void English_headers_work_too()
    {
        var (rows, _) = GuestCsv.Parse("Name,Phone,People\nSari,0812,1");

        rows.ShouldHaveSingleItem().Phone.ShouldBe("0812");
    }

    [Fact]
    public void Blank_lines_are_skipped_and_line_numbers_follow_the_file()
    {
        var (rows, _) = GuestCsv.Parse("nama\nSari\n\n,\nBudi\n");

        rows.Select(r => (r.Line, r.Name)).ShouldBe([(2, "Sari"), (5, "Budi")]);
    }

    [Fact]
    public void A_count_that_isnt_a_number_is_kept_for_the_error_message()
    {
        var (rows, _) = GuestCsv.Parse("nama,jumlah\nSari,dua");

        rows.ShouldHaveSingleItem().People.ShouldBeNull();
        rows[0].PeopleText.ShouldBe("dua");
    }

    [Theory]
    [InlineData("")]
    [InlineData("﻿")]
    [InlineData("telepon,email\n0812,a@b.c")]
    [InlineData("nama\n")]
    public void Unusable_files_are_refused_with_a_reason(string csv)
    {
        var (rows, error) = GuestCsv.Parse(csv);

        rows.ShouldBeEmpty();
        error.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public void At_most_2000_guests_per_file()
    {
        var csv = "nama\n" + string.Join('\n', Enumerable.Range(0, GuestCsv.MaxRows + 1).Select(i => $"Tamu {i}"));

        GuestCsv.Parse(csv).Error.ShouldNotBeNull();
    }
}
