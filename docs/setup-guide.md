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

Frontend build variables (`web/.env.example`): `VITE_API_BASE_URL` (default `/api/v1`), `VITE_APP_NAME`, `VITE_DEFAULT_LOCALE` (`id` or `en`). They end up in public JavaScript, so never put secrets there.

## 5. Tests

```bash
cd backend && dotnet test        # unit + integration (database tests need Docker)
cd web && npm test               # Vitest + Testing Library
```

Without Docker, the database integration tests are reported as **skipped**, not failed. On GitHub Actions the `CI` variable is set, so a missing Docker there is a real failure.

## 6. Endpoints available after Phase 1

| Endpoint | Purpose |
|---|---|
| `GET /health/live` | The process is running (no dependency checks) |
| `GET /health/ready` | Database (and Redis when enabled) reachable. Returns 503 within about 5 seconds if not |
| `GET /api/v1/system/info` | Name, version, environment, server time |
| `/docs`, `/openapi/v1.json` | API reference (Development, or `ApiDocs__Enabled=true`) |
| any other path | The PWA (`index.html`); unknown `/api/...` paths return a JSON 404 |

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `Connection string 'ConnectionStrings:Database' is not configured` | Set `ConnectionStrings__Database`, or run with `ASPNETCORE_ENVIRONMENT=Development` |
| `/health/ready` returns 503 | PostgreSQL isn't reachable. Check `docker compose ps` and the connection string |
| Port 5432 / 6379 / 8080 already in use | Change `POSTGRES_PORT`, `REDIS_PORT` or `APP_PORT` in `.env` |
| Integration tests "skipped" | Docker isn't running. Start Docker Desktop and run the tests again |
