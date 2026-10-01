# Module: Check-in

> Phase 8 · Code: `CheckInsController` → `CheckInService` → `AppDbContext`; PWA `web/src/features/checkin/`

At the entrance, Staff scan the guest's QR, which holds the invitation URL, or find the guest by name. They see who it is, then confirm. One invitation is checked in once. Owner and Admin follow the arrivals in the check-in log.

## Use cases

| Who | Can |
|---|---|
| Staff | Check guests in at the events they are assigned to: scan the QR, type the code, or search by name. See the arrival counter and their own check-ins |
| Owner | The same as Staff, at any event of the organization. Read the check-in log |
| Admin | Read the check-in log and the counter. Admin can't check in (`checkin.perform` is Owner and Staff, Q-3) |

## Data

| Table | Notes |
|---|---|
| `check_ins` | Tenant-owned. `event_id`, `invitation_id` (**unique: one invitation = one check-in**), `checked_in_by` (user), `checked_in_at`, `method` (`Scan`/`Manual`) |

## Rules

- **Event:** only an **Active** event (409 `checkin.event_not_active`), and only on the **date of the check-in session** in the event's time zone (Q-35, 409 `checkin.not_event_day`). A Staff member who isn't assigned to the event gets 404, as if it didn't exist.
- **Invitation:** only an active invitation **of this event** whose guest is still on the list. Anything else is 404 `checkin.invitation_not_found`, including a valid code of another event, a revoked invitation, an unknown or malformed code, and someone with no invitation at all. No walk-ins (Q-31, Q-49).
- **What is scanned:** the QR holds the invitation URL `https://…/i/{code}` (Q-8). The API takes the code out of the URL (`InvitationCode.FromScan`), so staff can also type the bare code.
- **Idempotent:**
  - The first check-in answers **201**.
  - Any later scan answers **200** with `alreadyCheckedIn: true` and the time and staff name of the first check-in.
  - Scans of the same QR at the same moment leave one row: the unique index decides, and the loser reports the winner's check-in.
  - There is no Redis lock, because production stage 1 has no Redis and the index is enough.
- **RSVP (Q-49):** checking in sets the RSVP to **Attending**. A guest who answered "not attending" may still come; Staff see a warning.
- **Sessions (Q-53):** a guest invited only to other sessions (for example the akad) may still check in at the check-in session; Staff see a warning.
- **Lookup first:** `lookup` shows the guest and the warnings without saving anything, and the PWA asks Staff to confirm. A guest picked from the name search is checked in straight away, because the search already showed who it is.
- **Afterwards:** a checked-in guest can't be deleted (409 `guest.checked_in`), and their code can't be regenerated (409 `invitation.checked_in`), since the QR is their check-in record and gallery access. The guest list shows the check-in and filters on it (`checkedIn=true|false`), and the guest's page says "Anda sudah check-in".
- **Rate limit:** 120 per minute per signed-in user (`RateLimiting__CheckInPermitPerMinute`). Authentication now runs before the rate limiter, so per-user limits can read the user.
- **Audit:** `checkin.created`, with the invitation, the method and the RSVP before.

## Endpoints

| Method | Path | Who |
|---|---|---|
| GET | `/events/{eventId}/check-ins/lookup?code=` | Owner, Staff (assigned) |
| POST | `/events/{eventId}/check-ins` | Owner, Staff (assigned). `{code}` or `{invitationId}` (from the name search), exactly one. 201 new, 200 repeat |
| GET | `/events/{eventId}/check-ins/search?q=` | Owner, Staff (assigned). At least 2 characters, up to 20 hits |
| GET | `/events/{eventId}/check-ins/summary` | Owner, Admin, Staff (assigned). `{invitations, people, checkedInInvitations, checkedInPeople}` over active invitations |
| GET | `/events/{eventId}/check-ins?staffId=` | Owner, Admin. The log, newest first |
| GET | `/staff/me/activity?eventId=` | Owner, Staff. My check-ins |

## Frontend

- **Staff home** `/staff` lists the assigned events. An Active event has an "Buka scanner check-in" button.
- **Scanner** `/staff/events/:id`:
  - At the top, the arrival counter, which refreshes every 15 s.
  - Three tabs: **Scan QR**, **Cari tamu** (type the code or search a name) and **Riwayat saya**.
  - After a scan, a result sheet with large buttons: confirm, then green "Check-in berhasil". Amber means already checked in, with the time and who did it. Red means an invalid invitation. Warnings appear on an amber line.
  - The camera keeps running between guests: it is hidden and paused, not stopped.
  - QR decoding uses the browser's own `BarcodeDetector` (Chrome on Android). **jsQR** (Apache-2.0) is loaded only where that is missing, such as iOS Safari, so it stays out of the main bundle.
  - Without a camera, or with permission denied, the page points to "Cari tamu".
- **Organizer:** the "Check-in" section of the event page `/app/events/:id/check-ins` shows the counter and the log. The guest list shows a "Sudah check-in" badge.

The photo step after check-in ("Ambil foto" or "Lewati") comes with storage in Phase 9.

## Tests

- **Unit:** `InvitationCodeTests` (code from a scanned URL or typed code).
- **Integration:** `CheckInTests`:
  - The first scan is 201 and the repeat is 200 with time and staff.
  - Concurrent scans leave one row.
  - "Not attending" becomes attending, with a warning.
  - The warning for a guest outside the check-in session.
  - Invalid, revoked and other-event codes are 404.
  - An unassigned Staff member gets 404 and Admin gets 403.
  - An unpaid event and another day are 409.
  - Manual entry by name.
  - The counter, the log and my activity.
  - A checked-in guest can't be deleted or get a new code; the guest list filter; the guest page.
  - Another tenant gets 404.
- **Web:** `checkin.test.tsx` (typed code, then warning, confirm and next; a repeat scan; an invalid invitation; the name search; the staff list link; the organizer log).
