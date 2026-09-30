using EventLy.Api.Dtos.Events;
using EventLy.Api.Entities;
using EventLy.Api.Validators;
using Shouldly;

namespace EventLy.UnitTests.Events;

public sealed class EventValidatorsTests
{
    private static readonly CreateEventRequestValidator Validator = new();

    private static EventSessionInput Session(string name = "Resepsi", bool checkIn = true, string? mapsUrl = null) =>
        new(null, name, new DateTime(2026, 12, 12, 11, 0, 0), new DateTime(2026, 12, 12, 14, 0, 0),
            "Gedung Serbaguna", mapsUrl, checkIn);

    private static CreateEventRequest Request(params EventSessionInput[] sessions) =>
        new("Pernikahan Sari & Budi", EventCategory.Wedding, "Asia/Jakarta", null, sessions);

    private static IEnumerable<string> Errors(CreateEventRequest request) =>
        Validator.Validate(request).Errors.Select(e => e.PropertyName);

    [Fact]
    public void Valid_event_with_akad_and_resepsi_passes() =>
        Validator.Validate(Request(Session("Akad Nikah", checkIn: false), Session())).IsValid.ShouldBeTrue();

    [Fact]
    public void Needs_at_least_one_session() =>
        Errors(Request()).ShouldContain("Sessions");

    [Fact]
    public void Needs_exactly_one_check_in_session()
    {
        Errors(Request(Session(checkIn: false))).ShouldContain("Sessions");
        Errors(Request(Session("Akad Nikah"), Session())).ShouldContain("Sessions");
    }

    [Fact]
    public void At_most_five_sessions()
    {
        var sessions = Enumerable.Range(0, 5).Select(i => Session($"Sesi {i}", checkIn: false)).Append(Session());
        Errors(Request([.. sessions])).ShouldContain("Sessions");
    }

    [Theory]
    [InlineData("Asia/Jakarta", true)]
    [InlineData("Asia/Makassar", true)]
    [InlineData("Asia/Jayapura", true)]
    [InlineData("Asia/Singapore", false)]
    [InlineData("", false)]
    public void Only_indonesian_time_zones(string timeZone, bool valid) =>
        Validator.Validate(Request(Session()) with { TimeZone = timeZone }).IsValid.ShouldBe(valid);

    [Fact]
    public void Session_must_end_after_it_starts()
    {
        var session = Session() with { EndsAtLocal = new DateTime(2026, 12, 12, 11, 0, 0) };
        Errors(Request(session)).ShouldContain("Sessions[0].EndsAtLocal");
    }

    [Theory]
    [InlineData("https://maps.app.goo.gl/abc", true)]
    [InlineData("http://maps.app.goo.gl/abc", false)]
    [InlineData("javascript:alert(1)", false)]
    [InlineData("not a url", false)]
    public void Maps_link_must_be_https(string url, bool valid) =>
        Validator.Validate(Request(Session(mapsUrl: url))).IsValid.ShouldBe(valid);

    [Fact]
    public void Name_is_required() =>
        Errors(Request(Session()) with { Name = "" }).ShouldContain("Name");
}
