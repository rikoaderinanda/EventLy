# EventLy — API Design

> Phase 0 deliverable · Status: **Draft, awaiting approval**

## 1. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1` (URL versioning) |
| Format | JSON, `camelCase`, UTF-8. Dates are ISO-8601 UTC (`2026-10-10T03:00:00Z`) |
| Auth header | `Authorization: Bearer <access JWT>`. Guest endpoints under `/api/v1/public/**` take no JWT |
| Tenant | Taken from the JWT `org_id` claim. **No `organizationId` in routes** for tenant-scoped resources |
| IDs | UUID strings |
| Pagination | `?page=1&pageSize=20` (max 100) → `{ items, page, pageSize, totalCount }` |
| Filtering / sort | `?search=&status=&sort=name,-createdAt` |
| Idempotency | `Idempotency-Key` header is accepted on `POST /payments` and `POST /photos`. It is not required |
| Concurrency | `ETag` / `If-Match` on `PUT` for Event and Guest (maps to `xmin`) |
| Errors | RFC 7807 `application/problem+json` (below) |
| Docs | OpenAPI 3.1 at `/openapi/v1.json`, Scalar UI at `/docs` (disabled in production unless enabled by configuration) |

### Error shape

```json
{
  "type": "https://evently.app/errors/invitation.already_checked_in",
  "title": "Invitation already checked in",
  "status": 409,
  "code": "invitation.already_checked_in",
  "detail": "Checked in at 2026-10-10T03:12:44Z by Staff 'Rina'.",
  "traceId": "00-4bf92f...-01",
  "errors": { "name": ["Name is required."] }
}
```

| Status | Used for |
|---|---|
| 400 | Validation failed (`errors` map filled in) |
| 401 | Missing or expired token |
| 403 | Authenticated but lacks the permission |
| 404 | Not found **or belongs to another tenant** |
| 409 | Business-rule conflict (already checked in, org already exists, event not in right state) |
| 412 | `If-Match` mismatch |
| 413 | Upload too large |
| 422 | Package quota exceeded |
| 429 | Rate limited (`Retry-After`) |

## 2. Endpoint catalog

Legend for roles: **Root** = platform administrator, **O** = Owner, **A** = Admin, **S** = Staff, **G** = Guest (invitation code), **—** = anonymous.

### 2.1 Identity — `/api/v1/auth`, `/api/v1/users`

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/auth/google` | — | **Sign-in for every role** `{idToken}`. The API verifies the Google ID token. Registered Admin/Staff/Root emails sign in to their account; any other Google account becomes a new Owner (no organization yet) → `{accessToken, expiresIn, user, isNewUser}` + refresh cookie. Rate-limited, audited |
| POST | `/auth/refresh` | cookie | Rotates the refresh token → new access token |
| POST | `/auth/logout` | any | Revokes the refresh-token family, clears the cookie |
| GET | `/auth/me` | O A S | Current user, role, org, permissions |
| GET | `/users?role=` | O | List org users (Admin + Staff) |
| POST | `/users` | O | Register an Admin or Staff `{name, googleEmail, role}` → status **Invited** until their first Google sign-in |
| PUT | `/users/{id}` | O | Update name, role or status (enable/disable) |
| DELETE | `/users/{id}` | O | Deactivate a user (soft) |

### 2.2 Organization — `/api/v1/organization`

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/organization` | O (no org yet) | Create the organization → 201 + **re-issued tokens** that include `org_id`. 409 if one already exists |
| GET | `/organization` | O A S | Organization profile |
| PUT | `/organization` | O | Update the profile |

The route is singular because a user belongs to exactly one organization.

### 2.3 Event — `/api/v1/events`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/events?status=&category=&from=&to=` | O A · S (assigned only) | List events |
| POST | `/events` | O A | Create a Draft `{name, category, timeZone, description, sessions: [{name, startsAtLocal, endsAtLocal, venue, mapsUrl, isCheckInSession}]}`. Times are venue-local (no offset) and converted with the event time zone (WIB/WITA/WIT). Exactly one check-in session. Date/venue of the event = the check-in session's |
| GET | `/events/{id}` | O A · S (assigned) | Event details (Staff get a reduced DTO with no package or payment fields) |
| PUT | `/events/{id}` | O A | Update, same body plus `version` (optimistic concurrency: a stale version gives 409 `event.modified_elsewhere`). Sessions with an `id` are updated in place, new ones added, missing ones removed. Completed/Cancelled events are read-only |
| DELETE | `/events/{id}` | O A | Soft delete. Allowed only in `Draft` or `Cancelled` **[Q-4]** |
| POST | `/events/{id}/cancel` | O | Cancel |
| POST | `/events/{id}/complete` | O A | Mark the event completed |
| GET | `/events/{id}/wishes` | O A | All wishes, including hidden ones |
| POST | `/events/{id}/wishes/{wishId}/hide` · `/unhide` · DELETE `/events/{id}/wishes/{wishId}` | O A | Moderation |
| GET / PUT | `/events/{id}/gifts` | O A | `{accounts, address}`: list / replace the bank and e-wallet accounts (max 5) and the gift address |
| PUT | `/events/{id}/gift-qris` · `/events/{id}/music` | O A | Upload the QRIS image / music file (`multipart/form-data`; music MP3/M4A max 10 MB). **Phase 9** (needs storage) |
| GET | `/events/{id}/gift-confirmations` | O A | Gift confirmations from guests (Q-41) |
| GET | `/events/{id}/staff` | O | Staff assigned to the event |
| PUT | `/events/{id}/staff` | O | Replace assignments `{userIds: [...]}` (checked against the package's `maxStaff`) |

### 2.4 Package — `/api/v1/packages`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/packages` | O A | Active package catalog (cached) |
| GET | `/packages/{id}` | O A | Package details and features |

The catalog is edited by the **Root** user (decided 2026-09-29):

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/platform/packages` | Root | All packages, including inactive ones |
| POST | `/platform/packages` | Root | Create `{code, name, price, currency, feature, isActive}` |
| PUT | `/platform/packages/{id}` | Root | Edit price, limits or active status (does not affect already-paid events, Q-20) |

Root also manages Owner accounts:

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/platform/owners?search=&status=` | Root | Owners with organization, events, packages bought and payment status |
| GET | `/platform/owners/{id}` | Root | Owner details: events (name, date, status, package) and payments. The list (`GET /platform/owners`) carries counts `{events, paidEvents, pendingPayments}` |
| POST | `/platform/owners/{id}/suspend` · `/reactivate` | Root | Suspend or reactivate (blocks the whole organization from logging in) |
| POST | `/platform/events/{eventId}/activate` | Root | Manual activation for a payment made outside Xendit `{packageId, amount, note}`. Creates a `Manual` payment (status Paid), activates the event, writes an audit log |

The Root account is the Google email set in the environment variable `Root__Email`.

### 2.5 Payment — `/api/v1/payments`

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/events/{eventId}/payments` | O | `{packageId}` → sets the event package, creates a Pending payment and returns the payment `{id, status, amount, currency, packageName, checkoutUrl, expiresAt, ...}` (201). Event → `PendingPayment`. The same package again returns the open checkout (200); another package cancels it. 409 `payment.event_not_payable` unless Draft/PendingPayment, 409 `payment.staff_limit_exceeded` when the event has more Staff than the package allows |
| GET | `/events/{eventId}/payments` | O | Payment history for the event, newest first |
| GET | `/payments/{id}/receipt` | O | Receipt data for the printable receipt page (paid payments only, otherwise 409 `payment.not_paid`) |
| GET | `/payments/{id}` | O | Payment status (the frontend polls this after checkout). An overdue checkout is reconciled on the spot |
| POST | `/payments/webhooks/{provider}` | — (signature) | Provider callback. Signature is verified (401 `payment.invalid_signature`). Idempotent; unknown payments are acknowledged with 200. On `Paid` → event becomes `Active`. A different amount leaves the payment pending for Root |
| POST | `/payments/{id}/simulate` | O (**Development/Testing only**) | Fake gateway: `{outcome: "Paid" \| "Failed"}`, delivered through the webhook path |
| POST | `/maintenance/payments/reconcile` | — (`X-Maintenance-Key`) | Scheduled job: settles payments whose webhook was lost and expires overdue checkouts. Returns `{checked, paid, failed, expired}`. 404 when no key is configured |

Details and rules: [docs/modules/payments.md](../modules/payments.md).

### 2.6 Guest — `/api/v1/events/{eventId}/guests`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/events/{eventId}/guests?search=&type=&status=&rsvp=&checkedIn=` | O A | `{guests, total, totalPeople, limit}`: guests with their invitation (RSVP and check-in status from Phases 7 and 8) and the package quota |
| POST | `/events/{eventId}/guests` | O A | Create a guest **and its invitation** in one step `{name, phone, email, guestType, numberOfPeople, sessionIds}` (see 2.7). `sessionIds` null = all sessions (Q-38) |
| POST | `/events/{eventId}/guests/import` | O A | CSV bulk import **[Q-12]**: all or nothing, `{imported, people, errors: [{line, name, messages}]}`, guest limit for the whole file (422) |
| GET | `/events/{eventId}/guests/{guestId}` | O A | Details |
| PUT | `/events/{eventId}/guests/{guestId}` | O A | Update |
| DELETE | `/events/{eventId}/guests/{guestId}` | O A | Soft delete (409 if checked in) |

Creating guests, and growing a group, is checked against the package's `maxGuests` (422 `guest.quota_exceeded`). It counts **people**: a group of 4 takes 4 places (Q-46). Details: [docs/modules/guests.md](../modules/guests.md).

### 2.7 Invitation — `/api/v1/invitations`

Because the invitation is the identity unit and the relationship is 1:1, **creating a guest creates its invitation** automatically. `guestType` / `numberOfPeople` determine `Individual` vs `Group`.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/invitations/{id}` | O A | Details `{code, url, type, status, guest, rsvp, checkIn}` |
| — | — | — | Before the event is paid, the invitation `url` is null and the WhatsApp link, QR and QR sheet give 409 `invitation.event_not_paid` (Q-48) |
| GET | `/invitations/{id}/whatsapp-link` | O A | `{url}` = `https://wa.me/628…?text=…` built from the event's message template. The PWA opens it |
| GET | `/invitations/{id}/qr?format=png\|svg&size=` | O A | QR image, rendered on demand (`Cache-Control: private, no-store`) |
| POST | `/invitations/{id}/regenerate-code` | O A | Rotates the code (old link stops working) and reactivates a revoked invitation. Blocked after check-in (Phase 8) |
| POST | `/invitations/{id}/revoke` | O A | Revoke. The WhatsApp link and QR then give 409 `invitation.revoked` |
| GET | `/events/{eventId}/invitations/qr-sheet` | O A | All active invitations with their QR (SVG). The PWA prints the sheet from the browser (no ZIP/PDF) |
| GET · PUT | `/events/{eventId}/whatsapp-template` | O A | The event's WhatsApp message `{template, isDefault}` with `{nama}`, `{acara}`, `{link}` (required). `null` resets it |

The guest list carries each invitation, so there is no separate invitation list endpoint.

### 2.8 RSVP (organizer side)

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/events/{eventId}/rsvps?status=` | O A | RSVP list for monitoring (one row per invitation; no answer = `Pending`) |
| GET | `/events/{eventId}/rsvps/summary` | O A | `{invitations, opened, pending, attending, notAttending, expectedPeople}` over active invitations |

Details of the guest side (2.9) and these endpoints: [docs/modules/guest-portal.md](../modules/guest-portal.md).

### 2.9 Public guest API — `/api/v1/public/invitations/{code}`

Anonymous, keyed by the 128-bit code. Rate-limited per IP (reads 60/min, writes 10/min). `Referrer-Policy: no-referrer`. Every response is **404 `invitation.not_found` for unknown, revoked, deleted-guest, unpaid (Draft/PendingPayment) or cancelled-event codes**. A feature switched off in the package gives 404 `feature.not_available`.

| Method | Path | Description |
|---|---|---|
| GET | `/public/invitations/{code}` | `{guestName, numberOfPeople, type, event: {name, category, description, coverUrl, sessions: [{name, startsAt, endsAt, venue, mapsUrl}]}, rsvp: {status, respondedAt}, checkedIn: bool}`. Sets `opened_at` on first view |
| PUT | `/public/invitations/{code}/rsvp` | `{status: "Attending" \| "NotAttending"}`. Allowed until the event is over (last session ends, Q-47), then 409 `rsvp.closed` |
| GET | `/public/invitations/{code}/qr` | QR image, so the guest can show it at the entrance |
| GET | `/public/invitations/{code}/gallery` | **403 `gallery.locked` until checked in**. Then `[{photoId, thumbnailUrl, createdAt}]` (pre-signed URLs, 10 min) |
| POST | `/public/invitations/{code}/photos` | **Guest camera capture (spec change 2026-09-29).** Receives the JPEG taken with the in-app camera (the UI has no file picker). Only after check-in and within the time window, only if the package and event allow it, up to `maxGuestPhotosPerInvitation`. Same file checks as staff uploads. Rate-limited |
| DELETE | `/public/invitations/{code}/photos/{photoId}` | Guest deletes a photo **they took** (not staff photos) |
| GET | `/public/invitations/{code}/wishes?page=` | Wishes of this event (visible ones only): `[{guestName, message, createdAt}]` |
| PUT | `/public/invitations/{code}/wish` | Create or edit this invitation's wish `{message}` (max 500, rate-limited) |
| GET | `/public/invitations/{code}/gifts` | Bank/e-wallet accounts, gift address, QRIS image URL (null until Phase 9) |
| POST | `/public/invitations/{code}/gift-confirmations` | Optional "konfirmasi hadiah" `{senderName, amount?, note?}` (Q-41) |
| GET | `/public/invitations/{code}/music` | 302 to a short-lived URL of the event's music file **(Phase 9)** |
| GET | `/public/invitations/{code}/gallery/{photoId}/download` | 302 to a pre-signed URL with `Content-Disposition: attachment` |

### 2.10 Check-in — Staff

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/staff/events` | S (O) | Events assigned to me (Active and upcoming) |
| GET | `/events/{eventId}/check-ins/lookup?code=` | S O | Check the scanned code without committing → `{invitationId, guestName, numberOfPeople, type, rsvpStatus, alreadyCheckedIn, checkedInAt}` |
| POST | `/events/{eventId}/check-ins` | S O | `{code}` → **201** new check-in, or **200** with `alreadyCheckedIn: true` (idempotent). 404 if the code isn't in *this* event. 409 if the event isn't Active |
| GET | `/events/{eventId}/check-ins?staffId=&from=` | O A | Check-in log |
| GET | `/staff/me/activity?eventId=` | S | My check-ins and uploads (staff activity) |

### 2.11 Photo — Staff upload, Owner/Admin manage

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/invitations/{invitationId}/photos` | S O | `multipart/form-data` field `file` (1–10 files per request). Requires a checked-in invitation. The photo step is optional and can be done later. Checked against `maxPhotos` |
| DELETE | `/photos/{photoId}` | O A | Hard delete (row and objects). Audited |

### 2.12 Gallery — organizer

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/events/{eventId}/gallery?invitationId=&page=` | O A | All photos grouped by invitation, with pre-signed thumbnails |
| GET | `/photos/{photoId}/download` | O A | 302 to a pre-signed original |
| GET | `/events/{eventId}/gallery/zip?invitationId=` | O A | Streams a ZIP of the gallery (or of one invitation) directly in the response |

### 2.13 Dashboard and reporting

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/events/{eventId}/dashboard` | O A | Statistics (below). Cached for 30 s |
| GET | `/dashboard` | O A | Organization overview across events |
| GET | `/events/{eventId}/reports/guests?format=csv\|xlsx` | O A | Guest, RSVP and check-in report |
| GET | `/events/{eventId}/reports/check-ins?format=csv\|xlsx` | O A | Check-in timeline with staff |
| GET | `/events/{eventId}/reports/photos?format=csv\|xlsx` | O A | Photo counts per invitation |

`xlsx` is gated by the package's `excelExport` flag (Q-2).

Dashboard response:

```json
{
  "invitations": { "total": 320, "individual": 180, "group": 140, "opened": 250, "totalPeople": 610 },
  "rsvp":        { "pending": 40, "attending": 250, "notAttending": 30, "expectedPeople": 480 },
  "checkIn":     { "checkedIn": 210, "notYet": 110, "peopleArrived": 402, "rate": 0.656,
                   "byHour": [{ "hour": "2026-10-10T03:00:00Z", "count": 55 }] },
  "photos":      { "total": 640, "invitationsWithPhotos": 198, "storageBytes": 1288490188 }
}
```

### 2.14 Audit log

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/audit-logs?action=&userId=&entityType=&from=&to=&page=` | O **[Q-3]** | Read-only, tenant-scoped |

### 2.15 Operations

| Method | Path | Description |
|---|---|---|
| GET | `/health/live` | Process is up |
| GET | `/health/ready` | PostgreSQL, Redis and storage are reachable |
| GET | `/metrics` | Prometheus (internal network only) |

## 3. Request/response examples

### Google sign-in → create org

```http
POST /api/v1/auth/google
{ "idToken": "eyJhbGciOiJSUzI1NiIs...(from Google Identity Services)" }

201 Created
Set-Cookie: evently_rt=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth
{ "accessToken": "eyJ...", "expiresIn": 900,
  "user": { "id": "...", "name": "Rina Santoso", "role": "Owner", "organizationId": null } }
```

```http
POST /api/v1/organization
{ "name": "Santoso Wedding Organizer" }

201 Created
{ "organization": { "id": "...", "name": "...", "status": "Active" },
  "accessToken": "eyJ...(now with org_id)", "expiresIn": 900 }
```

### Check-in

```http
POST /api/v1/events/0192.../check-ins
{ "code": "b3J3eHl6QUJDREVGR0hJSg" }

201 Created
{ "checkInId": "...", "invitationId": "...", "guestName": "Keluarga Santoso",
  "type": "Group", "numberOfPeople": 3, "checkInTime": "2026-10-10T03:12:44Z",
  "alreadyCheckedIn": false }
```

## 4. Rate-limit policies

| Policy | Applies to | Limit |
|---|---|---|
| `auth` | `/auth/google`, `/auth/refresh` | 10 / min per IP |
| `public` | `/public/**` | 60 / min per IP |
| `checkin` | check-in endpoints | 120 / min per user |
| `upload` | photo upload | 30 / min per user |
| `export` | reports, ZIP | 10 / min per user |
| `default` | everything else | 300 / min per user |

All values come from configuration (`RateLimiting:*`), not constants.

## 5. Mapping endpoints → controllers and services

Each endpoint is one controller action, which calls one service method. Examples:

| Endpoint | Controller action → service method |
|---|---|
| POST `/events` | `EventsController.Create` → `EventService.CreateAsync(CreateEventRequest)` → `EventDto` |
| GET `/events/{id}/guests` | `GuestsController.List` → `GuestService.ListAsync(eventId, GuestListQuery)` → `PagedResult<GuestListItemDto>` |
| POST `/events/{id}/check-ins` | `CheckInsController.Create` → `CheckInService.CheckInAsync(eventId, code)` → `CheckInResultDto` |
| PUT `/public/invitations/{code}/rsvp` | `PublicInvitationsController.SubmitRsvp` → `RsvpService.SubmitAsync(code, SubmitRsvpRequest)` |
| POST `/payments/webhooks/{provider}` | `PaymentWebhooksController.Handle` → `PaymentService.HandleWebhookAsync(provider, payload, signature)` |

Role and permission checks sit on the controller (`[Authorize(Policy = Permissions.X)]`). Checks that depend on the resource itself, such as "is this staff member assigned to this event", sit in the service.
