using EventLy.Api.Entities;
using Shouldly;

namespace EventLy.UnitTests.Invitations;

/// <summary>The code is the guest's credential: 128 random bits, URL-safe, never repeated.</summary>
public sealed class InvitationCodeTests
{
    [Fact]
    public void A_code_is_22_url_safe_characters()
    {
        var code = InvitationCode.New();

        code.Length.ShouldBe(22);
        code.ShouldAllBe(c => char.IsAsciiLetterOrDigit(c) || c == '-' || c == '_');
        InvitationCode.IsWellFormed(code).ShouldBeTrue();
    }

    [Fact]
    public void Codes_dont_repeat()
    {
        var codes = Enumerable.Range(0, 100_000).Select(_ => InvitationCode.New()).ToHashSet();

        codes.Count.ShouldBe(100_000);
    }

    [Fact]
    public void Codes_use_the_whole_alphabet_evenly()
    {
        // 128 bits spread over 22 base64url characters: every position varies, no fixed prefix.
        var codes = Enumerable.Range(0, 2_000).Select(_ => InvitationCode.New()).ToList();

        Enumerable.Range(0, 21).ShouldAllBe(i => codes.Select(c => c[i]).Distinct().Count() > 50);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("aaaaaaaaaaaaaaaaaaaa/=")]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaa")]
    public void Malformed_codes_are_recognised(string? code) =>
        InvitationCode.IsWellFormed(code).ShouldBeFalse();
}
