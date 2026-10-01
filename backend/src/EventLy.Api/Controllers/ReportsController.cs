using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Common.Setup;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EventLy.Api.Controllers;

/// <summary>Event reports as CSV or Excel (Phase 10). Owner/Admin; Excel needs the package's <c>excelExport</c>.</summary>
[ApiController]
[Route("api/v1/events/{eventId:guid}/reports")]
[Authorize(Policy = Permissions.ReportExport)]
[EnableRateLimiting(PublicSetup.ExportPolicy)]
public sealed class ReportsController(ReportService reports) : ControllerBase
{
    private static readonly Dictionary<string, ReportKind> Kinds = new(StringComparer.OrdinalIgnoreCase)
    {
        ["guests"] = ReportKind.Guests,
        ["check-ins"] = ReportKind.CheckIns,
        ["photos"] = ReportKind.Photos,
        ["wishes"] = ReportKind.Wishes,
        ["gifts"] = ReportKind.Gifts,
    };

    /// <summary><c>kind</c>: guests, check-ins, photos, wishes or gifts. <c>format</c>: csv (default) or xlsx.</summary>
    [HttpGet("{kind}")]
    [Produces(ReportService.CsvContentType, ReportService.XlsxContentType)]
    public async Task<IActionResult> Export(Guid eventId, string kind, [FromQuery] string? format, CancellationToken ct)
    {
        if (!Kinds.TryGetValue(kind, out var reportKind))
        {
            throw new NotFoundException("report.not_found", "Unknown report.");
        }
        var file = await reports.ExportAsync(eventId, reportKind, ParseFormat(format), ct);
        return File(file.Content, file.ContentType, file.FileName);
    }

    /// <summary>Every report in one Excel workbook, one sheet each.</summary>
    [HttpGet]
    [Produces(ReportService.XlsxContentType)]
    public async Task<IActionResult> ExportAll(Guid eventId, CancellationToken ct)
    {
        var file = await reports.ExportAllAsync(eventId, ct);
        return File(file.Content, file.ContentType, file.FileName);
    }

    private static ReportFormat ParseFormat(string? format) => format?.ToLowerInvariant() switch
    {
        null or "" or "csv" => ReportFormat.Csv,
        "xlsx" => ReportFormat.Xlsx,
        _ => throw new AppException(StatusCodes.Status400BadRequest, "report.invalid_format", "Format must be csv or xlsx."),
    };
}
