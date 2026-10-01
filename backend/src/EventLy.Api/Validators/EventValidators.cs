using EventLy.Api.Common.Localization;
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
            .WithMessage(_ => Texts.T($"Zona waktu harus salah satu dari: {string.Join(", ", EventTimeZones.Allowed)}.", $"Time zone must be one of: {string.Join(", ", EventTimeZones.Allowed)}."));
        RuleFor(r => r.Description).MaximumLength(2000);

        RuleFor(r => r.Sessions)
            .NotEmpty().WithMessage(_ => Texts.T("Tambahkan minimal satu sesi.", "Add at least one session."))
            .Must(s => s.Count <= MaxSessions).WithMessage(_ => Texts.T($"Satu acara maksimal {MaxSessions} sesi.", $"An event has at most {MaxSessions} sessions."))
            .Must(s => s.Count(x => x.IsCheckInSession) == 1)
            .WithMessage(_ => Texts.T("Tepat satu sesi harus menjadi sesi check-in (resepsi).", "Exactly one session must be the check-in session (the resepsi)."));
        RuleForEach(r => r.Sessions).SetValidator(new EventSessionInputValidator());
    }
}

public sealed class EventSessionInputValidator : AbstractValidator<EventSessionInput>
{
    public EventSessionInputValidator()
    {
        RuleFor(s => s.Name).NotEmpty().MaximumLength(60);
        RuleFor(s => s.Venue).NotEmpty().MaximumLength(200);
        RuleFor(s => s.EndsAtLocal).GreaterThan(s => s.StartsAtLocal).WithMessage(_ => Texts.T("Waktu selesai harus setelah waktu mulai.", "The end must be after the start."));
        RuleFor(s => s.MapsUrl)
            .MaximumLength(2048)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps)
            .WithMessage(_ => Texts.T("Link Maps harus berupa alamat https://.", "The maps link must be an https:// address."))
            .When(s => !string.IsNullOrWhiteSpace(s.MapsUrl));
    }
}

public sealed class CreateEventRequestValidator : EventInputValidator<CreateEventRequest>;

public sealed class UpdateEventRequestValidator : EventInputValidator<UpdateEventRequest>;

public sealed class AssignStaffRequestValidator : AbstractValidator<AssignStaffRequest>
{
    public AssignStaffRequestValidator()
    {
        RuleFor(r => r.UserIds).NotNull().Must(ids => ids.Count <= 100).WithMessage(_ => Texts.T("Maksimal 100 Staff per acara.", "At most 100 staff per event."));
    }
}
