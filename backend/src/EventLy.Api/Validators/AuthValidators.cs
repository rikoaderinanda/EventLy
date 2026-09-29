using EventLy.Api.Dtos.Auth;
using FluentValidation;

namespace EventLy.Api.Validators;

public sealed class GoogleSignInRequestValidator : AbstractValidator<GoogleSignInRequest>
{
    public GoogleSignInRequestValidator()
    {
        // Google ID tokens are ~1 KB JWTs; the upper bound stops oversized input early.
        RuleFor(r => r.IdToken).NotEmpty().MaximumLength(8192);
    }
}

public sealed class DevSignInRequestValidator : AbstractValidator<DevSignInRequest>
{
    public DevSignInRequestValidator()
    {
        RuleFor(r => r.Email).NotEmpty().EmailAddress().MaximumLength(254);
        RuleFor(r => r.Name).MaximumLength(100);
    }
}
