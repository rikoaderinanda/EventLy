using EventLy.Api.Dtos.Guests;
using EventLy.Api.Entities;
using EventLy.Api.Services;
using EventLy.Api.Validators;
using Shouldly;

namespace EventLy.UnitTests.Invitations;

public sealed class GuestValidatorsTests
{
    private static readonly CreateGuestRequestValidator Validator = new();

    private static CreateGuestRequest Guest(GuestType type = GuestType.Individual, int people = 1, string? phone = null) =>
        new("Sari", phone, null, type, people, null);

    [Fact]
    public void An_individual_is_one_person()
    {
        Validator.Validate(Guest()).IsValid.ShouldBeTrue();
        Validator.Validate(Guest(people: 2)).IsValid.ShouldBeFalse();
    }

    [Theory]
    [InlineData(2, true)]
    [InlineData(50, true)]
    [InlineData(1, false)]
    [InlineData(51, false)]
    public void A_group_is_2_to_50_people(int people, bool valid) =>
        Validator.Validate(Guest(GuestType.Group, people)).IsValid.ShouldBe(valid);

    [Theory]
    [InlineData("0812 3456 7890", true)]
    [InlineData("+62-812-3456-7890", true)]
    [InlineData("phone", false)]
    public void Phone_numbers_are_checked(string phone, bool valid) =>
        Validator.Validate(Guest(phone: phone)).IsValid.ShouldBe(valid);

    [Fact]
    public void An_empty_session_list_is_refused() =>
        Validator.Validate(Guest() with { SessionIds = [] }).IsValid.ShouldBeFalse();

    [Fact]
    public void The_whatsapp_template_needs_the_link()
    {
        var validator = new UpdateWhatsAppTemplateRequestValidator();

        validator.Validate(new UpdateWhatsAppTemplateRequest("Halo {nama}: {link}")).IsValid.ShouldBeTrue();
        validator.Validate(new UpdateWhatsAppTemplateRequest("Halo {nama}")).IsValid.ShouldBeFalse();
        validator.Validate(new UpdateWhatsAppTemplateRequest(null)).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void Qr_codes_render_as_svg_and_png()
    {
        InvitationService.Svg("https://evently.id/i/abc").ShouldStartWith("<svg");
        var png = InvitationService.Png("https://evently.id/i/abc", 256);
        png.Take(4).ShouldBe(new byte[] { 0x89, 0x50, 0x4E, 0x47 });
    }
}
