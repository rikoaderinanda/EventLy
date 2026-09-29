# EventLy — Development Roadmap

> Phase 0 deliverable · Status: **Draft, awaiting approval**

Each phase ends with a **demo and an approval gate**. The next phase starts only after approval. A phase is "done" only when it meets the Definition of Done below.

## Definition of Done (every phase)

- [ ] Code follows the Controller → Service → EF Core layering: thin controllers, no `DbContext` in controllers, and no new abstraction without a written reason
- [ ] Unit tests for pure logic (validators, state changes, token and code generation). Service behaviour is tested against real PostgreSQL in integration tests (target ≥ 80 % line coverage on `Services/`)
- [ ] Integration tests for every new endpoint: happy path, validation (400), authorization (401/403), and **tenant isolation (404)** from Phase 3 onward
- [ ] Validators on every command and query. Errors returned as ProblemDetails
- [ ] OpenAPI documents the new endpoints. The frontend API types are regenerated
- [ ] Module README (`docs/modules/<module>.md`): use cases, rules, endpoints
- [ ] `docker compose up` still starts cleanly from scratch, and migrations apply
- [ ] CI green (build, test, lint)

## Phases

| Phase | Scope | Key deliverables | Tests of note | Depends on |
|---|---|---|---|---|
| **0** | Analysis | These 5 documents + open questions | — | — |
| **1** ✅ | Foundation | .NET 10 solution (one `EventLy.Api` project + unit and integration test projects), EF Core + Npgsql, first migration (empty + `__EFMigrationsHistory`), Serilog, ProblemDetails, health checks, OpenAPI/Scalar. Vite React TS app, router, layouts, env config, Tailwind. `docker-compose.yml` (api, web, postgres, redis, minio, migrator). GitHub repository + **GitHub Actions** CI (build, test, lint on every push/PR) | `/health/ready` integration test with Testcontainers | 0 |
| **2** ✅ | Identity | User, RefreshToken, **Google Sign-In for every role** (ID token validation, new Owner auto-created, Invited Admin/Staff matched by email, Root by config email), a **Development-only test sign-in** so local runs and integration tests don't need a real Google account, refresh rotation, logout, `/auth/me`, permission model + authorization policies, `auth` rate limit, sign-in audit. FE: Login with Google button, ProtectedRoute, token refresh middleware | Google ID token validation (wrong audience, expired, unverified email rejected), unregistered email can't become Admin/Staff, suspended user refused, token rotation and reuse detection, role→permission matrix unit test | 1 |
| **3** | Organization | Create org (1 per owner), profile, token re-issue with `org_id`, **tenant filter + interceptor**, Owner creates Admin/Staff users. FE: onboarding, profile, users page | Two-tenant isolation suite (the reusable fixture used by every later phase) | 2 |
| **4** | Event | Event CRUD, category/status, lifecycle guards, **sessions (akad/resepsi, one check-in session)**, description, cover photo, staff assignment. FE: list, form with sessions editor, detail shell with tabs | Status transition unit tests; Staff sees only assigned events | 3 |
| **5** | Package & Payment | Root account seed, **Root UI: package management + Owner accounts + manual event activation**, package snapshot on the event at payment, `IPaymentGateway` port, **FakePaymentGateway** (used first; the **Xendit** adapter comes later), webhook with signature + idempotency, reconciliation (scheduled call), event activation. FE: package selector, checkout, status polling | Webhook replay (idempotent), tampered signature rejected, amount taken from server, Admin 403 | 4 |
| **6** | Invitation | Guest + invitation creation (individual/group), code generation, public URL, QR render endpoint, regenerate/revoke, quota check, **Kirim via WhatsApp** link + per-event message template, guest ↔ session invitations. FE: guest list/form, invitation detail, QR preview, copy link, WhatsApp button | Code entropy/uniqueness, quota 422, 1:1 guest↔invitation | 5 |
| **7** | Guest & RSVP | Public invitation API + page (opening cover, **countdown**, **background music**), RSVP submit/change, **ucapan & doa** + moderation, **amplop digital** (accounts, QRIS, confirmations), organizer guest list with filters, RSVP monitor + summary, public rate limit. FE: guest portal, RSVP monitor | Revoked/unknown code → 404, RSVP after cut-off 409, public endpoints leak no other guest's data | 6 |
| **8** | Check-in | Staff events, lookup, idempotent check-in with Redis lock + unique index, staff activity, audit. FE: staff layout, scanner, result sheet, manual entry | Concurrent double-scan test (1 row), wrong event → 404, unassigned staff → 404, event not Active → 409 | 7 |
| **9** | Photo & Gallery | `IFileStorage` (S3/MinIO + Azure Blob), upload with magic-byte check, EXIF strip, thumbnail, pre-signed URLs, guest gallery (after check-in), organizer gallery, delete, streamed ZIP download, **guest in-app camera capture** (after check-in, per-package limit). FE: capture + upload queue, guest gallery, organizer gallery | Guest before check-in → 403, guest can't see another invitation's photo, non-image rejected, cross-tenant photo → 404 | 8 |
| **10** | Dashboard & Report | Stats queries + Redis cache + invalidation, org overview, CSV + Excel exports. FE: dashboards with charts, reports tab | Stat correctness against seeded data; export column contract | 9 |
| **11** | Audit & Security | Complete audit coverage (login, check-in, upload, delete + extras), audit log viewer, **full permission matrix test** (every endpoint × every role), tenant isolation sweep, security headers, dependency scan, OWASP ZAP baseline | Generated matrix test fails if any endpoint lacks a policy | 10 |
| **12** | Production prep | **Free-tier deployment**: one Cloud Run service in Jakarta (API + PWA), Neon PostgreSQL, Cloudflare R2, Secret Manager, migration as a one-off Cloud Run Job, Cloud Scheduler cleanup, budget alert, one-command deploy script (`gcloud run deploy --source`). Local compose + `.env.example`, OpenTelemetry + dashboards/alerts, backup and restore scripts + runbook, Setup/API/Deployment guides | Restore drill; smoke test in the CD pipeline | 11 |

## Critical path and risks

| Risk | Impact | Mitigation |
|---|---|---|
| Xendit sandbox credentials not yet available | Real payment untested | Decided: build on the FakePaymentGateway first. The Xendit adapter is added when credentials are available |
| Venue connectivity during check-in | Poor guest experience | Lookup + commit are small requests. Manual entry. Upload retry queue. Offline mode is a possible later phase (Q-9) |
| Secret leaked in the **public** repository | Critical | `.gitignore` for `.env`/`appsettings.*.local.json`, GitHub secret scanning + push protection, only `.env.example` with placeholders is committed, and any key that leaks is rotated at once |
| Tenant data leak | Critical | Denormalized `organization_id` + global filters + two-tenant test fixture from Phase 3 |
| Photo storage cost | Operating cost | Client compression, thumbnails, per-package quota and retention |
| Docker not installed on the dev machine | Blocks local run and Testcontainers | Install Docker Desktop (or Podman) before Phase 1 |

## Suggested repository layout

```
EventLy/
├── backend/            EventLy.sln, src/EventLy.Api/, tests/
├── Dockerfile, compose.yaml   one image (API + PWA), local stack
├── web/                React PWA
├── deploy/             (Phase 12) Cloud Run deploy + backup/restore scripts
├── docs/
│   ├── architecture/   ← Phase 0 documents
│   ├── modules/
│   ├── setup-guide.md
│   ├── api.md
│   └── deployment-guide.md
├── .github/workflows/  GitHub Actions CI
└── README.md
```
