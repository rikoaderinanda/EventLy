using EventLy.Api.Entities;

namespace EventLy.Api.Payments;

/// <summary>Settings under <c>Payments</c>.</summary>
public sealed class PaymentOptions
{
    public const string SectionName = "Payments";

    /// <summary>Only <see cref="PaymentProvider.Fake"/> exists so far; the Xendit adapter comes later (Q-1b).</summary>
    public PaymentProvider Provider { get; init; } = PaymentProvider.Fake;

    /// <summary>How long a checkout can be paid before it expires.</summary>
    public int CheckoutMinutes { get; init; } = 24 * 60;
}

public static class PaymentSetup
{
    public static IServiceCollection AddPayments(
        this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var section = configuration.GetSection(PaymentOptions.SectionName);
        var options = section.Get<PaymentOptions>() ?? new PaymentOptions();
        services.Configure<PaymentOptions>(section);

        switch (options.Provider)
        {
            case PaymentProvider.Fake when IsDevelopmentOrTesting(environment):
                services.AddSingleton<FakePaymentGateway>();
                services.AddSingleton<IPaymentGateway>(sp => sp.GetRequiredService<FakePaymentGateway>());
                break;
            case PaymentProvider.Fake:
                // Anyone could "pay" through the simulated checkout, so it never runs in production.
                throw new InvalidOperationException(
                    "Payments:Provider 'Fake' is only allowed in Development and Testing.");
            default:
                throw new InvalidOperationException(
                    $"Payments:Provider '{options.Provider}' is not supported yet. Use 'Fake' (Development/Testing).");
        }

        return services;
    }

    public static bool IsDevelopmentOrTesting(IHostEnvironment environment) =>
        environment.IsDevelopment() || environment.IsEnvironment("Testing");
}
