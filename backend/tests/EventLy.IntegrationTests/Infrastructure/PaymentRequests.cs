using System.Net.Http.Json;
using EventLy.Api.Common.Options;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Dtos.Payments;
using EventLy.Api.Payments;
using Microsoft.Extensions.DependencyInjection;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>Calls for package and payment tests. Webhooks are built by the fake gateway, signed as it would.</summary>
public static class PaymentRequests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static FakePaymentGateway Gateway(ApiFactory factory) => factory.Services.GetRequiredService<FakePaymentGateway>();

    public static async Task<PackageDto> PackageAsync(HttpClient client, Member member, string code)
    {
        var packages = await ReadAsync<List<PackageDto>>(
            await TenantBuilder.SendAsync(client, HttpMethod.Get, "/api/v1/packages", member.AccessToken));
        return packages.Single(p => p.Code == code);
    }

    public static Task<HttpResponseMessage> CheckoutAsync(HttpClient client, Member member, Guid eventId, Guid packageId) =>
        TenantBuilder.SendAsync(client, HttpMethod.Post, $"/api/v1/events/{eventId}/payments", member.AccessToken,
            new CreatePaymentRequest(packageId));

    public static async Task<PaymentDto> StartCheckoutAsync(HttpClient client, Member member, Guid eventId, Guid packageId)
    {
        var response = await CheckoutAsync(client, member, eventId, packageId);
        response.EnsureSuccessStatusCode();
        return await ReadAsync<PaymentDto>(response);
    }

    public static async Task<PaymentDto> GetPaymentAsync(HttpClient client, Member member, Guid paymentId) =>
        await ReadAsync<PaymentDto>(
            await TenantBuilder.SendAsync(client, HttpMethod.Get, $"/api/v1/payments/{paymentId}", member.AccessToken));

    /// <summary>The provider's callback, delivered to the webhook endpoint like the provider would.</summary>
    public static Task<HttpResponseMessage> DeliverAsync(HttpClient client, FakeWebhook webhook, string? signature = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/payments/webhooks/fake")
        {
            Content = new StringContent(webhook.Body, System.Text.Encoding.UTF8, "application/json"),
        };
        request.Headers.Add(FakePaymentGateway.SignatureHeader, signature ?? webhook.Signature);
        return client.SendAsync(request, Ct);
    }

    /// <summary>Owner pays: the provider records it and the webhook arrives.</summary>
    public static async Task PayAsync(ApiFactory factory, HttpClient client, PaymentDto payment)
    {
        var webhook = Gateway(factory).Simulate(payment.ProviderReference!, GatewayStatus.Paid, payment.Amount);
        (await DeliverAsync(client, webhook)).EnsureSuccessStatusCode();
    }

    public static Task<HttpResponseMessage> ReconcileAsync(HttpClient client, string? key = ApiFactory.MaintenanceKey)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/maintenance/payments/reconcile");
        if (key is not null)
        {
            request.Headers.Add(MaintenanceOptions.KeyHeader, key);
        }
        return client.SendAsync(request, Ct);
    }

    public static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<T>(AuthClient.Json, Ct))!;
    }
}
