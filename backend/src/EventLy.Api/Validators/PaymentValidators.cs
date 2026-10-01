using EventLy.Api.Common.Localization;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Dtos.Payments;
using EventLy.Api.Entities;
using FluentValidation;

namespace EventLy.Api.Validators;

internal static class MoneyRules
{
    public const decimal MaxAmount = 100_000_000m;

    /// <summary>Rupiah has no cents in practice, and gateways reject them for IDR.</summary>
    public static bool IsWholeRupiah(decimal amount) => amount == decimal.Truncate(amount);
}

/// <summary>Rules shared by create and update.</summary>
public abstract class PackageInputValidator<T> : AbstractValidator<T>
    where T : IPackageInput
{
    protected PackageInputValidator()
    {
        RuleFor(r => r.Name).NotEmpty().MaximumLength(80);
        RuleFor(r => r.Currency).Equal(Currencies.Idr).WithMessage(_ => Texts.T("Hanya mendukung Rupiah (IDR).", "Only IDR is supported."));
        RuleFor(r => r.Price).GreaterThan(0).LessThanOrEqualTo(MoneyRules.MaxAmount)
            .Must(MoneyRules.IsWholeRupiah).WithMessage(_ => Texts.T("Harga harus dalam rupiah bulat.", "The price must be a whole rupiah amount."));
        RuleFor(r => r.Features).NotNull().SetValidator(new PackageFeaturesValidator());
    }
}

public sealed class PackageFeaturesValidator : AbstractValidator<PackageFeatures>
{
    public PackageFeaturesValidator()
    {
        RuleFor(f => f.MaxGuests).InclusiveBetween(1, 100_000);
        RuleFor(f => f.MaxPhotos).InclusiveBetween(0, 1_000_000);
        RuleFor(f => f.MaxStaff).InclusiveBetween(0, 100);
        RuleFor(f => f.MaxAdmins).InclusiveBetween(0, 100);
        RuleFor(f => f.GalleryRetentionDays).InclusiveBetween(1, 3_650);
        RuleFor(f => f.MaxGuestPhotosPerInvitation).InclusiveBetween(0, 100);
        RuleFor(f => f.MaxGuestPhotosPerInvitation).GreaterThan(0)
            .When(f => f.GuestUploadEnabled)
            .WithMessage(_ => Texts.T("Isi berapa foto yang boleh diambil tiap tamu, atau matikan foto tamu.", "Set how many photos each guest may take, or turn guest photos off."));
    }
}

public sealed class CreatePackageRequestValidator : PackageInputValidator<CreatePackageRequest>
{
    public CreatePackageRequestValidator()
    {
        RuleFor(r => r.Code).NotEmpty().Matches("^[A-Za-z0-9_]{2,30}$")
            .WithMessage(_ => Texts.T("Kode berisi 2 sampai 30 huruf, angka atau garis bawah.", "The code is 2 to 30 letters, digits or underscores."));
    }
}

public sealed class UpdatePackageRequestValidator : PackageInputValidator<UpdatePackageRequest>;

public sealed class CreatePaymentRequestValidator : AbstractValidator<CreatePaymentRequest>
{
    public CreatePaymentRequestValidator()
    {
        RuleFor(r => r.PackageId).NotEmpty();
    }
}

public sealed class SimulatePaymentRequestValidator : AbstractValidator<SimulatePaymentRequest>
{
    public SimulatePaymentRequestValidator()
    {
        RuleFor(r => r.Outcome).IsInEnum();
    }
}

public sealed class ManualActivationRequestValidator : AbstractValidator<ManualActivationRequest>
{
    public ManualActivationRequestValidator()
    {
        RuleFor(r => r.PackageId).NotEmpty();
        RuleFor(r => r.Amount).GreaterThanOrEqualTo(0).LessThanOrEqualTo(MoneyRules.MaxAmount)
            .Must(MoneyRules.IsWholeRupiah).WithMessage(_ => Texts.T("Jumlah harus dalam rupiah bulat.", "The amount must be a whole rupiah amount."));
        RuleFor(r => r.Note).NotEmpty().WithMessage(_ => Texts.T("Catat cara pembayarannya, misalnya nomor referensi transfer.", "Note how it was paid, for example the transfer reference."))
            .MaximumLength(500);
    }
}
