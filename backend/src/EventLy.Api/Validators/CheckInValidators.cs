using EventLy.Api.Common.Localization;
using EventLy.Api.Dtos.CheckIns;
using FluentValidation;

namespace EventLy.Api.Validators;

public sealed class CheckInRequestValidator : AbstractValidator<CheckInRequest>
{
    public CheckInRequestValidator()
    {
        RuleFor(r => r).Must(r => string.IsNullOrWhiteSpace(r.Code) != (r.InvitationId is null))
            .WithName("code").WithMessage(_ => Texts.T("Kirim kode hasil scan, atau undangan yang dipilih dari nama (salah satu saja).", "Send the scanned code, or the invitation picked by name (not both)."));
        RuleFor(r => r.Code).MaximumLength(2048);
    }
}
