# EventLy — Setup Guide

Written for developers setting up EventLy on their own machine.

## 1. Tools

| Tool | Version | Used for |
|---|---|---|
| .NET SDK | 10.0 (see `backend/global.json`) | API and tests |
| Node.js | 24 LTS | PWA |
| Docker Desktop | current | Local stack (`docker compose`) and database integration tests |
| Git | any recent | Source control |

On Windows, install Docker Desktop with the WSL 2 backend, then restart. Check it with `docker version`.

## 2. Run everything with Docker

```bash
cp .env.example .env
docker compose up --build
```

What happens:

1. `postgres` (17) and `redis` (7) start. Their data is kept in named volumes (`pgdata`, `redisdata`).
2. `migrate` runs `dotnet EventLy.Api.dll migrate` once, which applies EF Core migrations, and then exits.
3. `app` starts on http://localhost:8080 after `migrate` succeeds.

Useful commands:

```bash
docker compose logs -f app          # follow API logs
docker compose run --rm migrate     # re-run migrations
docker compose down                 # stop (data is kept)
docker compose down -v              # stop and delete the local database
```

To change ports or the local database password, edit `.env`.

## 3. Run the API and PWA directly (faster feedback)

Start only the dependencies with Docker:

```bash
docker compose up -d postgres redis
```

Then, in two terminals:

```bash
cd backend && dotnet run --project src/EventLy.Api      # http://localhost:5080
cd web && npm install && npm run dev                     # http://localhost:5173
```

The Vite dev server proxies `/api`, `/health`, `/docs` and `/openapi` to the API. To apply migrations:

```bash
cd backend && dotnet run --project src/EventLy.Api -- migrate
```

## 4. Configuration

All settings can be overridden with environment variables. Use `__` as the section separator.

| Setting | Environment variable | Default | Notes |
|---|---|---|---|
| Database connection | `ConnectionStrings__Database` | *(required)* | Development default: compose PostgreSQL on localhost |
| Cache provider | `Cache__Provider` | `Memory` | `Redis` in docker compose |
| Redis connection | `Cache__RedisConnection` | – | Required when the provider is `Redis` |
| API docs | `ApiDocs__Enabled` | `false` | Always on in Development |
| Environment | `ASPNETCORE_ENVIRONMENT` | `Production` | `Development` locally |
| JWT signing key | `Auth__Jwt__SigningKey` | *(required, ≥ 32 bytes)* | **Secret.** Development has a `dev-only` key; outside Development/Testing that key is refused at startup |
| Google client id | `Auth__GoogleClientId` | *(required outside Development)* | Public value from Google Cloud Console (see §7) |
| Root account | `Auth__RootEmail` | – | The one Google email that signs in as Root. Development: `root@evently.test` |
| Test sign-in | `Auth__DevSignInEnabled` | `false` | Sign in without Google. Only works in Development/Testing, even if switched on elsewhere |
| Sign-in rate limit | `RateLimiting__AuthPermitPerMinute` | `10` | Per client IP, for sign-in/refresh/logout |
| Terms version | `Legal__TermsVersion` | `2026-09-29` | Bump it when the Terms/Privacy text changes; Owners then accept the new version |

Frontend build variables (`web/.env.example`): `VITE_API_BASE_URL` (default `/api/v1`), `VITE_APP_NAME`, `VITE_DEFAULT_LOCALE` (`id` or `en`). They end up in public JavaScript, so never put secrets there.

## 5. Tests

```bash
cd backend && dotnet test        # unit + integration (database tests need Docker)
cd web && npm test               # Vitest + Testing Library
```

Without Docker, the database integration tests are reported as **skipped**, not failed. On GitHub Actions the `CI` variable is set, so a missing Docker there is a real failure.

## 6. Endpoints available so far

| Endpoint | Purpose |
|---|---|
| `GET /health/live` | The process is running (no dependency checks) |
| `GET /health/ready` | Database (and Redis when enabled) reachable. Returns 503 within about 5 seconds if not |
| `GET /api/v1/system/info` | Name, version, environment, server time |
| `/docs`, `/openapi/v1.json` | API reference (Development, or `ApiDocs__Enabled=true`) |
| `GET /api/v1/auth/config` | Google client id (public) and whether test sign-in is on |
| `POST /api/v1/auth/google` · `/dev-sign-in` | Sign in → access token + HttpOnly refresh cookie |
| `POST /api/v1/auth/refresh` · `/logout` | Rotate / end the session (need header `X-Requested-With`) |
| `GET /api/v1/auth/me` | The signed-in user and permissions |
| `POST /api/v1/organization` | Onboarding: create the organization, accept the Terms (returns a token with `org_id`) |
| `GET` · `PUT /api/v1/organization` | Organization profile (all members read, Owner edits) |
| `GET` · `POST /api/v1/users`, `PUT` · `DELETE /api/v1/users/{id}` | Owner manages Admin/Staff (invite by Google email, change role/status, cancel invitation) |
| `GET /api/v1/platform/owners`, `POST …/{id}/suspend` · `/reactivate` | Root: Owner accounts |
| `GET` · `POST /api/v1/events`, `GET` · `PUT` · `DELETE /api/v1/events/{id}` | Events (Staff: only assigned ones) |
| `POST /api/v1/events/{id}/cancel` · `/complete` | Status changes (cancel: Owner; complete: from Active) |
| `GET` · `PUT /api/v1/events/{id}/staff` | Owner assigns Staff to the event |
| `/legal/terms`, `/legal/privacy` | Terms & Privacy Policy pages |
| any other path | The PWA (`index.html`); unknown `/api/...` paths return a JSON 404 |

## 7. Google sign-in (OAuth client id)

Everyone signs in with Google. Locally you can use the **test sign-in** on the login page instead (Development only); `root@evently.test` becomes Root.

To use real Google sign-in:

1. Open https://console.cloud.google.com/ and create (or pick) a project, for example `evently`.
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name (EventLy), support email and developer email. While testing, add your own Google address under *Test users*.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:8080` and `http://localhost:5173` (later also the Cloud Run URL / your domain)
   - No redirect URI is needed (the button uses a popup).
4. Copy the **Client ID** (`…apps.googleusercontent.com`). It is public, not a secret; there is no client secret to store.
5. Give it to the API:
   - docker compose: add `AUTH_GOOGLE_CLIENT_ID=…` to `.env`
   - `dotnet run`: set `Auth__GoogleClientId=…` or put it in `appsettings.Development.json`
6. Restart. The login page now shows **"Continue with Google"**. Set `Auth__RootEmail` to your own Google address if you want to sign in as Root.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `Connection string 'ConnectionStrings:Database' is not configured` | Set `ConnectionStrings__Database`, or run with `ASPNETCORE_ENVIRONMENT=Development` |
| `/health/ready` returns 503 | PostgreSQL isn't reachable. Check `docker compose ps` and the connection string |
| Port 5432 / 6379 / 8080 already in use | Change `POSTGRES_PORT`, `REDIS_PORT` or `APP_PORT` in `.env` |
| Integration tests "skipped" | Docker isn't running. Start Docker Desktop and run the tests again |
| `Auth:Jwt:SigningKey must be at least 32 bytes` | Set `Auth__Jwt__SigningKey` (Production), or run with `ASPNETCORE_ENVIRONMENT=Development` |
| Google button: "origin is not allowed" | Add the exact origin (scheme + host + port) to *Authorized JavaScript origins* in Google Cloud Console |
