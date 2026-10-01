# Module: Reports

> Phase 10 · Code: `ReportsController` → `ReportService` · PWA: `features/reports` (`/app/events/:id/reports`)

Owner and Admin download an event's data to print, share with the family or keep. The numbers on screen (dashboard and statistics) were built in the redesign (UI-3, Q-60); this module adds the files.

## Reports

| Report | Columns | Rows |
|---|---|---|
| Tamu (`guests`) | Nama, Jenis, Jumlah orang, WhatsApp, Email, Sesi, Status undangan, Dibuka, RSVP, Dijawab, Check-in | Every guest on the list (active and revoked invitations), by name |
| Check-in (`check-ins`) | Waktu, Tamu, Jumlah orang, Petugas, Metode | Every check-in, oldest first |
| Foto (`photos`) | Tamu, Jumlah foto, Dari petugas, Dari tamu, Ukuran (MB) | Invitations with photos, by name |
| Ucapan (`wishes`) | Tamu, Ucapan, Disembunyikan, Waktu | Every wish, hidden ones included |
| Hadiah (`gifts`) | Pengirim, Undangan, Jumlah (Rp), Catatan, Waktu | Every gift confirmation |

Column names, the report name in the file name and words such as *Hadir* follow the app language (Indonesian by default, English with `Accept-Language: en`, Q-57).

## Rules

- **Who:** Owner and Admin (`report.export`); Staff 403, another organization's event 404.
- **Formats:**
  - **CSV**, every package. UTF-8 with a BOM, **semicolon** separator and CRLF, so it opens as columns in Excel set to Indonesian (Q-67). Fields with `;`, quotes or line breaks are quoted.
  - **Excel (.xlsx)**, only with the package's `excelExport` (Q-2): 403 `report.excel_not_in_package` otherwise. Written with MiniExcel (Apache-2.0); dates are real date cells.
  - **All in one** (`GET /events/{id}/reports`): one workbook, one sheet per report (Q-70); Excel only. Empty sheets keep their header row.
- **Times** are the venue's wall clock (WIB/WITA/WIT), written `yyyy-MM-dd HH:mm` in CSV.
- **Contact details** (WhatsApp, email) are included (Q-68). **Invitation links and codes are not** (Q-69): a link is the guest's check-in key.
- **CSV injection:** a cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading apostrophe, so Excel never runs it as a formula. Excel files store text as text.
- **Audit:** every download writes `report.exported` with `{kind, format}` (`kind` is the stable URL name, `all` for the workbook).
- **Rate limit:** `export` policy, 10 downloads per minute per user (also on the gallery ZIP).
- **Size:** a report is built in memory; at the planned scale (5,000 guests per event) that is a few hundred kilobytes.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/events/{eventId}/reports/{kind}?format=csv\|xlsx` | `kind`: `guests`, `check-ins`, `photos`, `wishes`, `gifts`. Default `csv`; anything else 400 `report.invalid_format`; unknown kind 404 `report.not_found` |
| GET | `/events/{eventId}/reports` | Every report in one `.xlsx` |

The file name comes from the server in `Content-Disposition`, e.g. `resepsi-rina-budi-tamu-2026-10-01.csv`.

## Frontend

**Laporan** page (sidebar under *Kelola acara*, the tile on the event page, and "Unduh laporan" on the statistics page): one row per report with CSV and Excel buttons, "Unduh semua (Excel)" when the package allows it, a note on CSV-only packages, and a reminder that the files contain contact details. Downloads go through `apiFetchFile` (the access token is needed) and keep the server's file name.

## Tests

- **Integration** (`ReportsTests`): semicolon CSV with BOM, Indonesian headers, RSVP and venue-local check-in time, no invitation code in the file; CSV injection; Excel refused on Basic; the workbook's five sheets with headers on an empty sheet; English headers; the audit entry; Staff 403, other tenant 404, unknown report 404, bad format 400.
- **Web** (`reports.test.tsx`): CSV download under the server's file name with Excel locked on a CSV-only package; Excel and the all-in-one workbook with `excelExport`; `Content-Disposition` parsing.
