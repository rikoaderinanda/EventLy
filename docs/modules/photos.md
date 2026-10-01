# Module: Photos, Gallery & Invitation Media

> Phase 9 · Code: `PhotosController`, `EventMediaController`, the photo endpoints of `PublicInvitationsController` → `PhotoService`, `EventMediaService`; `Storage/` (`IFileStorage`, `S3FileStorage`, `ImageProcessor`, `AudioCheck`)

After a guest checks in, Staff (or the Owner) can take photos for the guest's invitation. The guest can take their own photos with the in-app camera, if the package allows it. The guest sees their invitation's photos in their gallery. Owner and Admin see the whole event, delete photos and download everything as a ZIP. The Owner also uploads the invitation page's cover photo, background music and QRIS image.

## Use cases

| Who | Can |
|---|---|
| Staff (assigned), Owner | Add 1–10 photos to a checked-in invitation, from the "Ambil foto" button after a scan |
| Guest (code) | After check-in: see and download their invitation's photos, take photos with the in-app camera (within the limits), delete the photos they took |
| Owner, Admin | Gallery of the event, delete any photo, download one photo or everything as a ZIP (`zipDownload`), switch the guest camera off for the event, upload the cover photo, music and QRIS image |

## Storage

`IFileStorage` is an abstraction on purpose. The provider is swappable, and tests use an in-memory store (`FakeFileStorage`).

- **Production:** Cloudflare R2 (Q-23).
- **Local:** **SeaweedFS** (Apache-2.0) in docker compose. MinIO no longer publishes free Docker images.
- **One adapter:** `S3FileStorage` (AWSSDK.S3, Apache-2.0) covers both, since both speak the S3 API. The specification asks for S3, Azure Blob *or* MinIO, so an Azure adapter isn't built; one could be added behind the same interface.
- **Private objects:** the bucket is never public. The server keeps object keys only, and readers get **signed GET URLs that live 10 minutes**. Downloads use a signed URL with `Content-Disposition: attachment`.
- **Two endpoints:** `Storage__ServiceUrl` is what the server talks to (`http://storage:8333` inside Docker). `Storage__PublicUrl` goes into signed URLs and must be reachable from the browser (`http://127.0.0.1:8333` locally, a tunnel URL to test from a phone, the R2 endpoint in production).
- **Bucket:** the `migrate` command creates it when it's missing (locally).
- **Keys:** `org/{orgId}/event/{eventId}/inv/{invitationId}/{photoId}.jpg` and `…_thumb.jpg`. Event media live under `org/{orgId}/event/{eventId}/{cover|qris|music}/…`.

## Upload hardening

`ImageProcessor` uses SkiaSharp (MIT). ImageSharp is not used, because its license (Six Labors Split License) isn't free for larger companies.

- **Type:** taken from the **magic bytes** (JPEG, PNG, WebP), never from the name or Content-Type. Other files, such as SVG, GIF or files that only look like a JPEG at the start, give 400 `photo.invalid_image`.
- **Size:** at most 15 MB per file and 50 megapixels, which refuses decompression bombs.
- **Re-encode:** the image is decoded and **re-encoded as JPEG 85**, with the long edge at most 2048 px. This drops **all metadata, GPS included**, and anything hidden in the file. The EXIF orientation is applied to the pixels first, so the photo stays upright.
- **Thumbnail:** long edge 480, JPEG 75.
- **Browser side:** the PWA already shrinks photos to 2048 px, JPEG 0.85 before upload, which matters on a weak signal at the venue.
- **Music (Q-43):** MP3 (`ID3` or a frame sync) or M4A (`ftyp` brand), at most 10 MB, recognised by the magic bytes (400 `media.invalid_audio`).

## Rules

- **Staff upload:**
  - Only for an **Active** event (409 `photo.event_not_active`) and a **checked-in** invitation (409 `photo.not_checked_in`).
  - Staff only at assigned events; other events are 404. Admin can't upload (`photo.upload` is Owner and Staff).
  - 1 to 10 files per request.
- **Limits:**
  - Every photo counts toward the package's **`maxPhotos`** for the event (422 `photo.quota_exceeded`).
  - Guest shots also count toward **`maxGuestPhotosPerInvitation`** (422 `photo.guest_limit_exceeded`).
  - The files are stored first, then counted and recorded under a **row lock on the event**, so uploads at the same moment can't overshoot. When an upload is refused, its stored files are removed again.
- **Guest camera (Q-25, Q-26):** available only when every one of these holds:
  - The guest has checked in.
  - The event is Active.
  - The package has `guestUploadEnabled`, and the event's own switch is on (Owner/Admin can turn it off).
  - The guest has photos left, and the event has photos left.
  - It is before **midnight after the check-in session's date** in the event's time zone.

  Otherwise the answer is 409 `photo.camera_closed`. One photo per request, at the public write rate limit (10/min per IP). The PWA shows a live camera view with the shutter, then "Pakai" or "Ulangi", and never a file picker. "Camera only" is an interface rule; the server limits the damage with the checks above (architecture §6.5).
- **Guest gallery:** **403 `gallery.locked` until check-in.** After that, only this invitation's photos. It stays open after the camera window closes. The guest can delete only photos *they* took (`source = Guest`); Staff photos give 404.
- **Delete:** the row and both objects are removed (no soft delete). Both the organizer's delete and the guest's delete are audited (`photo.deleted`).
- **ZIP:** only with the package's `zipDownload` (403 `photo.zip_not_in_package`). It is streamed straight from storage into the response, with one folder per guest and photos named `001.jpg`, `002.jpg`. There is no temporary file and no queue.
  - The photos are stored without compressing them again.
  - `ZipArchive` writes each entry's data descriptor synchronously, so synchronous IO is allowed for that one response.
  - The PWA saves the ZIP as a blob. This is fine for typical weddings; very large galleries can be downloaded per guest with `invitationId=`.
- **Invitation media:**
  - The cover photo (re-encoded like photos) shows on the "Buka Undangan" cover and at the top of the page.
  - The music starts with the tap on "Buka Undangan", because browsers block autoplay with sound. One `<audio>` element survives the cover closing, and a mute button floats on the page. It only plays when the package has `backgroundMusicEnabled`.
  - The QRIS image shows with the gift accounts.
  - Replacing a file removes the old object.
- **Not here:** deleting photos after `galleryRetentionDays` is part of the scheduled maintenance job (Phase 12).
- **Audit:** `photo.uploaded` (each photo: invitation, source, size), `photo.deleted`, `event.media_updated`.

## Endpoints

| Method | Path | Who |
|---|---|---|
| POST | `/invitations/{invitationId}/photos` | Owner, Staff (assigned). `multipart/form-data`, `files` 1–10 |
| GET | `/events/{eventId}/gallery?invitationId=` | Owner, Admin. `{photos, total, limit, storageBytes, zipAllowed, guestCameraInPackage, guestCameraEnabled}` |
| DELETE | `/photos/{photoId}` | Owner, Admin |
| GET | `/photos/{photoId}/download` | Owner, Admin. 302 to a signed URL |
| GET | `/events/{eventId}/gallery/zip?invitationId=` | Owner, Admin, with `zipDownload` |
| PUT | `/events/{eventId}/guest-camera` | Owner, Admin. `{enabled}` |
| GET | `/events/{eventId}/media` · PUT/DELETE `/events/{eventId}/media/{cover\|qris\|music}` | Owner, Admin |
| GET | `/public/invitations/{code}/gallery` | Guest. `{photos, camera: {available, taken, limit, closesAt}}` |
| GET | `/public/invitations/{code}/gallery/{photoId}/download` | Guest. 302 |
| POST | `/public/invitations/{code}/photos` | Guest camera, `file` |
| DELETE | `/public/invitations/{code}/photos/{photoId}` | Guest, own shots only |
| GET | `/public/invitations/{code}/music` | Guest. 302 |

## Frontend

- **Scanner:** after a check-in (or a repeat scan) the result sheet has **"Ambil foto"**. It opens the live in-app camera (the same view as the guest camera; works with a phone camera and a laptop webcam, over HTTPS or localhost), and each photo used is shrunk and uploaded; several can be added one after another. "atau pilih file foto" is the fallback for a device without a camera.
- **Gallery:** when the package has no guest camera (Basic), the page says so, instead of the camera switch.
- **Guest page:**
  - The cover photo and background music with a mute button.
  - After check-in, **"Foto Anda"**: thumbnails, download, delete own shots, and "Ambil foto" with the live camera (switch front/back, then "Pakai" or "Ulangi").
  - The QRIS image with the digital gift.
- **Organizer:**
  - **Galeri foto** `/app/events/:id/gallery`: grouped by guest, delete, "Unduh semua (ZIP)", the guest camera switch, the photo count against the package.
  - **Media undangan** `/app/events/:id/media`: cover, music (with a player) and QRIS, with upload, replace and remove.

## Tests

- **Unit:** `MediaProcessingTests`:
  - A large photo is scaled to 2048 and gets a thumbnail.
  - **GPS EXIF is removed.**
  - **The orientation tag is applied.**
  - PNG and WebP become JPEG; other formats and a fake JPEG header are refused.
  - MP3 and M4A are recognised by their magic bytes.
  - The camera closes at midnight in WIB and WIT.
- **Integration:**
  - `PhotosTests`:
    - Upload, cleaned and resized, with the audit entry.
    - A guest not checked in, a non-image file, Admin 403, another tenant 404, the Owner's source.
    - The quota 422 leaves nothing behind.
    - The organizer gallery, download and delete.
    - The ZIP, and its package gate.
    - The guest gallery: locked before check-in, own invitation only.
    - The guest camera: limit, delete frees a place, package off, event switch, after midnight.
    - Another tenant can't see or delete; cover, QRIS and music on the invitation page.
  - `S3FileStorageTests`: the real adapter against SeaweedFS (put, read, a signed URL a browser opens, attachment download, delete).
- **Web:** `photos.test.tsx` (gallery grouping, delete and camera switch; media upload; staff "Ambil foto"; the guest gallery with the camera button and "delete own only").
