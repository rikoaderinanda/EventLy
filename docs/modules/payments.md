# Module: Packages & Payments

> Phase 5 · Code: `PackagesController`, `PlatformPackagesController` → `PackageService`; `PaymentsController`, `PaymentWebhooksController`, `PlatformEventsController`, `MaintenanceController` → `PaymentService` → `AppDbContext`; `Payments/` (gateway port)

An Owner pays once per event for a **package**. Paying moves the event from Draft to Active. Root manages the package catalog and can activate an event that was paid outside the gateway.

## Use cases

| Who | Can |
|---|---|
| Owner | See the catalog, start a checkout for an event, follow the payment, see the payment history and print the receipt |
| Admin | See the catalog and which package an event has. No payments (decision Q-3) |
| Staff | Nothing here. The event DTO has no package for Staff |
| Root | Create and edit packages (price, limits, flags, offered or not). See each Owner's events and payments. Activate an event manually |
| Payment provider | Send a signed webhook |
| Scheduler | Run the reconciliation with the maintenance key |

## Data

| Table | Notes |
|---|---|
| `packages` | Not tenant-owned. `code` is unique and fixed. `feature` is jsonb (`PackageFeatures`). Packages are never deleted, only set to not offered (`is_active = false`) |
| `payments` | Tenant-owned. `package_snapshot` (jsonb) is the package at checkout. `xmin` is the concurrency token. Unique `(provider, provider_reference)`. At most one `Paid` row per event (unique partial index). `confirmed_by` and `note` for manual payments |
| `events.package_id`, `events.package_snapshot`, `events.activated_at` | The package the event paid for. The snapshot is copied from the payment when it settles |

The `migrate` command seeds the initial catalog after the migrations: Basic Rp 150.000, Premium Rp 350.000, Enterprise Rp 1.000.000 (Q-37), with the limits of ERD §5. The seed only adds missing codes, so Root's edits are never overwritten. `maxAdmins` has no value in the ERD for Premium and Enterprise, so the seed uses 2 and 5. Root can change both.

## Payment gateway

`IPaymentGateway` is the one abstraction in this module. There are two reasons for it: the provider can be swapped (Xendit comes later, Q-1b), and development and CI need a fake because real payments can't run there.

| Setting | Values |
|---|---|
| `Payments__Provider` | `Fake` (default). The app refuses to start with `Fake` outside Development and Testing, because anyone could "pay" through the simulated checkout. **Production needs the Xendit adapter first (Phase 12 at the latest)** |
| `Payments__CheckoutMinutes` | How long a checkout can be paid. Default 1440 (24 hours) |
| `Maintenance__Key` | Secret for the maintenance endpoints. Empty turns them off (404) |

`FakePaymentGateway` keeps its state in memory and signs its webhooks with a key that is new for each process. Its checkout URL is `/app/payments/{id}`, a page of the PWA with "payment succeeds" and "payment fails" buttons (`POST /payments/{id}/simulate`, Development and Testing only). The result travels as a signed webhook through the same code path a real provider uses.

## Rules

- **The amount comes from the server-side package**, never from the client.
- **Checkout** (`POST /events/{id}/payments {packageId}`): only for a Draft or PendingPayment event, otherwise 409 `payment.event_not_payable`. The package must be offered (404 `package.not_found`). If the event already has more Staff than the package's `maxStaff`, the answer is 409 `payment.staff_limit_exceeded`. The event becomes PendingPayment.
  - Asking again for the same package returns the open checkout (200 instead of 201), so a double click doesn't create two payments.
  - Choosing another package cancels the open checkout, here and at the provider.
  - Two checkouts started at the same moment are serialized by the event's version, and the loser gets 409 `payment.checkout_in_progress`.
- **Webhook** (`POST /payments/webhooks/{provider}`, anonymous):
  - An unknown provider gives 404. A wrong signature gives 401 `payment.invalid_signature`.
  - An unknown payment reference is acknowledged (200) and logged, so the provider stops retrying.
  - **Idempotent:** a repeat, or a different status after the payment is closed, changes nothing. Duplicate webhooks arriving together settle the payment once, because the `xmin` check makes the loser reload and see it is already paid.
  - **Paid:** the payment becomes Paid. The event becomes Active, gets the package snapshot and `activated_at`. All of this happens in one `SaveChanges`.
  - **Paid with a different amount:** the payment stays pending, and `payment.amount_mismatch` is written to the audit log for Root.
  - **Failed or expired:** the payment closes. The event goes back to Draft when no other checkout is open.
  - **Paid after the payment was closed** (replaced, expired, or the event was cancelled): nothing is activated. `payment.late_settlement` is written to the audit log, and Root sorts it out with the Owner. There are no refunds in the MVP (Q-32).
- **Reconciliation** (`POST /maintenance/payments/reconcile`, header `X-Maintenance-Key`):
  - Asks the gateway about every pending payment older than 5 minutes (at most 200 per run). A payment that was paid but whose webhook was lost is settled.
  - An overdue checkout is closed at the provider and then checked again, in case it was paid at the last moment. If it is still unpaid, it expires.
  - Cloud Scheduler will call it (Phase 12). Locally, call it with curl (see the setup guide).
  - `GET /payments/{id}` also reconciles an overdue checkout on the spot, so the Owner never waits for the scheduler.
- **Cancelling an event** closes its open checkout.
- **Staff limit:** after payment, assigning more Staff than the package's `maxStaff` gives 409 `event.staff_limit_exceeded`.
- **Admin limit (Q-54):** an organization can have at most the largest `maxAdmins` among its Active events' packages, or, with no Active event, the largest offered package. Invited and active Admins count, disabled ones don't. Inviting an Admin, promoting Staff, or re-enabling an Admin past the limit gives 422 `user.admin_limit_exceeded`, checked under a row lock on the organization. Existing Admins are never removed.
- **Q-20:** Root's edits to a package apply to new checkouts only. A paid event keeps its snapshot (name, price, limits), and a payment keeps its amount.
- **Manual activation** (`POST /platform/events/{id}/activate {packageId, amount, note}`, Root):
  - Allowed for a Draft or PendingPayment event.
  - Records a `Manual` payment that is already Paid, with the amount received, the note and `confirmed_by`. An open checkout is cancelled.
  - The package may be one that is no longer offered.
  - Written to the audit log as `payment.manual_activation`.
- **Receipt** (`GET /payments/{id}/receipt`): only for a paid payment, otherwise 409 `payment.not_paid`. It is printed from the browser (Q-36) and is not a tax invoice.
- **Tenant isolation:** another organization's payment or event gives 404. The webhook, reconciliation and Root are the allow-listed places that look across organizations. They read the row that names the organization and then act as that organization (`AppDbContext.ActAsOrganization`), so the tenant filter and interceptor still apply to everything they change. `TenantFilterBypassTests` fails on any other use of `IgnoreQueryFilters`.
- **Audit:** `package.created`, `package.updated`, `payment.created`, `payment.status_changed`, `payment.manual_activation`, `payment.amount_mismatch`, `payment.late_settlement`, `event.status_changed`.

## Endpoints

| Method | Path | Who |
|---|---|---|
| GET | `/packages`, `/packages/{id}` | Owner, Admin (active packages, cached 1 hour, `pkg:all`) |
| GET, POST | `/platform/packages` · PUT `/platform/packages/{id}` | Root |
| POST | `/events/{eventId}/payments` | Owner |
| GET | `/events/{eventId}/payments` | Owner |
| GET | `/payments/{id}`, `/payments/{id}/receipt` | Owner |
| POST | `/payments/{id}/simulate` | Owner, Development and Testing only |
| POST | `/payments/webhooks/{provider}` | Provider (signature) |
| GET | `/platform/owners/{id}` | Root: Owner with events and payments |
| POST | `/platform/events/{eventId}/activate` | Root |
| POST | `/maintenance/payments/reconcile` | Scheduler (maintenance key) |

## Frontend

- `web/src/features/payments/`:
  - **Package & payment** section on the event page: package cards, pay, continue an open checkout, payment history, the paid package with its limits.
  - **Payment page** `/app/payments/:id`: polls every 3 seconds while the payment is pending, and shows the simulated checkout for the fake gateway.
  - **Receipt** `/app/payments/:id/receipt`: a print stylesheet hides the app header and navigation.
- `web/src/features/platform/`: the Root area has an Owners tab and a Packages tab.
  - **Packages:** create and edit packages with their limits and flags.
  - **Owner details:** the Owner's events and payments, and the manual activation form.

## Tests

- **Unit:**
  - `FakePaymentGatewayTests`: signature, tampered body, foreign key, expiry.
  - `PaymentValidatorsTests`: whole-rupiah prices, IDR only, guest photo limit, manual activation note, seeded prices.
  - `EventLifecycleTests`: includes Draft → Active.
  - `TenantFilterBypassTests`: the allow-list.
- **Integration:**
  - `PackagesTests`: catalog, Root management, cache eviction, 403 for the other roles.
  - `PaymentsTests`: amount from the server, reused and replaced checkouts, webhook replay and concurrent duplicates, tampered signature, wrong amount, failed payment back to Draft, lost webhook and expiry by reconciliation, maintenance key, receipt, staff limits, the Q-20 snapshot, Admin and Staff 403.
  - `PlatformPaymentsTests`: manual activation, Owner details.
  - `AdminLimitTests`: the limit before and after payment, disabled Admins, promotion, invitations at the same moment.
  - `TenantIsolationTests`: payments.
