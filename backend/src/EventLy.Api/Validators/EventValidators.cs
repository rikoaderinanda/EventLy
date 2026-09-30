using EventLy.Api.Dtos.Events;
using EventLy.Api.Entities;
using FluentValidation;

namespace EventLy.Api.Validators;

/// <summary>Rules shared by create and update.</summary>
public abstract class EventInputValidator<T> : AbstractValidator<T>
    where T : IEventInput
{
    public const int MaxSessions = 5;

    protected EventInputValidator()
    {
        RuleFor(r => r.Name).NotEmpty().MaximumLength(150);
        RuleFor(r => r.Category).IsInEnum();
        RuleFor(r => r.TimeZone).Must(tz => EventTimeZones.Allowed.Contains(tz))
            .WithMessage($"Time zone must be one of: {string.Join(", ", EventTimeZones.Allowed)}.");
        RuleFor(r => r.Description).MaximumLength(2000);

        RuleFor(r => r.Sessions)
            .NotEmpty().WithMessage("Add at least one session.")
            .Must(s => s.Count <= MaxSessions).WithMessage($"An event has at most {MaxSessions} sessions.")
            .Must(s => s.Count(x => x.IsCheckInSession) == 1)
            .WithMessage("Exactly one session must be the check-in session (the resepsi).");
        RuleForEach(r => r.Sessions).SetValidator(new EventSessionInputValidator());
    }
}

public sealed class EventSessionInputValidator : AbstractValidator<EventSessionInput>
{
    public EventSessionInputValidator()
    {
        RuleFor(s => s.Name).NotEmpty().MaximumLength(60);
        RuleFor(s => s.Venue).NotEmpty().MaximumLength(200);
        RuleFor(s => s.EndsAtLocal).GreaterThan(s => s.StartsAtLocal).WithMessage("The end must be after the start.");
        RuleFor(s => s.MapsUrl)
            .MaximumLength(2048)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps)
            .WithMessage("The maps link must be an https:// address.")
            .When(s => !string.IsNullOrWhiteSpace(s.MapsUrl));
    }
}

public sealed class CreateEventRequestValidator : EventInputValidator<CreateEventRequest>;

public sealed class UpdateEventRequestValidator : EventInputValidator<UpdateEventRequest>;

public sealed class AssignStaffRequestValidator : AbstractValidator<AssignStaffRequest>
{
    public AssignStaffRequestValidator()
    {
        RuleFor(r => r.UserIds).NotNull().Must(ids => ids.Count <= 100).WithMessage("At most 100 staff per event.");
    }
}
