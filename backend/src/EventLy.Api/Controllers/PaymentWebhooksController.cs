using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>
/// Callbacks from the payment provider. Anonymous on purpose: the provider's signature is the
/// authentication, checked by the gateway before anything is read.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/v1/payments/webhooks")]
public sealed class PaymentWebhooksController(PaymentService payments) : ControllerBase
{
    [HttpPost("{provider}")]
    [RequestSizeLimit(64 * 1024)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Receive(string provider, CancellationToken ct)
    {
        // The raw body is needed as sent: the signature covers the exact bytes.
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(ct);
        await payments.HandleWebhookAsync(provider, body, Request.Headers, ct);
        return Ok();
    }
}
