using EventLy.Api.Data.Seed;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Dtos.Payments;
using EventLy.Api.Entities;
using EventLy.Api.Validators;
using Shouldly;

namespace EventLy.UnitTests.Payments;

public sealed class PaymentValidatorsTests
{
    private static readonly CreatePackageRequestValidator Validator = new();

    private static CreatePackageRequest Package(decimal price = 150_000m, string currency = "IDR", PackageFeatures? features = null) =>
        new("SILVER", "Silver", price, currency, features ?? PackageSeed.Initial()[0].Features.Copy(), IsActive: true);

    [Fact]
    public void Seeded_basic_package_is_valid() =>
        Validator.Validate(Package()).IsValid.ShouldBeTrue();

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(150_000.50)]
    [InlineData(100_000_001)]
    public void Price_is_a_positive_whole_rupiah_amount(decimal price) =>
        Validator.Validate(Package(price)).IsValid.ShouldBeFalse();

    [Fact]
    public void Only_rupiah() =>
        Validator.Validate(Package(currency: "USD")).IsValid.ShouldBeFalse();

    [Theory]
    [InlineData("A")]
    [InlineData("WITH SPACE")]
    [InlineData("")]
    public void Code_is_short_and_plain(string code) =>
        Validator.Validate(Package() with { Code = code }).IsValid.ShouldBeFalse();

    [Fact]
    public void Guest_photos_need_a_per_invitation_limit()
    {
        var features = PackageSeed.Initial()[0].Features.Copy();
        features.GuestUploadEnabled = true;
        features.MaxGuestPhotosPerInvitation = 0;

        Validator.Validate(Package(features: features)).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void Manual_activation_needs_a_note()
    {
        var validator = new ManualActivationRequestValidator();

        validator.Validate(new ManualActivationRequest(Guid.NewGuid(), 150_000m, "BCA transfer 12/12")).IsValid.ShouldBeTrue();
        validator.Validate(new ManualActivationRequest(Guid.NewGuid(), 150_000m, " ")).IsValid.ShouldBeFalse();
        validator.Validate(new ManualActivationRequest(Guid.Empty, 150_000m, "BCA")).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void Initial_catalog_matches_the_decided_prices()
    {
        PackageSeed.Initial().Select(p => (p.Code, p.Price)).ShouldBe(
            [("BASIC", 150_000m), ("PREMIUM", 350_000m), ("ENTERPRISE", 1_000_000m)]);
        PackageSeed.Initial().ShouldAllBe(p => Validator.Validate(
            new CreatePackageRequest(p.Code, p.Name, p.Price, p.Currency, p.Features, true)).IsValid);
    }
}
