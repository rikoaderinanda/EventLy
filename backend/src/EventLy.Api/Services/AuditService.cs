using System.Diagnostics;
using System.Text.Json;
using EventLy.Api.Data;
using EventLy.Api.Entities;

namespace EventLy.Api.Services;

/// <summary>
/// Adds audit rows to the same <see cref="AppDbContext"/> as the business change, so both are
/// committed by the caller's single SaveChanges.
/// </summary>
public sealed class AuditService(AppDbContext db, IHttpContextAccessor httpContextAccessor, TimeProvider timeProvider)
{
    public void Add(
        string action,
        Guid? userId,
        Guid? organizationId = null,
        string? entityType = null,
        Guid? entityId = null,
        object? metadata = null)
    {
        var http = httpContextAccessor.HttpContext;
        var userAgent = http?.Request.Headers.UserAgent.ToString();

        db.AuditLogs.Add(new AuditLog
        {
            Action = action,
            UserId = userId,
            OrganizationId = organizationId,
            EntityType = entityType,
            EntityId = entityId,
            Metadata = metadata is null ? null : JsonSerializer.Serialize(metadata),
            Timestamp = timeProvider.GetUtcNow(),
            IpAddress = http?.Connection.RemoteIpAddress,
            UserAgent = string.IsNullOrEmpty(userAgent) ? null : userAgent[..Math.Min(userAgent.Length, 512)],
            CorrelationId = Activity.Current?.TraceId.ToString() ?? http?.TraceIdentifier,
        });
    }
}
