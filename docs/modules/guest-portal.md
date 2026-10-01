# Module: Guest Portal, RSVP, Wishes & Digital Gift

> Phase 7 · Code: `PublicInvitationsController` → `PublicInvitationService`; `GuestResponsesController` → `GuestResponseService` → `AppDbContext`; `PublicSetup` (rate limits, referrer policy)

The guest opens their invitation link `/i/{code}`. There is no account: **the 128-bit code is the credential**. On the page the guest sees the event, answers the RSVP, shows their QR at the entrance, writes a wish, and finds the digital gift details. The organizer follows the answers in the RSVP monitor, moderates wishes, and manages the gift accounts.

## Use cases

| Who | Can |
|---|---|
| Guest (code) | Open the invitation and see the event and only their own sessions. Answer and change the RSVP until the cut-off. Show the QR. Write and edit one wish, and read the visible wishes. See the gift accounts and address. Send a gift confirmation |
| Owner, Admin | RSVP monitor (summary and list), the guest list filtered by RSVP, moderate wishes (hide, show, delete), manage gift accounts and the gift address, read the gift confirmations |
| Staff | Nothing here (403) |

## Data

| Table | Notes |
|---|---|
| `rsvps` | Tenant-owned, one per invitation (unique). `Pending`, `Attending` or `NotAttending`, plus `responded_at`. No row means pending |
| `wishes` | Tenant-owned, one per invitation (unique), at most 500 characters of plain text, `is_hidden` for moderation |
| `gift_accounts` | Tenant-owned. `kind` (`Bank`/`EWallet`), provider, number, holder, order. At most 5 per event |
| `gift_confirmations` | Tenant-owned. Sender name, optional amount and note. At most 5 per invitation |
| `events.gift_address` | Optional address for sending a gift |
| `invitations.opened_at` | Set on the first view of the page (Q-13) |

## Rules

- **Which invitations work:** only an active invitation of a guest who isn't deleted, for an event that is **Active** or **Completed** (Q-4). Anything else is the same **404 `invitation.not_found`**: an unknown code, a malformed code, a revoked invitation, a deleted guest, or a Draft, PendingPayment or Cancelled event. The answer never reveals which of these it was.
- **Tenant:** the code lookup is an allow-listed tenant filter bypass. The request then acts as the invitation's organization (`ActAsOrganization`), so the tenant filter covers everything else it reads or writes.
- **What the page returns:**
  - Included: the guest's name, type and number of people; the event's public content; **only the sessions this guest is invited to** (Q-38); the guest's own RSVP and wish; and the feature flags.
  - Not included: ids, package, payment, or any other guest's data. The wishes list shows other guests' names and messages, because that is what wishes are for (Q-42).
- **RSVP:**
  - `Attending` or `NotAttending` can be changed until the **event is over**, when the last session ends (Q-47). After that the answer is 409 `rsvp.closed`.
  - Only an Active event accepts answers.
  - First answers arriving together leave one row: the unique index decides, and the loser updates that row.
- **Wishes (Q-42):**
  - One per invitation, which can be edited. There is no approval step.
  - Open until **7 days after the check-in session ends**, then 409 `wish.closed`.
  - Messages are stored as plain text and shown as text (React escapes them), so they can't inject markup.
  - Organizers can hide, show or delete a wish. A hidden wish disappears from the guests' list.
- **Digital gift (Q-41):**
  - Display only. Guests transfer directly, and EventLy never holds money.
  - The organizer replaces the accounts and the address in one save.
  - A gift confirmation is visible only to the organizer. At most 5 per invitation (422 `gift.confirmation_limit`).
- **Package flags (Q-45):** `wishesEnabled`, `digitalGiftEnabled` and `countdownEnabled` come from the event's package snapshot. A feature that is off gives 404 `feature.not_available` and is hidden on the page.
- **Countdown (Q-44):** computed in the browser from the guest's first session. While a session is running it shows "Acara sedang berlangsung", and after the last one ends "Acara telah selesai".
- **Opened:** the first view sets `opened_at`. This is a single conditional update, so two first views can't overwrite each other.
- **Rate limits:**
  - Reads: 60 per minute per IP (`RateLimiting__PublicPermitPerMinute`).
  - Writes (RSVP, wish, gift confirmation): 10 per minute per IP (`RateLimiting__PublicWritePermitPerMinute`).
  - Over the limit, the API answers 429 with `Retry-After`.
- **Referrer:** `Referrer-Policy: no-referrer` is set on `/i/*` and `/api/v1/public/*`, and the guest layout sets the same meta tag. The code then never reaches Google Maps or other sites through the `Referer` header. It isn't set app-wide, because Google Sign-In needs the referrer.

**Built in Phase 9:** the background music upload and player (Q-43), the QRIS image (Q-41) and the cover photo. See [photos.md](photos.md).

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/public/invitations/{code}` | The invitation page |
| PUT | `/public/invitations/{code}/rsvp` | `{status}` |
| GET | `/public/invitations/{code}/qr?size=` | PNG |
| GET | `/public/invitations/{code}/wishes?page=` | 20 per page, newest first, `isMine` marks the guest's own wish |
| PUT | `/public/invitations/{code}/wish` | `{message}` |
| GET | `/public/invitations/{code}/gifts` | `{accounts, address, qrisUrl}` |
| POST | `/public/invitations/{code}/gift-confirmations` | `{senderName, amount?, note?}` returns 204 |
| GET | `/events/{id}/rsvps?status=` · `/rsvps/summary` | Policy `rsvp.view` (O A) |
| GET | `/events/{id}/guests?rsvp=` | The guest list also has the RSVP status and filter |
| GET | `/events/{id}/wishes` · POST `/wishes/{wishId}/hide` · `/unhide` · DELETE `/wishes/{wishId}` | O A |
| GET, PUT | `/events/{id}/gifts` | `{accounts, address}` (O A) |
| GET | `/events/{id}/gift-confirmations` | O A |

## Frontend

- **Guest page** `/i/:code` (`web/src/features/invitation/`): the "Buka Undangan" cover with the guest's name, then the countdown, sessions with Maps links, RSVP buttons, the QR to show at the entrance, wishes with a form and "show more", and gift accounts with "copy number", the address and the confirmation form. An unknown code shows "Undangan tidak ditemukan".
- **Organizer** (`web/src/features/responses/`):
  - The RSVP monitor `/app/events/:id/rsvps`, with counts and a list.
  - Wishes `/app/events/:id/wishes`.
  - Digital gift `/app/events/:id/gifts`, with the account editor and the confirmations.
  - The event page links to these, and the guest list shows an RSVP badge and filter.

## Tests

- **Unit:** `PublicValidatorsTests` (RSVP answers, wish length, gift confirmation, gift accounts, which statuses are public).
- **Integration:**
  - `PublicInvitationTests`:
    - What the page shows and doesn't show (no other guest, no ids), `opened_at` set once, and the referrer header.
    - The 404 cases, and a cancelled event.
    - RSVP change and the cut-off 409; first answers arriving together.
    - The RSVP monitor and the guest list filter.
    - Wishes: one per guest, plain text, hide and delete, closing a week after the event.
    - Package flags off.
    - Gift accounts and confirmations, with the limit.
    - The guest QR, and the write rate limit (429).
  - `TenantIsolationTests`: RSVP, wishes and gifts.
