using EventLy.Api.Auth;
using EventLy.Api.Dtos.Payments;
using EventLy.Api.Payments;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>Owner: pay for an event and follow the payment. Admin has no access (decision Q-3).</summary>
[ApiController]
[Route("api/v1")]
[Authorize(Policy = Permissions.PaymentManage)]
public sealed class PaymentsController(PaymentService payments, IHostEnvironment environment) : ControllerBase
{
    /// <summary>Starts a checkout. 201 for a new one; 200 when the open checkout for the same package is returned.</summary>
    [HttpPost("events/{eventId:guid}/payments")]
    [ProducesResponseType<PaymentDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<PaymentDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaymentDto>> Create(Guid eventId, CreatePaymentRequest request, CancellationToken ct)
    {
        var (payment, created) = await payments.CreateAsync(eventId, request, ct);
        return created ? CreatedAtAction(nameof(Get), new { id = payment.Id }, payment) : Ok(payment);
    }

    [HttpGet("events/{eventId:guid}/payments")]
    public Task<IReadOnlyList<PaymentDto>> ListForEvent(Guid eventId, CancellationToken ct) =>
        payments.ListForEventAsync(eventId, ct);

    [HttpGet("payments/{id:guid}")]
    public Task<PaymentDto> Get(Guid id, CancellationToken ct) => payments.GetAsync(id, ct);

    [HttpGet("payments/{id:guid}/receipt")]
    public Task<PaymentReceiptDto> GetReceipt(Guid id, CancellationToken ct) => payments.GetReceiptAsync(id, ct);

    /// <summary>Development only: the simulated checkout marks the payment paid or failed.</summary>
    [HttpPost("payments/{id:guid}/simulate")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<ActionResult<PaymentDto>> Simulate(Guid id, SimulatePaymentRequest request, CancellationToken ct)
    {
        if (!PaymentSetup.IsDevelopmentOrTesting(environment))
        {
            return NotFound();
        }
        return await payments.SimulateAsync(id, request, ct);
    }
}
