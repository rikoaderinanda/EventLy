# Deployment Guide

> How to put EventLy online. Target from the roadmap (Phase 12): **one Cloud Run service in Singapore** (API + PWA in one image; Singapore instead of Jakarta so the free domain mapping can be used, see §1a), **Neon PostgreSQL**, **Cloudflare R2** for photos, **Secret Manager** for secrets, the migration as a **Cloud Run Job**. Written 2026-10-01, after Phase 10; check the provider consoles, since their screens change.

## 0. Read first: what must be done before a public launch

| # | Item | Why it blocks | Status |
|---|---|---|---|
| **B1** | **Payment provider for production** | `Payments:Provider` is only `Fake`, and `Fake` refuses to start outside Development/Testing (anyone could "pay" through the simulator). **Neither the API nor the migration job starts in Production until this is solved.** | Open. Options: (a) build the **Xendit** adapter (planned, Q-52); (b) add a **manual-transfer** mode: no online checkout, the Owner transfers and Root activates the event with the existing manual activation |
| B2 | Phase 11: audit & security | Security headers (CSP, HSTS), the permission matrix test, a dependency scan and an OWASP ZAP baseline are planned but not done | Recommended before real guest data |
| B3 | Retention jobs (Phase 12) | The Privacy Policy promises that photos are **deleted automatically** after the package's retention period, and guest data **12 months after the event**. Neither cleanup job exists yet, so data is kept longer than promised (and storage grows) | Needed within the first retention period (30 days for Basic) |
| B4 | Backups | Neon keeps point-in-time history (length depends on the plan); R2 has no backup by default | Decide before real events |
| B5 | Domain | Needed for Google sign-in, invitation links (`App__PublicBaseUrl`) and absolute Open Graph URLs | Choose one |

Until B1 is solved you can still rehearse everything below on a **staging** copy, but only with `ASPNETCORE_ENVIRONMENT=Development`, which also enables the payment simulator and the test sign-in. **Never give a Development deployment a public domain or real guests.**

## 1a. What it costs

Prices and free allowances change; check each provider's pricing page before deciding. As of 2026-10, from memory of the published offers:

| Part | Free? | Notes |
|---|---|---|
| Google Cloud account | Needs a **credit card** | Billing must be on even while usage stays inside the free allowances |
| Cloud Run (the app) | Monthly free allowance | Enough for small traffic with `--min-instances 0`. `--min-instances 1` (no cold start) **costs money**: an instance is always on |
| Cloud Build | Free build minutes | An occasional release fits |
| Artifact Registry | About 0.5 GB free | One image is about 300 MB: delete old images (§13) or pay a few cents |
| Secret Manager | Free for a handful of secrets | EventLy uses 5 |
| Cloud Scheduler | 3 jobs free | EventLy uses 1–2 |
| Domain mapping | Free, **only in some regions** | Available in Singapore, which is why this guide uses `asia-southeast1` (not Jakarta) |
| Load Balancer | **Paid** (roughly USD 18+/month) | Only needed in a region without domain mapping |
| Neon (database) | Free plan | Small storage (about 0.5 GB), limited compute hours, suspends when idle (a few seconds to wake), short restore history. Fine for trials; use a paid plan for real events |
| Cloudflare R2 (photos) | About 10 GB free, **no egress fees** | 10 GB is roughly 10–20 thousand photos; one Enterprise event may hold 10,000 |
| Google sign-in (OAuth) | Free | |
| Domain | **Paid**, yearly | At the registrar |
| Xendit (later) | No monthly fee | A fee per transaction |

**Trial or demo:** close to Rp 0 per month with Singapore, `min-instances 0`, Neon free, R2 free and old images deleted. You still pay for the **domain** and need a **card** on Google Cloud.

**Real events:** plan a small monthly budget for a paid Neon plan (longer backups, no sleeping), optionally `--min-instances 1` on event days, and R2 storage beyond 10 GB.

Set a **budget alert** first: Google Cloud Console → *Billing → Budgets & alerts* → a small amount (for example USD 5) with e-mail alerts at 50%, 90% and 100%.

## 1. What you need

| Account / tool | Used for |
|---|---|
| Google Cloud project with billing, and the [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) | Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Cloud Scheduler |
| Google Cloud Console → *APIs & Services → Credentials* | The OAuth client id for "Masuk dengan Google" |
| [Neon](https://neon.tech) | PostgreSQL |
| [Cloudflare](https://dash.cloudflare.com) | R2 object storage (and DNS, if the domain is there) |
| A domain | e.g. `evently.id` |

Values used below (replace them):

```bash
PROJECT=evently-prod            # Google Cloud project id
REGION=asia-southeast1          # Singapore: free domain mapping, next to Neon
DOMAIN=evently.id
REPO=evently                    # Artifact Registry repository
IMAGE=$REGION-docker.pkg.dev/$PROJECT/$REPO/evently
```

## 2. Database: Neon

1. Create a project in region **AWS Asia Pacific (Singapore)** (the same city as the app), PostgreSQL 17 or newer, database `evently`.
2. Copy the **direct** connection (not the pooled one: the app keeps its own connection pool, and the migration needs a normal session).
3. Write it in Npgsql form:

   ```
   Host=ep-xxxx.ap-southeast-1.aws.neon.tech;Database=evently;Username=evently_owner;Password=…;SSL Mode=Require
   ```

4. In Neon, keep point-in-time restore on, and note how many days your plan keeps (B4).

## 3. Photo storage: Cloudflare R2

1. **R2 → Create bucket** `evently`, location hint **Asia-Pacific**. Keep it **private** (no public access, no custom domain): the app hands out 10-minute signed links.
2. **R2 → Manage API tokens → Create API token**: permission *Object Read & Write*, limited to the bucket `evently`. Save the **Access Key ID** and **Secret Access Key**.
3. Your endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (account id on the R2 overview page).
4. No CORS rule is needed: browsers only load signed links in `<img>`/`<audio>`, and uploads go through the API.

## 4. Google sign-in

In Google Cloud Console → **Google Auth Platform** (*APIs & Services → OAuth consent screen*):

1. **Get started:** app name EventLy, support email, audience **External**, contact email.
2. **Clients → Create client → Web application**, name `EventLy Web`:
   - Authorized JavaScript origins: `http://localhost:5173` and `http://127.0.0.1:5173` for testing from a laptop; add `https://evently.id` once the domain works (§10).
   - No redirect URI (the button uses Google Identity Services). The client secret isn't used.
3. Copy the **client id** (public, not a secret).
4. **Before the domain exists** the app stays in **Testing**: *Publish app* is disabled until *Branding* is complete. Only the accounts under **Audience → Test users** (up to 100) can sign in; add your own, the Root email and the testers.
5. **Once the domain works** (part of the launch): *Branding* → home page `https://evently.id`, privacy policy `/legal/privacy`, terms `/legal/terms`, the domain under *Authorized domains* (Google may ask you to verify it in Search Console); then **Audience → Publish app**. EventLy only asks for e-mail, name and picture, so no Google verification review is needed. Until this is done, guests aren't affected (they never sign in), but new Owners can't sign in.

## 5. Secrets

Generate the two app secrets:

```bash
openssl rand -base64 48   # JWT signing key (at least 32 bytes)
openssl rand -hex 32      # maintenance key for scheduled jobs
```

Put the secrets in Secret Manager (never in the image, compose files or Git):

```bash
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com

printf '%s' 'Host=…;SSL Mode=Require'  | gcloud secrets create evently-db --data-file=-
printf '%s' '<jwt key>'                | gcloud secrets create evently-jwt --data-file=-
printf '%s' '<maintenance key>'        | gcloud secrets create evently-maintenance --data-file=-
printf '%s' '<R2 access key id>'       | gcloud secrets create evently-r2-access --data-file=-
printf '%s' '<R2 secret access key>'   | gcloud secrets create evently-r2-secret --data-file=-
```

A service account for the app, allowed to read them:

```bash
gcloud iam service-accounts create evently-run
SA=evently-run@$PROJECT.iam.gserviceaccount.com
for s in evently-db evently-jwt evently-maintenance evently-r2-access evently-r2-secret; do
  gcloud secrets add-iam-policy-binding $s --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
done
```

## 6. Configuration

Everything else is plain environment variables. Full list: [setup-guide.md §4](setup-guide.md#4-configuration).

| Variable | Production value |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` (the default) |
| `ConnectionStrings__Database` | secret `evently-db` |
| `Auth__Jwt__SigningKey` | secret `evently-jwt` |
| `Auth__GoogleClientId` | the OAuth client id (§4) |
| `Auth__RootEmail` | the Google email that administers the platform (Root) |
| `App__PublicBaseUrl` | `https://evently.id` (used in invitation links and QR codes) |
| `Storage__ServiceUrl` · `Storage__PublicUrl` | both `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `Storage__Bucket` · `Storage__Region` | `evently` · `auto` |
| `Storage__AccessKey` · `Storage__SecretKey` | secrets `evently-r2-access` · `evently-r2-secret` |
| `Maintenance__Key` | secret `evently-maintenance` |
| `Payments__Provider` | see **B1**: no production value exists yet |
| `Cache__Provider` | `Memory` (the default; no Redis needed for one instance) |

Not set in production: `Auth__DevSignInEnabled` (ignored outside Development anyway) and `ApiDocs__Enabled` (keep the API description private).

Put the non-secret values in a file, e.g. `deploy/prod.env.yaml` (kept out of Git if you prefer):

```yaml
ASPNETCORE_ENVIRONMENT: Production
Auth__GoogleClientId: "123-abc.apps.googleusercontent.com"
Auth__RootEmail: "you@example.com"
App__PublicBaseUrl: "https://evently.id"
Storage__ServiceUrl: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
Storage__PublicUrl: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
Storage__Bucket: "evently"
Storage__Region: "auto"
```

```bash
SECRETS=ConnectionStrings__Database=evently-db:latest,Auth__Jwt__SigningKey=evently-jwt:latest,\
Maintenance__Key=evently-maintenance:latest,Storage__AccessKey=evently-r2-access:latest,\
Storage__SecretKey=evently-r2-secret:latest
```

## 7. Build the image

The root `Dockerfile` builds the PWA and the API into one image.

```bash
gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION
TAG=$(git rev-parse --short HEAD)
gcloud builds submit --tag $IMAGE:$TAG .
```

Run the tests before you build (`cd backend && dotnet test`, `cd web && npm test`).

## 8. Migrate the database (every release, before the new version goes live)

The API never changes the schema on start-up; a job runs `migrate` and exits.

```bash
# first time
gcloud run jobs create evently-migrate --image $IMAGE:$TAG --region $REGION --args migrate \
  --service-account $SA --env-vars-file deploy/prod.env.yaml --set-secrets "$SECRETS" --max-retries 0

# every release
gcloud run jobs update evently-migrate --image $IMAGE:$TAG --region $REGION
gcloud run jobs execute evently-migrate --region $REGION --wait
```

Migrations only move forward. Look at new ones before a release (`backend/src/EventLy.Api/Data/Migrations`); a migration that drops or rewrites data needs a backup first.

## 9. Deploy the service

```bash
gcloud run deploy evently --image $IMAGE:$TAG --region $REGION \
  --service-account $SA --env-vars-file deploy/prod.env.yaml --set-secrets "$SECRETS" \
  --allow-unauthenticated --port 8080 \
  --cpu 1 --memory 1Gi --cpu-boost \
  --min-instances 0 --max-instances 2 \
  --concurrency 40 --timeout 300
```

- **Memory 1 GiB:** photos are decoded and re-encoded in memory (up to 50 megapixels).
- **Max instances:** rate limits are counted per instance (in memory). Keep the count low until Redis-backed limits are needed.
- **Timeout 300 s:** the gallery ZIP streams for a while on big events.
- `--min-instances 1` removes the cold start (a few seconds) at the price of an always-on instance; worth it on event days.

Check it: `curl https://<service-url>/health/ready` answers 200 when the database is reachable.

## 10. Domain

1. Map the domain to the service (free; Singapore supports it, Jakarta doesn't at the time of writing):

   ```bash
   gcloud beta run domain-mappings create --service evently --domain $DOMAIN --region $REGION
   ```

   Domain mapping is a preview feature; if Google changes that, the paid alternative is a Global External Application Load Balancer with a serverless network endpoint group, or Firebase Hosting in front.
2. Add the DNS records Google shows. With Cloudflare DNS, start with the records **DNS only** (grey cloud) so Google can issue the certificate.
3. When HTTPS works on the domain, set `App__PublicBaseUrl` to it (it is already in §6 if you knew it) and add the domain to the OAuth origins (§4).
4. In `web/index.html`, make `og:image` absolute (`https://evently.id/og-image.png`) and add `og:url` and `<link rel="canonical">`.

## 11. Scheduled jobs

Once a real payment gateway exists (B1), reconcile payments the webhook may have missed:

```bash
gcloud scheduler jobs create http evently-reconcile --location $REGION --schedule "*/15 * * * *" \
  --uri "https://evently.id/api/v1/maintenance/payments/reconcile" --http-method POST \
  --headers "X-Maintenance-Key=<maintenance key>"
```

The gallery retention cleanup (B3) is added here when Phase 12 builds it.

## 12. First run

1. Sign in with the **Root** email → *Paket*: check the prices and limits (seed values: Basic Rp 150.000, Premium Rp 350.000, Enterprise Rp 1.000.000). If you change them, also update `web/src/features/landing/packages.ts` and the JSON-LD in `web/index.html`.
2. Sign in with another Google account as an Owner, accept the Terms, create an event.
3. Activate it (payment or Root manual activation), add a guest, open the invitation link on a phone.
4. Upload a cover photo and a staff photo; the images must load (R2 signed links).
5. Scan the guest's QR with the staff scanner (the camera needs HTTPS, which the domain gives).
6. Download a CSV report.

## 13. Releasing an update

```bash
TAG=$(git rev-parse --short HEAD)
gcloud builds submit --tag $IMAGE:$TAG .
gcloud run jobs update evently-migrate --image $IMAGE:$TAG --region $REGION
gcloud run jobs execute evently-migrate --region $REGION --wait
gcloud run deploy evently --image $IMAGE:$TAG --region $REGION
```

Avoid releasing during an event (check-in in progress).

**Roll back** the service to the previous revision:

```bash
gcloud run revisions list --service evently --region $REGION
gcloud run services update-traffic evently --region $REGION --to-revisions <previous-revision>=100
```

The database isn't rolled back by this. Releases whose migration isn't backward compatible need a restore from Neon's history instead.

## 14. Watching it

- **Logs:** Cloud Run → *Logs* (Serilog writes to the console).
- **Health:** `/health/live` (process) and `/health/ready` (database; Redis when configured). Point an uptime check at `/health/ready`.
- **Costs:** the budget alert from §1a; watch the Neon compute hours and the R2 storage size.
- **Old images:** keep the last few tags and delete the rest, so Artifact Registry stays inside its free space:

  ```bash
  gcloud artifacts docker images list $IMAGE --include-tags --sort-by=~UPDATE_TIME
  gcloud artifacts docker images delete $IMAGE:<old-tag> --delete-tags --quiet
  ```
