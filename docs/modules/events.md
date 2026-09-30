# Module: Events

> Phase 4 · Code: `Controllers/EventsController.cs` → `Services/EventService.cs` → `AppDbContext` (EF Core)

An event belongs to one organization. It has one or more **sessions** (for example Akad Nikah and Resepsi). Exactly one session is the **check-in session**. Owners assign **Staff** to an event. Staff can only see the events they are assigned to.

## Use cases

| Who | Can |
|---|---|
| Owner, Admin | List, create, edit and delete events. Mark an event completed |
| Owner | Cancel an event. Assign Staff |
| Staff | See the events they are assigned to (read only) |

## Data

| Table | Notes |
|---|---|
| `events` | Tenant-owned (`organization_id`), soft delete (`deleted_at`), `xmin` as the concurrency token (`version` in the API). `date` and `venue` copy the check-in session so lists and later phases don't need a join |
| `event_sessions` | Name, start and end (stored in UTC), venue, optional Maps link, `is_check_in_session`, `sort_order` |
| `event_staff_assignments` | One row per (event, user), unique |

Every table has the tenant query filter. `events` also has the soft-delete filter. Cover photo upload comes with storage in Phase 9 (`cover_image_key` already exists).

## Rules

- **Lifecycle (Q-4)**, in `EventLifecycle`:

  | From | To | How |
  |---|---|---|
  | Draft | PendingPayment | Payment created (Phase 5) |
  | PendingPayment | Draft | Payment failed or expired (Phase 5) |
  | PendingPayment | Active | Payment settled (Phase 5) |
  | Active | Completed | `POST /events/{id}/complete`. Automatic completion 7 days after the event is part of the scheduled job (Phase 12) |
  | Draft, PendingPayment, Active | Cancelled | `POST /events/{id}/cancel`, Owner only. No refund in the MVP (Q-32) |

  Any other change gives **409** `event.invalid_status_change`.
- **Edit** only while Draft, PendingPayment or Active. Completed and Cancelled events are read-only (409 `event.not_editable`).
- **Delete** (soft) only while Draft or Cancelled, so paid events keep their history (409 `event.not_deletable`).
- **Sessions (Q-28)**: 1 to 5 sessions, exactly one check-in session. The end must be after the start. The Maps link must be `https://`.
- **Time zone**: `Asia/Jakarta` (WIB), `Asia/Makassar` (WITA) or `Asia/Jayapura` (WIT). The organizer enters local times at the venue with no offset (`startsAtLocal`, `endsAtLocal`). The server converts them to UTC with the event time zone and returns both.
- **Editing sessions**: sessions sent with an `id` are updated in place, sessions without an `id` are added and missing ones are removed. An `id` from another event gives 400 `event.unknown_session`. Keeping ids stable lets guest invitations per session (Phase 6) survive an edit.
- **Optimistic concurrency**: `PUT` sends the `version` read with the event. If someone else saved first, the answer is 409 `event.modified_elsewhere`.
- **Staff assignment** replaces the whole list. Only active or invited Staff of the same organization qualify (400 `event.invalid_staff`). The package's `maxStaff` limit is checked from Phase 5.
- **Tenant isolation**: an event of another organization, or an event a Staff member isn't assigned to, gives **404**, never 403.
- **Audit**: `event.created`, `event.updated`, `event.deleted`, `event.status_changed` (from and to), `event.staff_assigned`.

## Endpoints

All under `/api/v1/events`. Details in [03-api-design.md](../architecture/03-api-design.md#23-event--apiv1events).

| Method | Path | Policy |
|---|---|---|
| GET | `/events?status=&category=&from=&to=` | `event.view` |
| POST | `/events` | `event.manage` |
| GET | `/events/{id}` | `event.view` |
| PUT | `/events/{id}` | `event.manage` |
| DELETE | `/events/{id}` | `event.manage` |
| POST | `/events/{id}/cancel` | `event.cancel` |
| POST | `/events/{id}/complete` | `event.manage` |
| GET, PUT | `/events/{id}/staff` | `event.assign_staff` |

## Frontend

`web/src/features/events/`: event list with filters, create and edit form with a sessions editor, detail page with tabs (the tabs for guests, RSVP and gallery fill in from Phase 6), and the Staff event list.

## Tests

- Unit: `EventLifecycleTests` (every status pair), `EventValidatorsTests` (sessions, time zone, Maps link).
- Integration: `EventsTests` (CRUD, sessions, time zone conversion, lifecycle 409s, concurrency, staff assignment, Staff only see assigned events, 403 per role) and the event cases in `TenantIsolationTests`.
