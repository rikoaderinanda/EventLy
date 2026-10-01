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
        RuleFor(r => r.Phone).Matches(ContactRules.PhonePattern).When(r => !string.IsNullOrWhiteSpace(r.Phone))
            .WithMessage("Enter a phone number, for example 0812 3456 7890.");
        RuleFor(r => r.Email).EmailAddress().MaximumLength(254).When(r => !string.IsNullOrWhiteSpace(r.Email));
        RuleFor(r => r.GuestType).IsInEnum();
        RuleFor(r => r.NumberOfPeople).Equal(1).When(r => r.GuestType == GuestType.Individual)
            .WithMessage("An individual invitation is for 1 person.");
        RuleFor(r => r.NumberOfPeople).InclusiveBetween(2, Guest.MaxPeoplePerGroup).When(r => r.GuestType == GuestType.Group)
            .WithMessage($"A group invitation is for 2 to {Guest.MaxPeoplePerGroup} people.");
        RuleFor(r => r.SessionIds).Must(ids => ids!.Count is > 0 and <= EventInputValidator<CreateEventRequest>.MaxSessions)
            .When(r => r.SessionIds is not null)
            .WithMessage("Invite the guest to at least one session.");
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
            .WithMessage($"The message must contain {WhatsAppMessage.LinkPlaceholder}, where the invitation link goes.")
            .When(r => !string.IsNullOrWhiteSpace(r.Template));
    }
}
