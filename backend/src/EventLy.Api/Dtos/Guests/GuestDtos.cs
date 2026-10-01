using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.Guests;

/// <summary>The fields create and update share, so both use one validator.</summary>
public interface IGuestInput
{
    string Name { get; }

    string? Phone { get; }

    string? Email { get; }

    GuestType GuestType { get; }

    int NumberOfPeople { get; }

    /// <summary>Sessions the guest is invited to. Null on create means all sessions (Q-38).</summary>
    IReadOnlyList<Guid>? SessionIds { get; }
}

public sealed record CreateGuestRequest(
    string Name,
    string? Phone,
    string? Email,
    GuestType GuestType,
    int NumberOfPeople,
    IReadOnlyList<Guid>? SessionIds) : IGuestInput;

/// <summary>Null <see cref="SessionIds"/> keeps the current sessions.</summary>
public sealed record UpdateGuestRequest(
    string Name,
    string? Phone,
    string? Email,
    GuestType GuestType,
    int NumberOfPeople,
    IReadOnlyList<Guid>? SessionIds) : IGuestInput;

/// <summary><see cref="Url"/> is null until the event is paid (Active): links can't be sent before that (Q-48).</summary>
public sealed record InvitationSummaryDto(Guid Id, string Code, string? Url, InvitationStatus Status, DateTimeOffset? OpenedAt);

public sealed record GuestDto(
    Guid Id,
    Guid EventId,
    string Name,
    string? Phone,
    string? Email,
    GuestType GuestType,
    int NumberOfPeople,
    IReadOnlyList<Guid> SessionIds,
    InvitationSummaryDto Invitation,
    RsvpStatus Rsvp,
    DateTimeOffset CreatedAt);

/// <summary>
/// The guest list with the quota. <see cref="Total"/> (invitations) and <see cref="TotalPeople"/> cover every
/// guest of the event, not only the filtered ones. <see cref="Limit"/> is the package's maxGuests, which
/// counts people, compared with <see cref="TotalPeople"/> (null while no package is paid).
/// </summary>
public sealed record GuestListDto(IReadOnlyList<GuestDto> Guests, int Total, int TotalPeople, int? Limit);

public sealed record GuestListQuery(string? Search, GuestType? Type, InvitationStatus? Status, RsvpStatus? Rsvp);

public sealed record InvitationGuestDto(Guid Id, string Name, string? Phone, GuestType GuestType, int NumberOfPeople);

public sealed record InvitationDto(
    Guid Id,
    Guid EventId,
    string Code,
    string? Url,
    GuestType Type,
    InvitationStatus Status,
    DateTimeOffset? OpenedAt,
    InvitationGuestDto Guest,
    DateTimeOffset CreatedAt);

/// <summary><see cref="Phone"/> is the normalised number, null when the guest has none (WhatsApp asks for a contact).</summary>
public sealed record WhatsAppLinkDto(string Url, string Message, string? Phone);

public sealed record WhatsAppTemplateDto(string Template, bool IsDefault);

/// <summary>Null resets the event to the default message.</summary>
public sealed record UpdateWhatsAppTemplateRequest(string? Template);

/// <summary>A line of an imported file that can't be used, with every reason.</summary>
public sealed record GuestImportErrorDto(int Line, string Name, IReadOnlyList<string> Messages);

/// <summary>All or nothing: with any <see cref="Errors"/>, nothing was imported.</summary>
public sealed record GuestImportResultDto(int Imported, int People, IReadOnlyList<GuestImportErrorDto> Errors);

/// <summary>One cell of the printable QR sheet (decision Q-27).</summary>
public sealed record QrSheetItemDto(Guid InvitationId, string GuestName, GuestType Type, int NumberOfPeople, string Url, string Svg);
