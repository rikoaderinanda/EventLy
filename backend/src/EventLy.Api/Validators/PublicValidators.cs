using EventLy.Api.Common.Localization;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Dtos.Public;
using EventLy.Api.Entities;
using EventLy.Api.Services;
using FluentValidation;

namespace EventLy.Api.Validators;

public sealed class UpdateRsvpRequestValidator : AbstractValidator<UpdateRsvpRequest>
{
    public UpdateRsvpRequestValidator()
    {
        RuleFor(r => r.Status).Must(s => s is RsvpStatus.Attending or RsvpStatus.NotAttending)
            .WithMessage(_ => Texts.T("Jawab hadir atau tidak hadir.", "Answer Attending or NotAttending."));
    }
}

public sealed class UpdateWishRequestValidator : AbstractValidator<UpdateWishRequest>
{
    public UpdateWishRequestValidator()
    {
        RuleFor(r => r.Message).Must(m => !string.IsNullOrWhiteSpace(m)).WithMessage(_ => Texts.T("Tulis ucapan Anda.", "Write a message."))
            .MaximumLength(Wish.MaxLength);
    }
}

public sealed class CreateGiftConfirmationRequestValidator : AbstractValidator<CreateGiftConfirmationRequest>
{
    public CreateGiftConfirmationRequestValidator()
    {
        RuleFor(r => r.SenderName).Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage(_ => Texts.T("Isi nama pengirim.", "Enter the sender name."))
            .MaximumLength(100);
        RuleFor(r => r.Amount).GreaterThan(0).LessThanOrEqualTo(MoneyRules.MaxAmount).When(r => r.Amount is not null);
        RuleFor(r => r.Note).MaximumLength(300);
    }
}

public sealed class UpdateEventGiftsRequestValidator : AbstractValidator<UpdateEventGiftsRequest>
{
    public UpdateEventGiftsRequestValidator()
    {
        RuleFor(r => r.Accounts).NotNull()
            .Must(a => a.Count <= GuestResponseService.MaxGiftAccounts)
            .WithMessage(_ => Texts.T($"Maksimal {GuestResponseService.MaxGiftAccounts} rekening.", $"At most {GuestResponseService.MaxGiftAccounts} accounts."));
        RuleForEach(r => r.Accounts).ChildRules(a =>
        {
            a.RuleFor(x => x.Kind).IsInEnum();
            a.RuleFor(x => x.Provider).NotEmpty().MaximumLength(60);
            a.RuleFor(x => x.AccountNumber).NotEmpty().MaximumLength(40)
                .Matches(@"^[0-9][0-9 \-]*$").WithMessage(_ => Texts.T("Gunakan angka, spasi atau tanda hubung.", "Use digits, spaces or dashes."));
            a.RuleFor(x => x.AccountHolder).NotEmpty().MaximumLength(100);
        });
        RuleFor(r => r.Address).MaximumLength(500);
    }
}
