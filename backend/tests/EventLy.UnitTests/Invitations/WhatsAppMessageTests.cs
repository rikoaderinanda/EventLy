using EventLy.Api.Services;
using Shouldly;

namespace EventLy.UnitTests.Invitations;

public sealed class WhatsAppMessageTests
{
    [Theory]
    [InlineData("0812-3456-7890", "6281234567890")]
    [InlineData("+62 812 3456 7890", "6281234567890")]
    [InlineData("6281234567890", "6281234567890")]
    [InlineData("(021) 555 1234", "62215551234")]
    [InlineData("+65 9123 4567", "6591234567")]
    public void Phone_numbers_become_international_digits(string phone, string expected) =>
        WhatsAppMessage.NormalizePhone(phone).ShouldBe(expected);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("tidak ada")]
    public void Unusable_numbers_are_dropped(string? phone) =>
        WhatsAppMessage.NormalizePhone(phone).ShouldBeNull();

    [Fact]
    public void The_template_gets_the_name_event_and_link()
    {
        var text = WhatsAppMessage.Render("Halo {nama}, datang ke {acara}: {LINK}", "Sari", "Pernikahan Rina & Budi",
            "https://evently.id/i/abc");

        text.ShouldBe("Halo Sari, datang ke Pernikahan Rina & Budi: https://evently.id/i/abc");
    }

    [Fact]
    public void No_template_uses_the_default()
    {
        var text = WhatsAppMessage.Render(null, "Sari", "Resepsi", "https://evently.id/i/abc");

        text.ShouldStartWith("Halo Sari,");
        text.ShouldContain("https://evently.id/i/abc");
    }

    [Fact]
    public void The_link_carries_the_number_and_the_encoded_message()
    {
        WhatsAppMessage.Link("0812 3456 7890", "Halo & selamat datang\nhttps://x/i/a?b")
            .ShouldBe("https://wa.me/6281234567890?text=Halo%20%26%20selamat%20datang%0Ahttps%3A%2F%2Fx%2Fi%2Fa%3Fb");
        WhatsAppMessage.Link(null, "Halo").ShouldBe("https://wa.me/?text=Halo");
    }
}
