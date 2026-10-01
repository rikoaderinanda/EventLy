# EventLy — Decisions and Open Questions

> Phase 0 · Last updated 2026-09-29

## Decisions made

| # | Topic | Decision | Date |
|---|---|---|---|
| Q-1 | Backend architecture | Simple layered: Controller → Service → EF Core → PostgreSQL. No Clean Architecture, MediatR, CQRS framework, default repositories or microservices | 2026-09-28 |
| Q-16 | Deployment / CI-CD | **Google Cloud Run**. Stage 1 uses a one-command deploy (Cloud Build runs automatically behind `gcloud run deploy --source`) | 2026-09-29 |
| Q-1b | Payment gateway | **Xendit**. Development uses the **simulated (fake) gateway** first. The Xendit adapter comes later | 2026-09-29 |
| Q-2 | Package catalog | Price, limits and active status are **editable from the UI by a platform-level Root user**. The values in the ERD §5 table are only the initial seed | 2026-09-29 |
| Q-5 | Group invitation | Store **only the number of people** (`NumberOfPeople`). No member names | 2026-09-29 |
| Q-5b | RSVP | **Attending / Not attending** only. No partial counts | 2026-09-29 |
| Q-7 | Photo upload | Only **after check-in**. **Owner may upload** too. The photo step is **optional (can be skipped)** | 2026-09-29 |
| Q-22 | Cost and region | **Completely free to start (Rp 0)** and easy to deploy. App region **Jakarta (`asia-southeast2`)**. See architecture §10 | 2026-09-29 |
| Q-18 | Frontend hosting | Served by the same Cloud Run service as the API (one service, one domain, one deploy). This follows from the "free and easy" decision | 2026-09-29 |
| Q-23 | Free providers | **Neon** PostgreSQL (Singapore) for the database, **Cloudflare R2** for photos. **No Redis in production at stage 1** (in-memory cache). Redis stays in local docker compose, as the spec requires. A credit card is available for the Google Cloud billing account (budget alert + max 1 instance) | 2026-09-29 |
| Q-17 | Source code and CI | Code hosted on **GitHub**, **public repository** (unlimited free GitHub Actions minutes). Secrets never go in the repo: `.env` is git-ignored, and secrets live in GitHub Actions secrets and Google Secret Manager. Secret scanning and push protection are on. Workflows from fork pull requests need maintainer approval and get no secrets. Build and tests run on **GitHub Actions** for every push and pull request. Deploy stays one command; an automatic deploy from GitHub can be added later | 2026-09-29 |
| Q-3 | Admin permissions | **Strict, as the spec says.** Admin cannot manage staff, assign staff to events, check in guests, or view the audit log | 2026-09-29 |
| Q-20 | Package change after payment | **Paid events keep the price and limits they paid for** (package snapshot on the event) | 2026-09-29 |
| Q-19 / Q-24 | Root user scope | Root manages **packages** and **Owner accounts**: list Owners with their organization, events, purchases and payment status; suspend/reactivate (blocks the whole organization). Root **can manually activate an event** paid outside Xendit (recorded as a `Manual` payment + audit log). Root **cannot** see guests, invitations or photos, and cannot delete Owners | 2026-09-29 |
| Q-21 / Q-25 | Guest photo capture | **⚠ Spec change:** guests can **take photos with the in-app camera** from their invitation page. **No file upload / no choosing from the phone gallery.** Only after check-in. Limited per package (Root sets on/off + max photos per invitation; proposed Basic off, Premium 5, Enterprise 10), counted toward the event `maxPhotos`. Owner/Admin can turn it off per event. Guest can delete their own captures, sees only their own invitation's photos. No approval workflow | 2026-09-29 |
| Q-26 | Guest camera time window | From check-in **until 23:59 on the event date**, in the event's local time zone (default `Asia/Jakarta`; WITA/WIT events set their own). After that the camera button disappears; the gallery stays available | 2026-09-29 |
| Q-27 | Sending invitations | Per guest: **"Kirim via WhatsApp"** button (opens WhatsApp with a ready message + link to the guest's number, using a `wa.me` link; free, no WhatsApp API), **copy link**, and the printable QR sheet. **No automatic bulk sending in the MVP.** Bulk sending is a **future paid add-on package** | 2026-09-29 |
| Q-28 | Akad + resepsi | **Several sessions per event** (for example Akad, Resepsi), each with its own date, start–end time, venue and Maps link. **Check-in happens at one session only (the resepsi)**, marked as the check-in session. Details in Q-38 | 2026-09-29 |
| Q-29 | Invitation page content | Adds **start–end time and Google Maps link (per session)**, a **short message** (couple's names + greeting) and an optional **cover photo**. One standard template | 2026-09-29 |
| Q-30 | Owner login | **Owners sign in with their Google account.** First sign-in creates the Owner account, then the Owner creates the organization, picks a package and orders | 2026-09-29 |
| Q-31 | Walk-in guests | **Not supported in the MVP.** Owner/Admin add the guest from their phone; staff scan the new QR | 2026-09-29 |
| Q-38 | Sessions per guest | The Owner ticks which sessions each guest is invited to (default: all sessions). The invitation page shows only that guest's sessions. Check-in and the guest camera use the check-in session's date | 2026-09-29 |
| Q-39 | Login for every role | **Everyone signs in with Google**: Owner (self sign-up), Admin & Staff (the Owner registers their Google email; they are matched by email on first sign-in), Root (one fixed email in configuration). **EventLy stores no passwords at all** | 2026-09-29 |
| Q-11 | Creating Admin/Staff | The Owner enters name, Google email and role. The account is **Invited** until that person first signs in with Google, then **Active**. One email belongs to one organization | 2026-09-29 |
| Q-32 | Upgrade / refund | **Not in the MVP.** Root handles special cases manually (manual activation) | 2026-09-29 |
| Q-33 | Free storage | **10 GB Cloudflare R2 is enough for stage 1** | 2026-09-29 |
| Q-34 | Personal data (UU PDP) | Short privacy notice on the invitation page and gallery. **Terms & Conditions** and **Privacy Policy** pages, accepted by the Owner at first sign-in (acceptance date + version stored). Drafts in `web/src/features/legal/content/` (see `docs/legal/README.md`) (must be reviewed by a legal advisor before launch) | 2026-09-29 |
| Q-35 | Check-in window | Check-in is allowed **only on the date of the check-in session (resepsi)**, in the event time zone | 2026-09-29 |
| Q-36 | Payment proof | A **payment receipt** page (package, amount, date, reference, event) that the Owner can print or save as PDF from the browser (print stylesheet, so no PDF library and no license question). No tax invoice (faktur pajak) in the MVP | 2026-09-29 |
| Q-37 | Initial package prices | Seed values: **Basic Rp 150.000 · Premium Rp 350.000 · Enterprise Rp 1.000.000** (IDR). Root changes them later in the UI | 2026-09-29 |
| Q-40 | Scope addition | **Added to the MVP (beyond the original spec):** guest wishes (ucapan & doa), digital gift (amplop digital), background music, countdown. Still not built: seating plan, automatic reminders, per-organization branding | 2026-09-29 |
| Q-41 | Amplop digital | **Display only (option A).** Bank/e-wallet accounts with a copy button, optional QRIS image and gift address. Guests transfer directly to the couple, and **EventLy never holds money**. Includes the optional **"Konfirmasi hadiah"** form (name, amount, note), visible only to Owner/Admin | 2026-09-29 |
| Q-42 | Ucapan & doa | One message per invitation (editable, max 500 chars), visible to all guests of the event, no approval, Owner/Admin can hide/delete. Open from invitation until 7 days after the event | 2026-09-29 |
| Q-43 | Musik latar | Owner uploads one own audio file (MP3/M4A, max 10 MB); copyright is the Owner's responsibility. No built-in library, no YouTube. "Buka Undangan" cover starts the music; mute button | 2026-09-29 |
| Q-44 | Hitung mundur | Counts down to the first session; then "Acara sedang berlangsung" / "Acara telah selesai" | 2026-09-29 |
| Q-45 | Per-package flags | Root can switch wishes, gift, music and countdown on/off per package; all **on** in the initial seed | 2026-09-29 |
| Q-47 | RSVP cut-off | Guests can answer and change their RSVP **until the event is over** (the last session ends) | 2026-10-01 |
| Q-48 | Invitations before payment | Guests can be **added** while the event is unpaid, but invitations **can't be sent** (no link, QR, QR sheet or WhatsApp) until the event is paid (Active) | 2026-10-01 |
| Q-46 | Guest limit unit | The package's `maxGuests` counts **people**, not invitations: a group invitation of 4 takes 4 places. Checked when adding a guest, when a group grows, and at checkout | 2026-10-01 |
| Q-49 | Check-in and RSVP | A guest who answered "not attending" **may still come**: they can change their RSVP to attending, and a check-in scan **sets the RSVP to Attending** automatically. Only a valid invitation (its QR or code) can check in; anyone without one is refused (no walk-ins, Q-31) | 2026-10-01 |
| Q-50 | Admins per package | `maxAdmins` is a per-package limit that Root sets in the package settings, like the other limits | 2026-10-01 |
| Q-51 | Money for a closed checkout | A payment that settles after its checkout was closed (replaced, expired, event cancelled) doesn't activate anything. It is recorded in the audit log (`payment.late_settlement`) and Root settles it with the Owner (no refunds in the MVP, Q-32) | 2026-10-01 |
| Q-52 | Payment provider timing | Keep the **simulated gateway** for now; the Xendit adapter comes later (before production) | 2026-10-01 |
| Q-12 | Extras (confirmed) | **CSV guest import: yes (MVP).** Printable QR sheet: yes. Custom invitation design: no, one standard template | 2026-10-01 |
| Q-9 | Offline | **Online only** for the MVP. Upload retries automatically. Photo step can be skipped. Offline mode is a future phase | 2026-09-29 |

## Accepted recommendations ("sisanya sesuai saran", 2026-09-29)

**Q-4 · Event lifecycle.** Can guests and invitations be prepared while the event is Draft (before payment)? *Recommendation:* yes, but the public link, RSVP and check-in only work once the event is Active. The event closes manually or automatically 7 days after the event date. Refunds are out of scope.

**Q-8 · QR payload.** *Recommendation:* the QR encodes the invitation link. The same random code works both as the guest's link and as the check-in token.

**Q-12 · Extras.** CSV guest import (*recommended yes*), printable QR sheet (*yes*), custom invitation design (*no, one standard template*).

**Q-13 · "Invitation opened" statistic.** *Recommended yes.*

**Q-6 · Photos per invitation.** *Recommendation:* several photos allowed (up to ~20 per invitation).

**Q-10 · `organization_id` on child tables** for tenant safety. *Recommended: approve.*

**Q-14 · Performance targets and scale.** Check-in < 300 ms, up to 5,000 guests per event. Is that acceptable?

**Q-15 · UI language and branding.** Indonesian + English, or Indonesian only? Is there an existing logo and colours?
