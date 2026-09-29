using EventLy.Api.Dtos.Organizations;
using EventLy.Api.Dtos.Users;
using EventLy.Api.Entities;
using FluentValidation;

namespace EventLy.Api.Validators;

internal static class ContactRules
{
    /// <summary>Indonesian or international phone: digits, spaces, dashes, optional leading +.</summary>
    public const string PhonePattern = @"^\+?[0-9][0-9 \-]{6,24}$";
}

public sealed class CreateOrganizationRequestValidator : AbstractValidator<CreateOrganizationRequest>
{
    public CreateOrganizationRequestValidator()
    {
        RuleFor(r => r.Name).NotEmpty().MaximumLength(120);
        RuleFor(r => r.ContactEmail).EmailAddress().MaximumLength(254).When(r => !string.IsNullOrEmpty(r.ContactEmail));
        RuleFor(r => r.ContactPhone).Matches(ContactRules.PhonePattern).When(r => !string.IsNullOrEmpty(r.ContactPhone));
        RuleFor(r => r.AcceptTerms).Equal(true).WithMessage("The Terms and Privacy Policy must be accepted.");
        RuleFor(r => r.TermsVersion).NotEmpty().MaximumLength(20);
    }
}

public sealed class UpdateOrganizationRequestValidator : AbstractValidator<UpdateOrganizationRequest>
{
    public UpdateOrganizationRequestValidator()
    {
        RuleFor(r => r.Name).NotEmpty().MaximumLength(120);
        RuleFor(r => r.ContactEmail).EmailAddress().MaximumLength(254).When(r => !string.IsNullOrEmpty(r.ContactEmail));
        RuleFor(r => r.ContactPhone).Matches(ContactRules.PhonePattern).When(r => !string.IsNullOrEmpty(r.ContactPhone));
    }
}

public sealed class InviteUserRequestValidator : AbstractValidator<InviteUserRequest>
{
    public InviteUserRequestValidator()
    {
        RuleFor(r => r.Name).NotEmpty().MaximumLength(100);
        RuleFor(r => r.Email).NotEmpty().EmailAddress().MaximumLength(254);
        RuleFor(r => r.Role).Must(r => r is UserRole.Admin or UserRole.Staff)
            .WithMessage("Only Admin or Staff can be invited.");
    }
}

public sealed class UpdateUserRequestValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserRequestValidator()
    {
        RuleFor(r => r.Name).NotEmpty().MaximumLength(100);
        RuleFor(r => r.Role).Must(r => r is UserRole.Admin or UserRole.Staff)
            .WithMessage("Role must be Admin or Staff.");
        RuleFor(r => r.Status).Must(s => s is UserStatus.Active or UserStatus.Disabled)
            .WithMessage("Status must be Active or Disabled.");
    }
}
