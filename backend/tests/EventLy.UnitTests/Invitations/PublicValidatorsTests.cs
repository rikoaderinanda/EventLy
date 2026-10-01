using EventLy.Api.Dtos.Guests;
using EventLy.Api.Dtos.Public;
using EventLy.Api.Entities;
using EventLy.Api.Validators;
using Shouldly;

namespace EventLy.UnitTests.Invitations;

public sealed class PublicValidatorsTests
{
    [Theory]
    [InlineData(RsvpStatus.Attending, true)]
    [InlineData(RsvpStatus.NotAttending, true)]
    [InlineData(RsvpStatus.Pending, false)]
    public void A_guest_answers_attending_or_not(RsvpStatus status, bool valid) =>
        new UpdateRsvpRequestValidator().Validate(new UpdateRsvpRequest(status)).IsValid.ShouldBe(valid);

    [Fact]
    public void A_wish_is_1_to_500_characters()
    {
        var validator = new UpdateWishRequestValidator();

        validator.Validate(new UpdateWishRequest("Selamat!")).IsValid.ShouldBeTrue();
        validator.Validate(new UpdateWishRequest("   ")).IsValid.ShouldBeFalse();
        validator.Validate(new UpdateWishRequest(new string('a', 501))).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void A_gift_confirmation_needs_a_name_and_a_positive_amount_if_any()
    {
        var validator = new CreateGiftConfirmationRequestValidator();

        validator.Validate(new CreateGiftConfirmationRequest("Sari", null, null)).IsValid.ShouldBeTrue();
        validator.Validate(new CreateGiftConfirmationRequest("Sari", 100_000m, "BSI")).IsValid.ShouldBeTrue();
        validator.Validate(new CreateGiftConfirmationRequest("", null, null)).IsValid.ShouldBeFalse();
        validator.Validate(new CreateGiftConfirmationRequest("Sari", 0m, null)).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void Gift_accounts_are_limited_and_numbers_are_digits()
    {
        var validator = new UpdateEventGiftsRequestValidator();
        var bsi = new GiftAccountDto(GiftAccountKind.Bank, "BSI", "7123 4567-89", "Rina");

        validator.Validate(new UpdateEventGiftsRequest([bsi], null)).IsValid.ShouldBeTrue();
        validator.Validate(new UpdateEventGiftsRequest([bsi with { AccountNumber = "abc" }], null)).IsValid.ShouldBeFalse();
        validator.Validate(new UpdateEventGiftsRequest([.. Enumerable.Repeat(bsi, 6)], null)).IsValid.ShouldBeFalse();
    }

    [Theory]
    [InlineData(EventStatus.Draft, false)]
    [InlineData(EventStatus.PendingPayment, false)]
    [InlineData(EventStatus.Active, true)]
    [InlineData(EventStatus.Completed, true)]
    [InlineData(EventStatus.Cancelled, false)]
    public void Only_paid_events_have_a_public_invitation_page(EventStatus status, bool isPublic) =>
        EventLifecycle.IsPublic(status).ShouldBe(isPublic);
}
