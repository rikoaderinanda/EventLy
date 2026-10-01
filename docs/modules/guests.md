# Module: Guests & Invitations

> Phase 6 · Code: `GuestsController` → `GuestService`; `InvitationsController` → `InvitationService` → `AppDbContext`; `WhatsAppMessage`, `InvitationLinks`

The organizer adds guests to an event. **Adding a guest creates their invitation**, one to one. The invitation is what the guest actually uses: a link with a random code, and the same link as a QR code. RSVP (Phase 7), check-in (Phase 8) and photos (Phase 9) all hang off the invitation.

## Use cases

| Who | Can |
|---|---|
| Owner, Admin | Add, edit and delete guests. Pick which sessions each guest is invited to. Send the invitation by WhatsApp, copy the link, show and download the QR, generate a new code, revoke an invitation. Edit the event's WhatsApp message. Print the QR sheet |
| Staff | Nothing here (403) |

## Data

| Table | Notes |
|---|---|
| `guests` | Tenant-owned, soft delete. `name`, `phone`, `email` (citext), `guest_type` (`Individual` / `Group`), `number_of_people` (1, or 2–50 for a group; Q-5: no member names) |
| `guest_sessions` | Key `(guest_id, session_id)`. Removing a session from the event removes it from every guest (cascade) |
| `invitations` | Tenant-owned. `code` is unique, `guest_id` is unique (1:1), `type` follows the guest, `status` is `Active` or `Revoked`, `opened_at` is set in Phase 7 |
| `events.whatsapp_template` | The event's WhatsApp message. Null means the default message |

The invitation URL is `{origin}/i/{code}` and is also the QR payload (Q-8). WhatsApp only turns domain names into links, so a local URL such as `http://127.0.0.1:8080/i/…` shows as plain text, and a phone can't open it anyway. To try it from a phone, see the setup guide (Troubleshooting). It is **built from the code, not stored** (the ERD's `qr_code` column is not used). A new domain then needs no data migration. The origin is `App__PublicBaseUrl`, or the request's origin when that setting is empty.

## Rules

- **Code:** 128 bits from the CSPRNG, written as 22 base64url characters (`InvitationCode`). It can't be guessed, and it is the guest's credential. It is unique in the database.
- **1:1:** creating a guest creates the invitation in the same save. Editing the guest keeps the code, and the invitation type follows the guest type.
- **Sessions (Q-38):** a guest is invited to every session unless some are chosen. They need at least one session (400 `guest.no_session`), and a session of another event gives 400 `guest.unknown_session`. A session added to the event later isn't added to existing guests.
- **Guest limit:**
  - A paid event allows at most its package's `maxGuests` **people** (Q-46). Adding a guest or growing a group past it gives **422 `guest.quota_exceeded`**. Shrinking a group is always allowed.
  - Before payment the cap is the largest offered package. The checkout then refuses a package with fewer places than the guest list has people (409 `payment.guest_limit_exceeded`), like the Staff limit.
  - A group of 4 takes 4 places. The list shows both the number of people (compared with the limit) and the number of invitations.
  - Adding or editing a guest takes a row lock on the event (`SELECT … FOR UPDATE` inside a transaction), so guests added at the same moment never exceed the limit. The lock doesn't change the event's version, so editing the event at the same time is not affected.
- **Event status:** guests and invitations can be prepared while the event is Draft or PendingPayment (Q-4), but **not sent** until it is paid (Q-48):
  - The invitation `url` is null in every DTO.
  - The WhatsApp link, the QR and the QR sheet give 409 `invitation.event_not_paid`.
  - The PWA shows "Bisa dikirim setelah acara dibayar" instead of the buttons.
  - Once the event is Active the links appear. The guest's page also only works from then on.
  - Completed and Cancelled events are read-only (409 `event.not_editable`).
- **Delete guest:** soft delete, and the invitation is revoked. Phase 8 will refuse it (409) once the guest has checked in.
- **New code** (`regenerate-code`): the old link and QR stop working. On a revoked invitation it also makes it active again. Phase 8 will block it after check-in.
- **Revoke:** the link and QR stop working. The WhatsApp link and the QR image then give 409 `invitation.revoked`. Revoking twice changes nothing.
- **Kirim via WhatsApp (Q-27):**
  - The API builds `https://wa.me/<number>?text=<message>`, and the PWA opens it. The organizer still presses Send. This is free and needs no WhatsApp API.
  - The number is normalised: digits only, and `08…` becomes `628…`. Without a usable number the link has no number, and WhatsApp asks for a contact.
  - The message is the event's template with `{nama}`, `{acara}` and `{link}` filled in. `{link}` is required, and the template is at most 1000 characters.
- **QR:** PNG (`size` is the width in pixels) or SVG, rendered on demand with QRCoder. It takes a few milliseconds and is not stored or cached. The response is `Cache-Control: private, no-store`, because the image is a credential.
- **QR sheet:** every active invitation of the event with its SVG, sorted by guest name. The PWA prints it from the browser like the receipt, so no PDF or ZIP is needed.
- **Tenant isolation:** another organization's guests and invitations give 404. A deleted guest's invitation gives 404 too.
- **Audit:** `guest.created`, `guest.updated`, `guest.deleted`, `invitation.code_regenerated`, `invitation.revoked`, `event.whatsapp_template_updated`.

Not built: **CSV import** of guests. Q-12 is still open; it can be added later as `POST /events/{id}/guests/import`.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/events/{eventId}/guests?search=&type=&status=` | `{guests, total, totalPeople, limit}`. `total` (invitations) and `totalPeople` cover all guests, not only the filtered ones; `limit` is compared with `totalPeople`. RSVP and check-in filters come with Phases 7 and 8 |
| POST | `/events/{eventId}/guests` | `{name, phone, email, guestType, numberOfPeople, sessionIds}` returns 201 with the guest and invitation summary |
| GET, PUT, DELETE | `/events/{eventId}/guests/{guestId}` | In PUT, `sessionIds: null` keeps the current sessions |
| GET | `/invitations/{id}` | Code, URL, type, status, guest |
| GET | `/invitations/{id}/whatsapp-link` | `{url, message, phone}` |
| GET | `/invitations/{id}/qr?format=png\|svg&size=512` | Image |
| POST | `/invitations/{id}/regenerate-code` · `/revoke` | |
| GET | `/events/{eventId}/invitations/qr-sheet` | `[{invitationId, guestName, type, numberOfPeople, url, svg}]` |
| GET, PUT | `/events/{eventId}/whatsapp-template` | `{template, isDefault}`. `PUT {template: null}` resets it |

## Frontend

`web/src/features/guests/`:

- **Guest list** `/app/events/:id/guests`: quota, search and filters, a WhatsApp button and copy link on every row, and the WhatsApp message editor.
- **Guest form** `/app/events/:id/guests/new` and `/:guestId`: the form, plus the invitation panel with the link, QR preview and PNG download, new code, revoke and delete.
- **QR sheet** `/app/events/:id/qr-sheet`: printable.

The WhatsApp tab is opened before the request, so pop-up blockers allow it. The QR image is fetched with the access token as a blob, because an `<img>` can't send the token.

## Tests

- **Unit:**
  - `InvitationCodeTests`: length, alphabet, 100,000 codes without a repeat, spread over every character position.
  - `WhatsAppMessageTests`: number normalisation, template, link encoding.
  - `GuestValidatorsTests`: individual and group sizes, phone, sessions, template needs `{link}`, QR renders.
- **Integration:**
  - `GuestsTests`: 1:1 invitation, sessions, group size, edit keeps the code, delete revokes, list and quota, 422, a group takes a place per person, growing a group past the limit, concurrent adds never exceed the limit, checkout guest limit counts people, read-only cancelled event, Staff 403, session removal.
  - `InvitationsTests`: WhatsApp link and template, new code, revoke and restore, PNG and SVG, QR sheet, roles.
  - `TenantIsolationTests`: guests and invitations.
