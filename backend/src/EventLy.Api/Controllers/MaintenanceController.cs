using System.Security.Cryptography;
using System.Text;
using EventLy.Api.Common.Errors;
using EventLy.Api.Common.Options;
using EventLy.Api.Dtos.Payments;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace EventLy.Api.Controllers;

/// <summary>
/// Jobs run by a scheduler, not by users: protected by the maintenance key instead of a sign-in.
/// Without a configured key the endpoints don't exist (404).
/// </summary>
[ApiController]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
[Route("api/v1/maintenance")]
public sealed class MaintenanceController(PaymentService payments, IOptions<MaintenanceOptions> options) : ControllerBase
{
    /// <summary>Re-checks pending payments with the gateway (lost webhooks, expired checkouts).</summary>
    [HttpPost("payments/reconcile")]
    public Task<ReconciliationResult> ReconcilePayments(CancellationToken ct)
    {
        RequireKey();
        return payments.ReconcileAsync(ct);
    }

    private void RequireKey()
    {
        var expected = options.Value.Key;
        if (string.IsNullOrEmpty(expected))
        {
            throw new NotFoundException("route.not_found", "Endpoint not found.");
        }

        var given = Request.Headers[MaintenanceOptions.KeyHeader].ToString();
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(given), Encoding.UTF8.GetBytes(expected)))
        {
            throw new UnauthorizedException("maintenance.invalid_key", "Invalid maintenance key.");
        }
    }
}
