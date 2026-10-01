using EventLy.Api.Auth;
using EventLy.Api.Dtos.Payments;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>Root: activate an event that was paid outside the gateway (decision Q-24).</summary>
[ApiController]
[Route("api/v1/platform/events")]
[Authorize(Policy = Permissions.PlatformEventsActivateManual)]
public sealed class PlatformEventsController(PaymentService payments) : ControllerBase
{
    [HttpPost("{eventId:guid}/activate")]
    public Task<PaymentDto> Activate(Guid eventId, ManualActivationRequest request, CancellationToken ct) =>
        payments.ActivateManuallyAsync(eventId, request, ct);
}
