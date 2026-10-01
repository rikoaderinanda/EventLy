using System.Text.RegularExpressions;
using EventLy.Api.Common.Localization;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Entities;
using EventLy.Api.Services;
using FluentValidation;

namespace EventLy.Api.Validators;

/// <summary>Rules shared by create and update.</summary>
public abstract class GuestInputValidator<T> : AbstractValidator<T>
    where T : IGuestInput
{
    protected GuestInputValidator()
    {
        RuleFor(r => r.Name).NotEmpty().MaximumLength(120);
        // One rule, one message: the shape of a phone number and enough digits for WhatsApp.
        RuleFor(r => r.Phone)
            .Must(p => Regex.IsMatch(p!, ContactRules.PhonePattern) && WhatsAppMessage.NormalizePhone(p) is not null)
            .When(r => !string.IsNullOrWhiteSpace(r.Phone))
            .WithMessage(_ => Texts.T("Masukkan nomor telepon yang valid, misalnya 0812 3456 7890.", "Enter a phone number, for example 0812 3456 7890."));
        RuleFor(r => r.Email).EmailAddress().MaximumLength(254).When(r => !string.IsNullOrWhiteSpace(r.Email));
        RuleFor(r => r.GuestType).IsInEnum();
        RuleFor(r => r.NumberOfPeople).Equal(1).When(r => r.GuestType == GuestType.Individual)
            .WithMessage(_ => Texts.T("Undangan perorangan untuk 1 orang.", "An individual invitation is for 1 person."));
        RuleFor(r => r.NumberOfPeople).InclusiveBetween(2, Guest.MaxPeoplePerGroup).When(r => r.GuestType == GuestType.Group)
            .WithMessage(_ => Texts.T($"Undangan rombongan untuk 2 sampai {Guest.MaxPeoplePerGroup} orang.", $"A group invitation is for 2 to {Guest.MaxPeoplePerGroup} people."));
        RuleFor(r => r.SessionIds).Must(ids => ids!.Count is > 0 and <= EventInputValidator<CreateEventRequest>.MaxSessions)
            .When(r => r.SessionIds is not null)
            .WithMessage(_ => Texts.T("Undang tamu ke minimal satu sesi.", "Invite the guest to at least one session."));
    }
}

public sealed class CreateGuestRequestValidator : GuestInputValidator<CreateGuestRequest>;

public sealed class UpdateGuestRequestValidator : GuestInputValidator<UpdateGuestRequest>;

public sealed class UpdateWhatsAppTemplateRequestValidator : AbstractValidator<UpdateWhatsAppTemplateRequest>
{
    public UpdateWhatsAppTemplateRequestValidator()
    {
        RuleFor(r => r.Template).MaximumLength(1000)
            .Must(t => t!.Contains(WhatsAppMessage.LinkPlaceholder, StringComparison.OrdinalIgnoreCase))
            .WithMessage(_ => Texts.T($"Pesan harus berisi {WhatsAppMessage.LinkPlaceholder}, tempat link undangan dimasukkan.", $"The message must contain {WhatsAppMessage.LinkPlaceholder}, where the invitation link goes."))
            .When(r => !string.IsNullOrWhiteSpace(r.Template));
    }
}
