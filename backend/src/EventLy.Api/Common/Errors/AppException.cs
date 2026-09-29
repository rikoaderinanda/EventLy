namespace EventLy.Api.Common.Errors;

/// <summary>
/// An expected failure thrown by a service. <see cref="AppExceptionHandler"/> turns it into
/// an RFC 7807 ProblemDetails response carrying the stable <see cref="Code"/>.
/// </summary>
public class AppException(int statusCode, string code, string title, string? detail = null)
    : Exception(detail ?? title)
{
    public int StatusCode { get; } = statusCode;

    /// <summary>Stable, machine-readable error code, for example <c>invitation.already_checked_in</c>.</summary>
    public string Code { get; } = code;

    public string Title { get; } = title;

    public string? Detail { get; } = detail;
}

public sealed class NotFoundException(string code, string title, string? detail = null)
    : AppException(StatusCodes.Status404NotFound, code, title, detail);

public sealed class ConflictException(string code, string title, string? detail = null)
    : AppException(StatusCodes.Status409Conflict, code, title, detail);

public sealed class UnauthorizedException(string code, string title, string? detail = null)
    : AppException(StatusCodes.Status401Unauthorized, code, title, detail);

public sealed class ForbiddenException(string code, string title, string? detail = null)
    : AppException(StatusCodes.Status403Forbidden, code, title, detail);
