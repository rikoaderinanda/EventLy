# EventLy — Frontend Structure

> Phase 0 deliverable · Status: **Draft, awaiting approval** · React 19 · Vite · TypeScript (strict)

## 1. Layering

```
App shell (routes, layouts, providers)
   │
Feature modules  ── each owns its pages, components, hooks and API calls
   │
API client       ── typed client generated from the backend OpenAPI spec, plus a fetch wrapper
   │
State            ── TanStack Query (server state) · Zustand (session + UI state)
```

Rules:
- A feature may import from `shared/` and `api/`, **never from another feature's internals**. A feature exposes only what its `index.ts` exports.
- Components never call `fetch`. They use feature hooks (`useEvents()`, `useCheckIn()`), which wrap TanStack Query plus the API client.
- No server data is copied into Zustand. Zustand holds only session data (the access token in memory, the user, permissions) and UI preferences.

## 2. Tech choices

| Concern | Choice | Why |
|---|---|---|
| Build | Vite 7 + `@vitejs/plugin-react` | Required by the specification |
| Language | TypeScript `strict`, `noUncheckedIndexedAccess` | |
| Routing | React Router 7 (data router, lazy routes) | Code-splitting by role area |
| Server state | TanStack Query 5 | Caching, retries, polling (payment status) |
| Client state | Zustand | Small, no boilerplate |
| Forms / validation | React Hook Form + Zod | Zod schemas mirror the backend validators |
| API types | `openapi-typescript` + `openapi-fetch`, generated from `/openapi/v1.json` | One source of truth for DTOs |
| UI | Tailwind CSS 4 + shadcn/ui (Radix primitives) | Accessible, mobile-first, no runtime cost **[Q-15]** |
| i18n | `react-i18next`, Indonesian + English **[Q-15]** | |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest, service worker, installable |
| QR scan | `qr-scanner` (nimiq, WebWorker-based) | Fast on low-end Android, works inside a TWA |
| QR display | Rendered by the API (`/qr` endpoint) as an `<img>` | No duplicated logic |
| Image compression | `browser-image-compression` | Smaller uploads over venue 4G |
| Charts | Recharts | Dashboard |
| Tests | Vitest + React Testing Library + MSW. Playwright for E2E | |
| Lint/format | ESLint (typescript-eslint, react-hooks, jsx-a11y) + Prettier | |

## 3. Directory layout

```
web/
├── index.html
├── vite.config.ts
├── public/
│   ├── icons/                 PWA icons (192, 512, maskable)
│   └── .well-known/assetlinks.json   (added in the TWA phase)
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx         route tree (lazy)
│   │   ├── providers.tsx      QueryClient, i18n, theme, toaster
│   │   └── layouts/
│   │       ├── AuthLayout.tsx        login / register
│   │       ├── OrganizerLayout.tsx   Owner/Admin: sidebar (desktop) / bottom nav (mobile)
│   │       ├── StaffLayout.tsx       full-screen, big touch targets
│   │       └── GuestLayout.tsx       invitation branding, no nav
│   ├── api/
│   │   ├── schema.d.ts        generated (npm run gen:api)
│   │   ├── client.ts          openapi-fetch instance, base URL from env
│   │   ├── auth-middleware.ts adds Bearer, on 401 → single-flight refresh → retry
│   │   └── problem.ts         ProblemDetails → typed AppError
│   ├── shared/
│   │   ├── components/        Button, Input, DataTable, EmptyState, ConfirmDialog, PageHeader...
│   │   ├── hooks/             useDebounce, useMediaQuery, useOnlineStatus
│   │   ├── lib/               date/format (id-ID locale), download helpers
│   │   └── auth/
│   │       ├── session-store.ts      Zustand: accessToken, user, permissions
│   │       ├── ProtectedRoute.tsx    requires login (+ org)
│   │       ├── RequirePermission.tsx route/element guard
│   │       └── usePermission.ts
│   ├── features/
│   │   ├── auth/              LoginPage (Google Identity Services button — the only login)
│   │   ├── organization/      CreateOrganizationPage (onboarding), OrganizationProfilePage
│   │   ├── users/             UsersPage (admins/staff), UserFormDialog
│   │   ├── events/            EventListPage, EventFormPage, SessionsEditor, CoverUpload, EventDetailLayout (tabs), StaffAssignment
│   │   ├── packages/          PackageSelector
│   │   ├── platform/          PackageManagementPage, OwnerListPage, OwnerDetailPage (Root only)
│   │   ├── payments/          CheckoutPage, PaymentStatusPage (poll), PaymentHistory
│   │   ├── guests/            GuestListPage, GuestFormDialog, GuestImportDialog
│   │   ├── invitations/       InvitationDetail, QrPreview, CopyLinkButton, SendWhatsAppButton
│   │   ├── rsvp/              RsvpMonitorPage
│   │   ├── checkin/           StaffEventsPage, ScannerPage, CheckInResultSheet, ActivityPage
│   │   ├── photos/            CapturePhotoButton, UploadQueue
│   │   ├── gallery/           OrganizerGalleryPage, ZipExportButton, PhotoLightbox
│   │   ├── wishes/            WishesModerationPage
│   │   ├── gifts/             GiftAccountsEditor, QrisUpload, GiftConfirmationsList
│   │   ├── music/             MusicUpload
│   │   ├── dashboard/         OrgDashboardPage, EventDashboardTab, StatCard, Charts
│   │   ├── reports/           ReportsTab (CSV/XLSX)
│   │   ├── audit/             AuditLogPage
│   │   └── guest-portal/      InvitationPage, RsvpForm, MyQrCard, GuestGalleryPage, GuestCameraPage (getUserMedia, no file picker), OpeningCover ("Buka Undangan" + starts music), MusicToggle, Countdown, WishesSection, GiftSection (copy account number, QRIS, confirmation form)
│   ├── config/
│   │   └── env.ts             typed, validated import.meta.env (Zod)
│   ├── i18n/                  id.json, en.json
│   └── styles/
└── tests/
    ├── setup.ts
    └── e2e/                   Playwright specs
```

Each feature folder follows the same pattern:

```
features/events/
├── api.ts          query keys + hooks (useEvents, useEvent, useCreateEvent...)
├── schemas.ts      Zod form schemas
├── components/
├── pages/
├── routes.tsx      the feature's route objects (lazy)
└── index.ts        public exports
```

## 4. Route map

| Path | Layout | Access | Page |
|---|---|---|---|
| `/login` | Auth | anonymous | **"Masuk dengan Google"** for every role |
| `/onboarding/organization` | Auth | Owner without org | Create organization |
| `/app` | Organizer | O A | Organization dashboard |
| `/app/events` · `/app/events/new` | Organizer | O A | Event list / create |
| `/app/events/:id` → tabs `overview · guests · rsvp · check-ins · gallery · reports · staff · payment` | Organizer | O A (the staff and payment tabs are for O only) | Event detail |
| `/app/events/:id/checkout` · `/app/payments/:pid` | Organizer | O | Package selection → payment status |
| `/app/users` | Organizer | O | Admin/Staff management |
| `/app/organization` | Organizer | O (A read-only) | Profile |
| `/app/audit` | Organizer | O | Audit log |
| `/platform/packages` | Platform | Root | Package management (price, limits, active) |
| `/platform/owners` | Platform | Root | Owner accounts: purchases, suspend/reactivate, manual event activation |
| `/staff` | Staff | S (O) | Assigned events |
| `/staff/events/:id/scan` | Staff | S (O) | QR scanner → result sheet → take photo |
| `/staff/activity` | Staff | S | My activity |
| `/i/:code` | Guest | public | Opening cover → invitation (countdown, sessions, music) + RSVP + ucapan & doa + amplop digital + my QR |
| `/i/:code/gallery` | Guest | public, after check-in | My photos + download + **"Ambil foto" in-app camera** (if the package allows) |

After login, users are redirected by role: Root → `/platform/packages`, Owner/Admin → `/app`, Staff → `/staff`. An Owner with no organization → `/onboarding/organization`.

## 5. Auth flow in the client

1. The user (any role) taps **Masuk dengan Google**. Google returns an ID token, and the PWA sends it to `POST /auth/google`. The response returns the `accessToken` (kept **in memory** in Zustand) and sets the `HttpOnly` refresh cookie.
2. On app boot, the client calls `POST /auth/refresh`. If the cookie is valid, the session is restored with no stored token.
3. `auth-middleware` attaches the Bearer token. On a 401 it runs **one** shared refresh promise, then retries the queued requests once. If the refresh fails, it logs out and sends the user to `/login?next=`.
4. `ProtectedRoute` waits for boot to finish, then checks the session. `RequirePermission` hides menu items and guards routes. **The backend is always the real enforcement point.**

## 6. Staff scanner UX (the critical path)

```
[Assigned events] → tap event → [Scanner: full-screen camera, torch toggle]
     → QR decoded → vibrate → lookup call
     → Bottom sheet:
         🟢 "Keluarga Santoso · 3 orang · RSVP: Hadir"   [Check in] 
         🟡 "Already checked in 10:12 by Rina"             [Take photo anyway?]
         🔴 "Invitation not for this event / revoked"
     → Check in → [Take photo] or [Skip] → (photo: native camera → compress → upload with progress)
     → back to scanner automatically
```

- There is also a manual code entry field, for when the camera fails.
- The upload queue retries on network errors (in memory) and shows pending uploads. Full offline mode is **not** in scope (Q-9).

## 7. PWA and TWA readiness

- Manifest: `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, theme colours, maskable icons.
- Service worker: pre-caches the app shell. Uses **network-first** for `/api/**`. Pre-signed image URLs are **never cached**, so private photos don't stay in the cache.
- The whole app runs over HTTPS, because TWA requires a verified origin. `assetlinks.json` is added in the TWA phase.
- There are no browser-only APIs that break in a TWA. The camera uses `getUserMedia` (scanner) and `input capture` (photo).

## 8. Environment configuration

```
VITE_API_BASE_URL=/api/v1        # proxied by Nginx in Docker, by Vite dev server locally
VITE_APP_NAME=EventLy
VITE_DEFAULT_LOCALE=id
VITE_SENTRY_DSN=                 # optional
```

The values are validated at startup in `config/env.ts`, so a missing variable stops the build. Runtime configuration for Docker images is loaded from `/config.js` (generated by the Nginx entrypoint), so **one image can serve every environment**.

## 9. Testing strategy (frontend)

| Level | Tooling | Coverage |
|---|---|---|
| Unit | Vitest | Zod schemas, formatters, permission helpers, auth middleware refresh logic |
| Component | RTL + MSW | Forms (validation messages), guarded routes, scanner result states |
| E2E | Playwright (against docker compose) | Register → org → event → pay (fake) → guest → invitation → RSVP → check-in → upload → guest gallery |
