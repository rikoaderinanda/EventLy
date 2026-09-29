# syntax=docker/dockerfile:1
# One image = API + built PWA (served from wwwroot). Used by docker compose and by
# `gcloud run deploy --source .` on Cloud Run. Run with the argument `migrate` to apply
# database migrations and exit (compose "migrate" service / Cloud Run migration job).

# ---------- 1. Build the PWA ----------
FROM node:24-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---------- 2. Build and publish the API ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src/backend
COPY backend/global.json backend/Directory.Build.props ./
COPY backend/src/EventLy.Api/EventLy.Api.csproj src/EventLy.Api/
RUN dotnet restore src/EventLy.Api/EventLy.Api.csproj
COPY backend/src/ src/
RUN dotnet publish src/EventLy.Api/EventLy.Api.csproj -c Release -o /app --no-restore -p:UseAppHost=false

# ---------- 3. Runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=api /app ./
COPY --from=web /src/web/dist ./wwwroot
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
# Non-root user provided by the .NET base image.
USER $APP_UID
ENTRYPOINT ["dotnet", "EventLy.Api.dll"]
