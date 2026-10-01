using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Payments;
using EventLy.Api.Entities;
using EventLy.Api.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EventLy.Api.Services;

/// <summary>
/// Paying for an event (docs/architecture/01-system-architecture.md §5.2). The Owner picks a package,
/// the amount comes from the server-side package, and the gateway's signed webhook is the source of
/// truth: it settles the payment and activates the event in one SaveChanges. Webhooks are idempotent,
/// and reconciliation asks the gateway about payments whose webhook never arrived.
/// </summary>
public sealed class PaymentService(
    AppDbContext db,
    ICurrentUser currentUser,
    AuditService audit,
    IPaymentGateway gateway,
    TimeProvider timeProvider,
    IOptions<PaymentOptions> options,
    ILogger<PaymentService> logger)
{
    private const int MaxSaveAttempts = 3;

    /// <summary>Payments younger than this are left to their webhook by reconciliation.</summary>
    private static readonly TimeSpan ReconcileAfter = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Starts a checkout. A second request for the same package returns the open checkout
    /// (<c>Created</c> is false); another package replaces it.
    /// </summary>
    public async Task<(PaymentDto Payment, bool Created)> CreateAsync(
        Guid eventId, CreatePaymentRequest request, CancellationToken ct)
    {
        var ev = await db.Events.Include(e => e.StaffAssignments).SingleOrDefaultAsync(e => e.Id == eventId, ct)
            ?? throw EventNotFound();
        if (ev.Status is not (EventStatus.Draft or EventStatus.PendingPayment))
        {
            throw new ConflictException("payment.event_not_payable",
                "Only a draft event, or one waiting for payment, can be paid for.");
        }

        var package = await db.Packages.SingleOrDefaultAsync(p => p.Id == request.PackageId && p.IsActive, ct)
            ?? throw new NotFoundException("package.not_found", "Package not found.");
        if (ev.StaffAssignments.Count > package.Features.MaxStaff)
        {
            throw new ConflictException("payment.staff_limit_exceeded",
                $"This package allows {package.Features.MaxStaff} staff. Remove staff from the event or pick a bigger package.");
        }

        // maxGuests counts people, so a group takes all its places.
        if (await db.Guests.Where(g => g.EventId == ev.Id).SumAsync(g => g.NumberOfPeople, ct) > package.Features.MaxGuests)
        {
            throw new ConflictException("payment.guest_limit_exceeded",
                $"This package allows {package.Features.MaxGuests} guests (people). Remove guests or pick a bigger package.");
        }

        var now = timeProvider.GetUtcNow();
        var pending = await db.Payments
            .Where(p => p.EventId == ev.Id && p.Status == PaymentStatus.Pending)
            .ToListAsync(ct);
        var open = pending.FirstOrDefault(p =>
            p.PackageId == package.Id && p.Amount == package.Price && p.ExpiresAt > now && p.Provider == gateway.Provider);
        if (open is not null)
        {
            return (ToDto(open), false);
        }

        foreach (var replaced in pending)
        {
            await CloseAsync(replaced, PaymentStatus.Cancelled, ct);
        }

        var payment = new Payment
        {
            EventId = ev.Id,
            PackageId = package.Id,
            PackageSnapshot = PackageSnapshot.Of(package),
            Amount = package.Price,
            Currency = package.Currency,
            Provider = gateway.Provider,
            ExpiresAt = now.AddMinutes(options.Value.CheckoutMinutes),
        };
        var checkout = await gateway.CreateCheckoutAsync(new GatewayCheckoutRequest(
            payment.Id, payment.Amount, payment.Currency, $"EventLy {package.Name}: {ev.Name}", payment.ExpiresAt.Value), ct);
        payment.ProviderReference = checkout.ProviderReference;
        payment.CheckoutUrl = checkout.CheckoutUrl;
        db.Payments.Add(payment);

        ev.PackageId = package.Id;
        // Always write the event row, so its version check serializes two checkouts started at once.
        db.Entry(ev).Property(e => e.PackageId).IsModified = true;
        if (ev.Status == EventStatus.Draft)
        {
            ChangeEventStatus(ev, EventStatus.PendingPayment);
        }
        audit.Add(AuditActions.PaymentCreated, currentUser.UserId, ev.OrganizationId, nameof(Payment), payment.Id,
            new { package.Code, payment.Amount, payment.Currency });

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("payment.checkout_in_progress",
                "A checkout for this event was just started. Reload the event and try again.");
        }
        return (ToDto(payment), true);
    }

    public async Task<IReadOnlyList<PaymentDto>> ListForEventAsync(Guid eventId, CancellationToken ct)
    {
        if (!await db.Events.AnyAsync(e => e.Id == eventId, ct))
        {
            throw EventNotFound();
        }

        var payments = await db.Payments.AsNoTracking()
            .Where(p => p.EventId == eventId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);
        return payments.Select(ToDto).ToList();
    }

    /// <summary>The PWA polls this after checkout. An overdue checkout is reconciled on the spot.</summary>
    public async Task<PaymentDto> GetAsync(Guid id, CancellationToken ct)
    {
        var payment = await FindAsync(id, ct);
        if (payment.Status == PaymentStatus.Pending && payment.ExpiresAt <= timeProvider.GetUtcNow())
        {
            await ReconcileOneAsync(payment, ct);
            payment = await FindAsync(id, ct);
        }
        return ToDto(payment);
    }

    public async Task<PaymentReceiptDto> GetReceiptAsync(Guid id, CancellationToken ct)
    {
        var payment = await FindAsync(id, ct);
        if (payment.Status != PaymentStatus.Paid)
        {
            throw new ConflictException("payment.not_paid", "A receipt is only available for a paid payment.");
        }

        // A cancelled event can be deleted later; its receipt stays available.
        var ev = await db.Events.IgnoreQueryFilters([AppDbContext.SoftDeleteFilter]).AsNoTracking()
            .SingleAsync(e => e.Id == payment.EventId, ct);
        var organization = await db.Organizations.AsNoTracking().SingleAsync(o => o.Id == payment.OrganizationId, ct);
        var owner = await db.Users.AsNoTracking().SingleAsync(u => u.Id == organization.OwnerUserId, ct);

        return new PaymentReceiptDto(
            payment.Id, payment.ProviderReference ?? payment.Id.ToString(),
            organization.Name, organization.ContactEmail, owner.Name, owner.Email,
            ev.Id, ev.Name, ev.Date, ev.TimeZone,
            payment.PackageSnapshot.Name, payment.Amount, payment.Currency, payment.Provider, payment.PaidAt!.Value);
    }

    /// <summary>
    /// The provider's callback. A wrong signature is 401. Unknown payments and repeats are
    /// acknowledged and ignored, so the provider stops retrying.
    /// </summary>
    public async Task HandleWebhookAsync(string provider, string body, IHeaderDictionary headers, CancellationToken ct)
    {
        if (!string.Equals(provider, gateway.Provider.ToString(), StringComparison.OrdinalIgnoreCase))
        {
            throw new NotFoundException("payment.unknown_provider", "Unknown payment provider.");
        }

        var notification = gateway.VerifyWebhook(body, headers)
            ?? throw new UnauthorizedException("payment.invalid_signature", "The webhook signature is invalid.");

        // Allow-listed tenant filter bypass: a webhook carries no user, so the payment row names the organization.
        var payment = await db.Payments.IgnoreQueryFilters([AppDbContext.TenantFilter])
            .SingleOrDefaultAsync(p => p.Provider == gateway.Provider && p.ProviderReference == notification.ProviderReference, ct);
        if (payment is null)
        {
            logger.LogWarning("Webhook for unknown {Provider} payment {Reference} ignored", gateway.Provider,
                notification.ProviderReference);
            return;
        }

        db.ActAsOrganization(payment.OrganizationId);
        await ApplyAsync(payment.Id,
            new GatewayPaymentState(notification.Status, notification.Amount, notification.PaidAt), ct);
    }

    /// <summary>Development only: the simulated checkout reports its outcome through the real webhook path.</summary>
    public async Task<PaymentDto> SimulateAsync(Guid id, SimulatePaymentRequest request, CancellationToken ct)
    {
        if (gateway is not FakePaymentGateway fake)
        {
            throw new NotFoundException("payment.simulation_unavailable", "Payments can't be simulated here.");
        }

        var payment = await FindAsync(id, ct);
        if (payment.Status != PaymentStatus.Pending || payment.Provider != PaymentProvider.Fake)
        {
            throw new ConflictException("payment.not_pending", "This payment is no longer waiting for payment.");
        }

        var outcome = request.Outcome == SimulatedOutcome.Paid ? GatewayStatus.Paid : GatewayStatus.Failed;
        var webhook = fake.Simulate(payment.ProviderReference!, outcome, payment.Amount);
        await HandleWebhookAsync(gateway.Provider.ToString(), webhook.Body,
            new HeaderDictionary { [FakePaymentGateway.SignatureHeader] = webhook.Signature }, ct);

        db.ChangeTracker.Clear();
        return ToDto(await FindAsync(id, ct));
    }

    /// <summary>
    /// Scheduled job (Cloud Scheduler calls the maintenance endpoint): asks the gateway about pending
    /// payments older than a few minutes and settles, fails or expires them.
    /// </summary>
    public async Task<ReconciliationResult> ReconcileAsync(CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow();
        var cutoff = now - ReconcileAfter;
        // Allow-listed tenant filter bypass: the job works across organizations, one payment at a time.
        var due = await db.Payments.IgnoreQueryFilters([AppDbContext.TenantFilter]).AsNoTracking()
            .Where(p => p.Status == PaymentStatus.Pending && p.Provider == gateway.Provider
                && (p.CreatedAt <= cutoff || p.ExpiresAt <= now))
            .OrderBy(p => p.CreatedAt)
            .Select(p => new { p.Id, p.OrganizationId })
            .Take(200)
            .ToListAsync(ct);

        int paid = 0, failed = 0, expired = 0;
        foreach (var item in due)
        {
            db.ChangeTracker.Clear();
            db.ActAsOrganization(item.OrganizationId);
            try
            {
                var payment = await db.Payments.SingleAsync(p => p.Id == item.Id, ct);
                switch (await ReconcileOneAsync(payment, ct))
                {
                    case PaymentStatus.Paid: paid++; break;
                    case PaymentStatus.Failed: failed++; break;
                    case PaymentStatus.Expired: expired++; break;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Reconciling payment {PaymentId} failed", item.Id);
            }
        }

        if (due.Count > 0)
        {
            logger.LogInformation("Reconciled {Count} pending payment(s): {Paid} paid, {Failed} failed, {Expired} expired",
                due.Count, paid, failed, expired);
        }
        return new ReconciliationResult(due.Count, paid, failed, expired);
    }

    /// <summary>
    /// Root: the Owner paid outside the gateway (decision Q-24). Records a Manual payment that is
    /// already paid and activates the event; an open checkout is cancelled.
    /// </summary>
    public async Task<PaymentDto> ActivateManuallyAsync(Guid eventId, ManualActivationRequest request, CancellationToken ct)
    {
        // Allow-listed tenant filter bypass: Root belongs to no organization, so the event row names it.
        var organizationId = await db.Events.IgnoreQueryFilters([AppDbContext.TenantFilter])
            .Where(e => e.Id == eventId)
            .Select(e => (Guid?)e.OrganizationId)
            .SingleOrDefaultAsync(ct) ?? throw EventNotFound();
        db.ActAsOrganization(organizationId);

        var ev = await db.Events.SingleAsync(e => e.Id == eventId, ct);
        if (!EventLifecycle.CanChange(ev.Status, EventStatus.Active))
        {
            throw new ConflictException("event.invalid_status_change", $"An event that is {ev.Status} can't be activated.");
        }

        // Root may confirm an older, now inactive package that the Owner paid for.
        var package = await db.Packages.SingleOrDefaultAsync(p => p.Id == request.PackageId, ct)
            ?? throw new NotFoundException("package.not_found", "Package not found.");

        var pending = await db.Payments.Where(p => p.EventId == ev.Id && p.Status == PaymentStatus.Pending).ToListAsync(ct);
        foreach (var replaced in pending)
        {
            await CloseAsync(replaced, PaymentStatus.Cancelled, ct);
        }

        var now = timeProvider.GetUtcNow();
        var payment = new Payment
        {
            EventId = ev.Id,
            PackageId = package.Id,
            PackageSnapshot = PackageSnapshot.Of(package),
            Amount = request.Amount,
            Currency = package.Currency,
            Provider = PaymentProvider.Manual,
            Status = PaymentStatus.Paid,
            PaidAt = now,
            ConfirmedBy = currentUser.RequireUserId(),
            Note = request.Note.Trim(),
        };
        db.Payments.Add(payment);
        Activate(ev, payment);
        audit.Add(AuditActions.PaymentManualActivation, currentUser.UserId, ev.OrganizationId, nameof(Payment), payment.Id,
            new { eventId = ev.Id, package.Code, request.Amount, listPrice = package.Price });

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException || IsUniqueViolation(ex))
        {
            throw new ConflictException("payment.event_not_payable", "The event was just paid or changed. Reload and check it.");
        }
        return ToDto(payment);
    }

    /// <summary>The event is being cancelled: open checkouts are closed. The caller saves.</summary>
    public async Task CancelPendingAsync(Event ev, CancellationToken ct)
    {
        var pending = await db.Payments.Where(p => p.EventId == ev.Id && p.Status == PaymentStatus.Pending).ToListAsync(ct);
        foreach (var payment in pending)
        {
            await CloseAsync(payment, PaymentStatus.Cancelled, ct);
        }
    }

    private async Task<PaymentStatus> ReconcileOneAsync(Payment payment, CancellationToken ct)
    {
        if (payment.ProviderReference is null || payment.Provider != gateway.Provider)
        {
            return payment.Status;
        }

        var state = await gateway.GetStatusAsync(payment.ProviderReference, ct);
        if (state.Status == GatewayStatus.Pending && payment.ExpiresAt <= timeProvider.GetUtcNow())
        {
            // Close the checkout first, then ask again: it may have been paid at the last moment.
            await gateway.ExpireAsync(payment.ProviderReference, ct);
            state = await gateway.GetStatusAsync(payment.ProviderReference, ct);
            if (state.Status == GatewayStatus.Pending)
            {
                state = state with { Status = GatewayStatus.Expired };
            }
        }

        if (state.Status == GatewayStatus.Pending)
        {
            return PaymentStatus.Pending;
        }
        await ApplyAsync(payment.Id, state, ct);
        return ToPaymentStatus(state.Status);
    }

    /// <summary>
    /// Applies the gateway's state to a pending payment and its event, then saves. Repeats are no-ops.
    /// When a concurrent change wins (another webhook, the Owner editing the event), it reloads and tries again.
    /// </summary>
    private async Task ApplyAsync(Guid paymentId, GatewayPaymentState state, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            var payment = await db.Payments.SingleAsync(p => p.Id == paymentId, ct);
            if (!await TryApplyAsync(payment, state, ct))
            {
                return;
            }

            try
            {
                await db.SaveChangesAsync(ct);
                return;
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxSaveAttempts)
            {
                db.ChangeTracker.Clear();
            }
        }
    }

    private async Task<bool> TryApplyAsync(Payment payment, GatewayPaymentState state, CancellationToken ct)
    {
        if (payment.Status != PaymentStatus.Pending)
        {
            if (state.Status == GatewayStatus.Paid && payment.Status != PaymentStatus.Paid)
            {
                // Money arrived for a closed checkout. Root sorts it out with the Owner (no refunds in the MVP, Q-32).
                logger.LogWarning("Payment {PaymentId} reported paid after it was {Status}", payment.Id, payment.Status);
                audit.Add(AuditActions.PaymentLateSettlement, currentUser.UserId, payment.OrganizationId,
                    nameof(Payment), payment.Id, new { status = payment.Status.ToString(), state.Amount });
                return true;
            }
            return false;
        }

        var ev = await db.Events.IgnoreQueryFilters([AppDbContext.SoftDeleteFilter])
            .SingleAsync(e => e.Id == payment.EventId, ct);

        switch (state.Status)
        {
            case GatewayStatus.Paid when state.Amount is { } amount && amount != payment.Amount:
                logger.LogError("Payment {PaymentId}: provider reported {Reported} but {Expected} is due; left pending",
                    payment.Id, amount, payment.Amount);
                audit.Add(AuditActions.PaymentAmountMismatch, currentUser.UserId, payment.OrganizationId,
                    nameof(Payment), payment.Id, new { reported = amount, expected = payment.Amount });
                return true;

            case GatewayStatus.Paid:
                SetStatus(payment, PaymentStatus.Paid);
                payment.PaidAt = state.PaidAt ?? timeProvider.GetUtcNow();
                if (ev.DeletedAt is null && EventLifecycle.CanChange(ev.Status, EventStatus.Active))
                {
                    Activate(ev, payment);
                }
                else
                {
                    logger.LogWarning("Payment {PaymentId} settled but event {EventId} is {Status}; not activated",
                        payment.Id, ev.Id, ev.Status);
                }
                return true;

            case GatewayStatus.Failed or GatewayStatus.Expired:
                SetStatus(payment, ToPaymentStatus(state.Status));
                var otherPending = await db.Payments.AnyAsync(
                    p => p.EventId == ev.Id && p.Id != payment.Id && p.Status == PaymentStatus.Pending, ct);
                if (ev.Status == EventStatus.PendingPayment && !otherPending)
                {
                    ev.PackageId = null;
                    ChangeEventStatus(ev, EventStatus.Draft);
                }
                return true;

            default:
                return false;
        }
    }

    /// <summary>Closes a pending payment here and, best effort, at the provider.</summary>
    private async Task CloseAsync(Payment payment, PaymentStatus status, CancellationToken ct)
    {
        SetStatus(payment, status);
        if (payment.ProviderReference is null || payment.Provider != gateway.Provider)
        {
            return;
        }

        try
        {
            await gateway.ExpireAsync(payment.ProviderReference, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // If it is paid anyway, the late webhook is recorded for Root (PaymentLateSettlement).
            logger.LogWarning(ex, "Couldn't close checkout {Reference} at the provider", payment.ProviderReference);
        }
    }

    private void Activate(Event ev, Payment payment)
    {
        ev.PackageId = payment.PackageId;
        ev.PackageSnapshot = payment.PackageSnapshot.Copy();
        ev.ActivatedAt = payment.PaidAt ?? timeProvider.GetUtcNow();
        ChangeEventStatus(ev, EventStatus.Active);
    }

    private void SetStatus(Payment payment, PaymentStatus status)
    {
        var previous = payment.Status;
        payment.Status = status;
        audit.Add(AuditActions.PaymentStatusChanged, currentUser.UserId, payment.OrganizationId, nameof(Payment), payment.Id,
            new { from = previous.ToString(), to = status.ToString() });
    }

    private void ChangeEventStatus(Event ev, EventStatus status)
    {
        var previous = ev.Status;
        ev.Status = status;
        audit.Add(AuditActions.EventStatusChanged, currentUser.UserId, ev.OrganizationId, nameof(Event), ev.Id,
            new { from = previous.ToString(), to = status.ToString() });
    }

    private async Task<Payment> FindAsync(Guid id, CancellationToken ct) =>
        await db.Payments.SingleOrDefaultAsync(p => p.Id == id, ct)
        ?? throw new NotFoundException("payment.not_found", "Payment not found.");

    private static PaymentStatus ToPaymentStatus(GatewayStatus status) => status switch
    {
        GatewayStatus.Paid => PaymentStatus.Paid,
        GatewayStatus.Failed => PaymentStatus.Failed,
        GatewayStatus.Expired => PaymentStatus.Expired,
        _ => PaymentStatus.Pending,
    };

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation };

    private static NotFoundException EventNotFound() => new("event.not_found", "Event not found.");

    public static PaymentDto ToDto(Payment p) => new(
        p.Id, p.EventId, p.PackageId, p.PackageSnapshot.Name, p.Amount, p.Currency, p.Status, p.Provider,
        p.ProviderReference, p.CheckoutUrl, p.ExpiresAt, p.PaidAt, p.Note, p.CreatedAt);
}
