# EventLy

A wedding-first event platform: invitation → RSVP → QR check-in → photo capture → personal gallery → event report.

- **Backend:** .NET 10 Web API, layered as Controller → Service → EF Core → PostgreSQL
- **Frontend:** React + Vite + TypeScript PWA (served by the API in production)
- **Hosting (stage 1, free):** Google Cloud Run (Jakarta) + Neon PostgreSQL + Cloudflare R2

The architecture, decisions and roadmap are in [docs/architecture](docs/architecture/README.md).

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Architecture and decisions | ✅ Approved |
| 1 | Foundation: solution, EF Core + first migration, Docker, React app, CI | ✅ Done |
| 2 | Identity: Google sign-in, JWT, roles | Next |

## Quick start (Docker)

Requirements: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env          # local defaults, no real secrets
docker compose up --build
```

| URL | What |
|---|---|
| http://localhost:8080 | The PWA |
| http://localhost:8080/docs | API reference (Scalar) |
| http://localhost:8080/health/ready | Readiness (database + Redis) |

Compose starts PostgreSQL 17 and Redis 7, runs the database migrations once (`migrate` service), then starts the app.

## Development without Docker for the app

Run PostgreSQL somewhere (Docker, a local install, or a free Neon database), then:

```bash
# API on http://localhost:5080
cd backend
dotnet run --project src/EventLy.Api

# PWA on http://localhost:5173 (proxies /api to the API)
cd web
npm install
npm run dev
```

The API reads the connection string `ConnectionStrings:Database`. `appsettings.Development.json` points at `localhost:5432` with the compose defaults. Override it with the environment variable `ConnectionStrings__Database`.

More details: [docs/setup-guide.md](docs/setup-guide.md).

## Common commands

| Task | Command |
|---|---|
| Backend tests | `cd backend && dotnet test` |
| Frontend tests / lint / format | `cd web && npm test`, `npm run lint`, `npm run format` |
| Apply migrations | `cd backend && dotnet run --project src/EventLy.Api -- migrate` |
| Add a migration | `cd backend && dotnet tool restore && dotnet ef migrations add <Name> --project src/EventLy.Api --output-dir Data/Migrations` |

Database integration tests use Testcontainers. Without Docker they are **skipped** locally; in CI (GitHub Actions) they always run.

## Repository layout

```
backend/   .NET solution: src/EventLy.Api (the application), tests/
web/       React PWA
docs/      architecture, legal drafts, guides
Dockerfile one image: API + built PWA
compose.yaml local stack
```

## Security notes (public repository)

- Never commit secrets. `.env` and `appsettings.*.local.json` are git-ignored. Production secrets live in Google Secret Manager and GitHub Actions secrets.
- Turn on **Secret scanning** and **Push protection** in the GitHub repository settings (Settings → Code security).
